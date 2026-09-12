import SwiftUI
import MapKit
import CoreLocation
import ContactsUI
import EventKit
import EventKitUI
import MessageUI
import UserNotifications

enum OPhoneError: LocalizedError {
    case invalidInput(String)
    case unavailable(String)
    case permissionDenied(String)
    case operationFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidInput(let message), .unavailable(let message), .permissionDenied(let message), .operationFailed(let message): return message
        }
    }
}

enum OPhoneValidation {
    static func title(_ value: String) throws -> String {
        let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty, cleaned.count <= 300 else { throw OPhoneError.invalidInput("Add a title between 1 and 300 characters.") }
        return cleaned
    }

    static func futureDate(_ date: Date, now: Date = Date()) throws {
        guard date.timeIntervalSinceReferenceDate.isFinite, date > now else { throw OPhoneError.invalidInput("Choose a date and time in the future.") }
        guard date.timeIntervalSince(now) <= 315_576_000 else { throw OPhoneError.invalidInput("Choose a date within the next 10 years.") }
    }

    static func coordinate(latitude: Double?, longitude: Double?) -> CLLocationCoordinate2D? {
        guard let latitude, let longitude, latitude.isFinite, longitude.isFinite,
              (-90...90).contains(latitude), (-180...180).contains(longitude) else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    static func webURL(_ value: String) -> URL? {
        guard let url = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
              ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
              let host = url.host, !host.isEmpty else { return nil }
        return url
    }

    static func recipients(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.compactMap { value in
            let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleaned.isEmpty, cleaned.count <= 320, seen.insert(cleaned.lowercased()).inserted else { return nil }
            return cleaned
        }
    }
}

@MainActor
final class OPlaceSearch: ObservableObject {
    @Published private(set) var results: [OPlace] = []
    @Published private(set) var isSearching = false
    @Published var error: String?
    private var activeSearch: MKLocalSearch?
    private var requestID = UUID()

    func search(_ query: String, near: CLLocationCoordinate2D? = nil) async {
        cancel()
        let cleaned = query.trimmingCharacters(in: .whitespacesAndNewlines)
        results = []
        error = nil
        guard !cleaned.isEmpty else { return }
        guard cleaned.count <= 500 else { error = "Use a shorter place name or search, up to 500 characters."; return }
        if let near, OPhoneValidation.coordinate(latitude: near.latitude, longitude: near.longitude) == nil {
            error = "That search location is invalid. Search by a place name or city instead."
            return
        }

        let identity = UUID()
        requestID = identity
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = cleaned
        request.resultTypes = [.pointOfInterest, .address]
        if let near { request.region = MKCoordinateRegion(center: near, latitudinalMeters: 15_000, longitudinalMeters: 15_000) }
        let search = MKLocalSearch(request: request)
        activeSearch = search
        isSearching = true
        defer {
            if requestID == identity { isSearching = false; activeSearch = nil }
        }
        do {
            let response = try await search.start()
            guard requestID == identity, !Task.isCancelled else { return }
            var seen = Set<String>()
            results = response.mapItems.compactMap { mapItem in
                let coordinate = mapItem.placemark.coordinate
                guard OPhoneValidation.coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude) != nil else { return nil }
                let name = mapItem.name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                guard !name.isEmpty else { return nil }
                let duplicateKey = "\(name.lowercased())|\(coordinate.latitude)|\(coordinate.longitude)"
                guard seen.insert(duplicateKey).inserted else { return nil }
                let placemark = mapItem.placemark
                let street = [placemark.subThoroughfare, placemark.thoroughfare].compactMap { $0 }.joined(separator: " ")
                let address = [street.isEmpty ? nil : street, placemark.locality, placemark.administrativeArea, placemark.postalCode, placemark.country].compactMap { $0 }.joined(separator: ", ")
                let source = mapItem.url.flatMap { OPhoneValidation.webURL($0.absoluteString) }?.absoluteString ?? ""
                return OPlace(id: UUID(), title: String(name.prefix(120)), note: "Found with Apple Maps. Check the original listing for current hours and availability.", category: Self.category(mapItem.pointOfInterestCategory), address: String(address.prefix(500)), latitude: coordinate.latitude, longitude: coordinate.longitude, url: source.count <= 2000 ? source : "", price: nil, photoData: nil)
            }
        } catch {
            guard requestID == identity, !Task.isCancelled else { return }
            let underlying = error as NSError
            if underlying.domain == NSURLErrorDomain, underlying.code == NSURLErrorNotConnectedToInternet {
                self.error = "Maps search needs an internet connection. Connect and try again, or add a place manually."
            } else {
                self.error = "Apple Maps couldn't complete this search. Try a place name with a city, or add it manually. \(error.localizedDescription)"
            }
        }
    }

    func cancel() {
        requestID = UUID()
        activeSearch?.cancel()
        activeSearch = nil
        isSearching = false
    }

    private static func category(_ category: MKPointOfInterestCategory?) -> String {
        switch category {
        case .restaurant, .cafe, .bakery, .brewery, .winery, .nightlife, .foodMarket: return "Food & drink"
        case .hotel, .campground, .airport, .carRental, .publicTransport: return "Trips"
        case .store: return "Shopping"
        case .museum, .theater, .movieTheater, .amusementPark, .aquarium, .beach, .fitnessCenter, .marina, .nationalPark, .park, .stadium, .zoo: return "Things to do"
        default: return "Other"
        }
    }
}

@MainActor
final class OLocation: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    @Published private(set) var coordinate: CLLocationCoordinate2D?
    @Published private(set) var status: String?
    @Published private(set) var requesting = false
    private let manager = CLLocationManager()
    private var timeout: Task<Void, Never>?
    private var awaitingFix = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func request() {
        guard !requesting else { return }
        coordinate = nil
        requesting = true
        status = "Waiting for location permission…"
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse: requestFix()
        case .denied: finish(with: "Location access is off for Orbit. Enable it in Settings, or search using a city name.")
        case .restricted: finish(with: "Location access is restricted on this device. Search using a city name instead.")
        @unknown default: finish(with: "Location isn't available. Search using a city name instead.")
        }
    }

    func cancel() {
        requesting = false
        awaitingFix = false
        timeout?.cancel(); timeout = nil
        manager.stopUpdatingLocation()
        status = nil
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            if requesting && !awaitingFix { requestFix() }
        case .denied:
            coordinate = nil
            if requesting { finish(with: "Location access is off for Orbit. Enable it in Settings, or search using a city name.") }
        case .restricted:
            coordinate = nil
            if requesting { finish(with: "Location access is restricted on this device. Search using a city name instead.") }
        case .notDetermined: break
        @unknown default:
            if requesting { finish(with: "Location isn't available. Search using a city name instead.") }
        }
    }

    private func requestFix() {
        guard requesting, !awaitingFix else { return }
        awaitingFix = true
        status = "Finding your location…"
        manager.requestLocation()
        timeout?.cancel()
        timeout = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 20_000_000_000) }
            catch { return }
            guard let self, self.requesting else { return }
            self.finish(with: "Your location couldn't be found in time. Try again outdoors or search using a city name.")
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard requesting else { return }
        guard let location = locations.reversed().first(where: { $0.horizontalAccuracy >= 0 && abs($0.timestamp.timeIntervalSinceNow) <= 120 && OPhoneValidation.coordinate(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude) != nil }) else {
            finish(with: "A current location couldn't be found. Try again, or search using a city name.")
            return
        }
        coordinate = location.coordinate
        finish(with: manager.accuracyAuthorization == .reducedAccuracy ? "Using your approximate location." : "Using your current location.")
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard requesting else { return }
        if let locationError = error as? CLError, locationError.code == .denied {
            coordinate = nil
            finish(with: "Location access is unavailable. Check Location Services in Settings, or search using a city name.")
        } else {
            finish(with: "Your location couldn't be found. Try again, or search using a city name.")
        }
    }

    private func finish(with message: String) {
        requesting = false
        awaitingFix = false
        timeout?.cancel(); timeout = nil
        manager.stopUpdatingLocation()
        status = message
    }
}

struct OCalendarEditor: UIViewControllerRepresentable {
    let place: OPlace
    let title: String
    let date: Date
    let onComplete: (Bool) -> Void
    var onError: ((String) -> Void)? = nil

    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete) }

    func makeUIViewController(context: Context) -> UIViewController {
        do {
            let eventTitle = try OPhoneValidation.title(title)
            try OPhoneValidation.futureDate(date)
            let editor = EKEventEditViewController()
            editor.eventStore = context.coordinator.eventStore
            let event = EKEvent(eventStore: context.coordinator.eventStore)
            event.title = eventTitle
            event.startDate = date
            event.endDate = date.addingTimeInterval(3_600)
            event.timeZone = .current
            event.location = place.address.isEmpty ? place.title : place.address
            event.notes = String(place.note.prefix(20_000))
            event.url = OPhoneValidation.webURL(place.url)
            if let coordinate = OPhoneValidation.coordinate(latitude: place.latitude, longitude: place.longitude) {
                let location = EKStructuredLocation(title: event.location ?? place.title)
                location.geoLocation = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
                event.structuredLocation = location
            }
            editor.event = event
            editor.editViewDelegate = context.coordinator
            return editor
        } catch {
            let message = error.localizedDescription
            return OIntegrationErrorController(title: "Calendar event not created", message: message) {
                onComplete(false)
                onError?(message)
            }
        }
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) { context.coordinator.onComplete = onComplete }

    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let eventStore = EKEventStore()
        var onComplete: (Bool) -> Void
        private var completed = false
        init(onComplete: @escaping (Bool) -> Void) { self.onComplete = onComplete }
        func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
            guard !completed else { return }
            completed = true
            onComplete(action == .saved)
        }
    }
}

struct OContactPicker: UIViewControllerRepresentable {
    let onPick: (String, String?) -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick, onCancel: onCancel) }
    func makeUIViewController(context: Context) -> CNContactPickerViewController {
        let picker = CNContactPickerViewController()
        picker.delegate = context.coordinator
        picker.displayedPropertyKeys = [CNContactPhoneNumbersKey]
        picker.predicateForSelectionOfContact = NSPredicate(format: "phoneNumbers.@count <= 1")
        picker.predicateForSelectionOfProperty = NSPredicate(format: "key == %@", CNContactPhoneNumbersKey)
        return picker
    }
    func updateUIViewController(_ uiViewController: CNContactPickerViewController, context: Context) {
        context.coordinator.onPick = onPick
        context.coordinator.onCancel = onCancel
    }

    final class Coordinator: NSObject, CNContactPickerDelegate {
        var onPick: (String, String?) -> Void
        var onCancel: () -> Void
        private var completed = false
        init(onPick: @escaping (String, String?) -> Void, onCancel: @escaping () -> Void) { self.onPick = onPick; self.onCancel = onCancel }
        func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
            finish(contact: contact, number: contact.isKeyAvailable(CNContactPhoneNumbersKey) ? contact.phoneNumbers.first?.value.stringValue : nil)
        }
        func contactPicker(_ picker: CNContactPickerViewController, didSelect contactProperty: CNContactProperty) {
            finish(contact: contactProperty.contact, number: (contactProperty.value as? CNPhoneNumber)?.stringValue)
        }
        func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
            guard !completed else { return }; completed = true
            onCancel()
        }
        private func finish(contact: CNContact, number: String?) {
            guard !completed else { return }; completed = true
            let formatted: String
            if contact.areKeysAvailable([CNContactFormatter.descriptorForRequiredKeys(for: .fullName)]) {
                formatted = CNContactFormatter.string(from: contact, style: .fullName)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            } else {
                formatted = [contact.isKeyAvailable(CNContactGivenNameKey) ? contact.givenName : "", contact.isKeyAvailable(CNContactFamilyNameKey) ? contact.familyName : ""].filter { !$0.isEmpty }.joined(separator: " ")
            }
            let organization = contact.isKeyAvailable(CNContactOrganizationNameKey) ? contact.organizationName.trimmingCharacters(in: .whitespacesAndNewlines) : ""
            let name = !formatted.isEmpty ? formatted : (!organization.isEmpty ? organization : (number ?? "Selected contact"))
            onPick(name, number?.trimmingCharacters(in: .whitespacesAndNewlines))
        }
    }
}

struct OMessageComposer: UIViewControllerRepresentable {
    let recipients: [String]
    let body: String
    let onComplete: () -> Void
    var onError: ((String) -> Void)? = nil
    var onSent: (() -> Void)? = nil

    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete, onError: onError, onSent: onSent) }
    func makeUIViewController(context: Context) -> UIViewController {
        guard MFMessageComposeViewController.canSendText() else {
            let message = "Messages isn't available on this device. Use an iPhone with Messages configured. The iOS simulator cannot send texts."
            return OIntegrationErrorController(title: "Messages unavailable", message: message) { onComplete(); onError?(message) }
        }
        let composer = MFMessageComposeViewController()
        composer.messageComposeDelegate = context.coordinator
        composer.recipients = OPhoneValidation.recipients(recipients)
        composer.body = body
        return composer
    }
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        context.coordinator.onComplete = onComplete
        context.coordinator.onError = onError
        context.coordinator.onSent = onSent
    }

    final class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        var onComplete: () -> Void
        var onError: ((String) -> Void)?
        var onSent: (() -> Void)?
        private var completed = false
        init(onComplete: @escaping () -> Void, onError: ((String) -> Void)?, onSent: (() -> Void)?) { self.onComplete = onComplete; self.onError = onError; self.onSent = onSent }
        func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
            guard !completed else { return }; completed = true
            onComplete()
            switch result {
            case .sent: onSent?()
            case .cancelled: break
            case .failed: onError?("Messages couldn't send this message. No delivery was confirmed. Check your connection and try again.")
            @unknown default: onError?("Messages closed without confirming the message was sent.")
            }
        }
    }
}

@MainActor
enum OPhoneActions {
    static func addReminder(title: String, notes: String, due: Date, isStillValid: (() -> Bool)? = nil) async throws {
        let cleanedTitle = try OPhoneValidation.title(title)
        try OPhoneValidation.futureDate(due)
        guard notes.count <= 20_000 else { throw OPhoneError.invalidInput("Keep reminder notes under 20,000 characters.") }
        let store = EKEventStore()
        do {
            let allowed = try await store.requestFullAccessToReminders()
            guard allowed else { throw OPhoneError.permissionDenied("Reminders access is off for Orbit. Enable it in Settings to add a reminder to the Reminders app.") }
            try Task.checkCancellation()
            guard isStillValid?() ?? true else { throw OPhoneError.operationFailed("This plan changed while permission was requested. Review the current plan before adding a reminder.") }
            try OPhoneValidation.futureDate(due)
            guard let calendar = store.defaultCalendarForNewReminders(), calendar.allowsContentModifications else { throw OPhoneError.unavailable("No writable Reminders list is available. Open the Reminders app and create or enable a list, then try again.") }
            let reminder = EKReminder(eventStore: store)
            reminder.calendar = calendar
            reminder.title = cleanedTitle
            reminder.notes = notes
            var components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: due)
            components.timeZone = .current
            reminder.dueDateComponents = components
            reminder.addAlarm(EKAlarm(absoluteDate: due))
            try store.save(reminder, commit: true)
        } catch let error as OPhoneError { throw error }
        catch is CancellationError { throw CancellationError() }
        catch { throw OPhoneError.operationFailed("The Reminders app couldn't save this reminder. \(error.localizedDescription)") }
    }

    static func scheduleNotification(id: String, title: String, body: String, date: Date, isStillValid: (() -> Bool)? = nil) async throws {
        guard !id.isEmpty, id.count <= 200 else { throw OPhoneError.invalidInput("This notification needs a valid identifier.") }
        let cleanedTitle = try OPhoneValidation.title(title)
        try OPhoneValidation.futureDate(date)
        guard body.count <= 4_000 else { throw OPhoneError.invalidInput("Keep notification text under 4,000 characters.") }
        let center = UNUserNotificationCenter.current()
        do {
            let allowed = try await center.requestAuthorization(options: [.alert, .sound])
            guard allowed else { throw OPhoneError.permissionDenied("Notifications are off for Orbit. Enable them in Settings to receive a notification on this device.") }
            try Task.checkCancellation()
            guard isStillValid?() ?? true else { throw OPhoneError.operationFailed("This plan changed while permission was requested. Review it before scheduling a notification.") }
            try OPhoneValidation.futureDate(date)
            let content = UNMutableNotificationContent()
            content.title = cleanedTitle
            content.body = body
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, date.timeIntervalSinceNow), repeats: false)
            try await center.add(UNNotificationRequest(identifier: "orbit.\(id)", content: content, trigger: trigger))
            if Task.isCancelled || !(isStillValid?() ?? true) {
                center.removePendingNotificationRequests(withIdentifiers: ["orbit.\(id)"])
                if Task.isCancelled { throw CancellationError() }
                throw OPhoneError.operationFailed("This plan changed before the notification was ready. The notification was removed.")
            }
        } catch let error as OPhoneError { throw error }
        catch is CancellationError { throw CancellationError() }
        catch { throw OPhoneError.operationFailed("The notification couldn't be scheduled. \(error.localizedDescription)") }
    }

    static func cancelNotification(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["orbit.\(id)"])
    }
}

private final class OIntegrationErrorController: UIViewController {
    private let heading: String
    private let message: String
    private let onClose: () -> Void
    init(title: String, message: String, onClose: @escaping () -> Void) { heading = title; self.message = message; self.onClose = onClose; super.init(nibName: nil, bundle: nil) }
    @available(*, unavailable) required init?(coder: NSCoder) { fatalError("Not used") }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let titleLabel = UILabel()
        titleLabel.text = heading
        titleLabel.font = .preferredFont(forTextStyle: .title2)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.numberOfLines = 0
        let messageLabel = UILabel()
        messageLabel.text = message
        messageLabel.font = .preferredFont(forTextStyle: .body)
        messageLabel.adjustsFontForContentSizeCategory = true
        messageLabel.numberOfLines = 0
        let button = UIButton(type: .system)
        button.setTitle("Close", for: .normal)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.addAction(UIAction { [weak self] _ in self?.onClose() }, for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [titleLabel, messageLabel, button])
        stack.axis = .vertical; stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 36)
        ])
    }
}

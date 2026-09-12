import Foundation
import SwiftUI
import UserNotifications

enum LibraryMode: String, CaseIterable { case personal, demo }

@MainActor
final class KeepsStore: ObservableObject {
    @Published private(set) var items: [SavedIdea] = []
    @Published private(set) var decisions: [DecisionRecord] = []
    @Published private(set) var mode: LibraryMode = .personal
    @Published var isOnboarded = false
    @Published var notice: String?
    @Published var error: String?
    private let folder: URL
    private let defaults: UserDefaults
    private let testing: Bool
    private var unreadableLibrary = false

    init(storageFolder: URL? = nil, userDefaults: UserDefaults? = nil, launchArguments: [String] = ProcessInfo.processInfo.arguments) {
        testing = launchArguments.contains("--uitesting")
        defaults = userDefaults ?? (testing ? UserDefaults(suiteName: "KeepsUITesting")! : .standard)
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        folder = storageFolder ?? base.appendingPathComponent(testing ? "KeepsTesting-\(UUID().uuidString)" : "Keeps", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        if testing { defaults.removePersistentDomain(forName: "KeepsUITesting") }
        if launchArguments.contains("--demo") { switchMode(.demo) }
        else if defaults.bool(forKey: "onboarded") {
            switchMode(LibraryMode(rawValue: defaults.string(forKey: "mode") ?? "personal") ?? .personal)
        }
    }
    var activeItems: [SavedIdea] { items.filter { !$0.archived } }
    var isDemo: Bool { mode == .demo }
    private var fileURL: URL { folder.appendingPathComponent("\(mode.rawValue).keepsbackup") }
    var recoveryFiles: [URL] {
        let stored = ((try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []).filter { $0.lastPathComponent.hasPrefix("recovery-\(mode.rawValue)-") }.sorted { $0.lastPathComponent < $1.lastPathComponent }
        return unreadableLibrary ? [fileURL] + stored : stored
    }
    func recoveryBackupData() throws -> Data {
        guard let url = recoveryFiles.first else { throw KeepsError.message("There is no recovery copy in this library.") }
        return try KeepsBackup.readFile(url)
    }

    func switchMode(_ newMode: LibraryMode) {
        mode = newMode
        unreadableLibrary = false
        if FileManager.default.fileExists(atPath: fileURL.path) {
            do {
                let backup = try KeepsBackup.decode(KeepsBackup.readFile(fileURL))
                items = backup.items; decisions = backup.decisions
            } catch {
                items = []; decisions = []
                unreadableLibrary = true
                self.error = "Your saved library could not be read. Its file has been kept for recovery. Import an exported backup or reopen the app. \(error.localizedDescription)"
            }
        } else {
            items = newMode == .demo ? Self.demoItems : []
            decisions = newMode == .demo ? [DecisionRecord(createdAt: Date().addingTimeInterval(-86_400), selectedTitle: "Juniper noodle bar", selectedIdeaID: items[0].id, consideredCount: 4)] : []
            persist()
        }
        isOnboarded = true
        defaults.set(true, forKey: "onboarded")
        defaults.set(newMode.rawValue, forKey: "mode")
    }

    @discardableResult
    func save(_ item: SavedIdea) -> Bool {
        let old = items
        if let index = items.firstIndex(where: { $0.id == item.id }) { items[index] = item }
        else {
            guard items.count < 2_000 else { error = "This library has reached its 2,000 idea limit. Export or remove some ideas first."; return false }
            items.insert(item, at: 0)
        }
        guard persist() else { items = old; return false }
        return true
    }
    func toggleFavorite(_ item: SavedIdea) { var updated = item; updated.favorite.toggle(); save(updated) }
    func toggleArchive(_ item: SavedIdea) { var updated = item; updated.archived.toggle(); save(updated) }
    func delete(_ item: SavedIdea) {
        let old = items
        items.removeAll { $0.id == item.id }
        if persist() { UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderIdentifier(item.id)]) }
        else { items = old }
    }
    func choose(_ item: SavedIdea, considered: Int) -> Bool {
        guard let current = items.first(where: { $0.id == item.id }) else { error = "This idea is no longer in your library. Start a new shortlist."; return false }
        let old = decisions
        decisions.insert(DecisionRecord(selectedTitle: current.title, selectedIdeaID: current.id, consideredCount: considered), at: 0)
        decisions = Array(decisions.prefix(10_000))
        guard persist() else { decisions = old; return false }
        return true
    }
    func resetDemo() {
        guard isDemo else { return }
        let oldItems = items, oldDecisions = decisions
        items = Self.demoItems
        decisions = [DecisionRecord(createdAt: Date().addingTimeInterval(-86_400), selectedTitle: "Juniper noodle bar", selectedIdeaID: items[0].id, consideredCount: 4)]
        if !persist() { items = oldItems; decisions = oldDecisions }
        else { clearRemindersForCurrentMode(); removeRecoveryFiles() }
    }
    func clearLibrary() {
        let oldItems = items, oldDecisions = decisions
        items = []; decisions = []
        if persist() { clearRemindersForCurrentMode(); removeRecoveryFiles() }
        else { items = oldItems; decisions = oldDecisions }
    }
    func backupData() throws -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(KeepsBackup(items: items, decisions: decisions))
        guard data.count <= KeepsBackup.maximumBytes else { throw KeepsError.message("This library exceeds the 30 MB backup limit. Remove a few photos and try again.") }
        return data
    }
    func importBackup(_ data: Data) throws -> Int {
        let incoming = try KeepsBackup.decode(data)
        let currentIDs = Set(items.map(\.id))
        let additions = incoming.items.filter { !currentIDs.contains($0.id) }.map { item -> SavedIdea in var result = item; result.reminderAt = nil; return result }
        guard items.count + additions.count <= 2_000 else { throw KeepsError.message("Import would exceed the 2,000 idea limit. Your library was not changed.") }
        let oldItems = items, oldDecisions = decisions
        items.append(contentsOf: additions)
        let existingDecisions = Set(decisions.map(\.id))
        decisions.append(contentsOf: incoming.decisions.filter { !existingDecisions.contains($0.id) })
        decisions = Array(decisions.sorted { $0.createdAt > $1.createdAt }.prefix(10_000))
        guard persist() else { items = oldItems; decisions = oldDecisions; throw KeepsError.message("The imported library could not be saved. Your previous library is unchanged.") }
        return additions.count
    }
    @discardableResult
    private func persist() -> Bool {
        do {
            let data = try backupData()
            _ = try KeepsBackup.decode(data)
            if unreadableLibrary {
                let recoveryURL = folder.appendingPathComponent("recovery-\(mode.rawValue)-\(UUID().uuidString).keepsbackup")
                try FileManager.default.copyItem(at: fileURL, to: recoveryURL)
                unreadableLibrary = false
            }
            try data.write(to: fileURL, options: [.atomic, .completeFileProtectionUnlessOpen])
            return true
        } catch { self.error = "Couldn't save your library: \(error.localizedDescription)"; return false }
    }
    private func reminderIdentifier(_ id: UUID) -> String { "keeps.\(mode.rawValue).\(id.uuidString)" }
    private func removeRecoveryFiles() {
        do { for url in recoveryFiles { try FileManager.default.removeItem(at: url) } }
        catch { self.error = "Your active library was cleared, but a recovery copy could not be removed: \(error.localizedDescription)" }
    }
    private func clearRemindersForCurrentMode() {
        let prefix = "keeps.\(mode.rawValue)."
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { requests in
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: requests.map(\.identifier).filter { $0.hasPrefix(prefix) })
        }
        center.getDeliveredNotifications { notifications in
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: notifications.map { $0.request.identifier }.filter { $0.hasPrefix(prefix) })
        }
    }
    func scheduleReminder(for item: SavedIdea, at date: Date) async -> Bool {
        guard date > Date() else { error = "Choose a reminder time in the future."; return false }
        guard items.contains(where: { $0.id == item.id }) else { error = "This idea is no longer in your library. It cannot be given a reminder."; return false }
        let scheduledMode = mode
        let identifier = reminderIdentifier(item.id)
        do {
            let center = UNUserNotificationCenter.current()
            let allowed = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            guard allowed else { error = "Notifications are turned off. Enable them for Keeps in iPhone Settings to receive reminders."; return false }
            guard scheduledMode == mode, let current = items.first(where: { $0.id == item.id }) else { error = "Your library changed. Please set the reminder again."; return false }
            let content = UNMutableNotificationContent()
            content.title = isDemo ? "Keeps demo reminder" : "Something you wanted to remember"
            content.body = current.title
            content.sound = .default
            let interval = max(1, date.timeIntervalSinceNow)
            let request = UNNotificationRequest(identifier: identifier, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false))
            try await center.add(request)
            guard scheduledMode == mode, var updated = items.first(where: { $0.id == item.id }) else {
                center.removePendingNotificationRequests(withIdentifiers: [identifier])
                error = "Your library changed before the reminder could be saved. No reminder was kept."
                return false
            }
            updated.reminderAt = date
            guard save(updated) else { center.removePendingNotificationRequests(withIdentifiers: [identifier]); return false }
            return true
        } catch { self.error = "Couldn't schedule your reminder: \(error.localizedDescription)"; return false }
    }
    func cancelReminder(_ item: SavedIdea) {
        guard var updated = items.first(where: { $0.id == item.id }) else { return }
        updated.reminderAt = nil
        if save(updated) { UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderIdentifier(item.id)]) }
    }

    static var demoItems: [SavedIdea] {
        let examples: [(String, KeepsCategory, Int, Int, [String], String)] = [
            ("Juniper noodle bar", .food, 18, 12, ["noodles", "vegetarian", "cozy"], "A quiet booth and handmade noodles. Good for catching up."),
            ("Slice & Study", .food, 12, 7, ["pizza", "late-night", "casual"], "Big tables, inexpensive slices, open late in this fictional example."),
            ("Sunday dumpling club", .food, 24, 18, ["dumplings", "group", "weekend"], "A place to try after exams. Ask about dietary options before going."),
            ("Clover breakfast counter", .food, 16, 10, ["brunch", "coffee", "vegetarian"], "Pancakes and a slow Saturday morning."),
            ("Riverside picnic spot", .activity, 8, 20, ["outdoors", "quiet", "group"], "Pack snacks and take a blanket. Check the weather first."),
            ("Indie cinema double bill", .activity, 14, 15, ["films", "rainy-day", "evening"], "An easy plan for a rainy evening."),
            ("A weekend by the lake", .trip, 180, 0, ["weekend", "outdoors", "friends"], "Estimated shared weekend cost, excluding transport. Walking time does not represent travel time."),
            ("Museum city break", .trip, 250, 0, ["art", "weekend", "train"], "Two nights, a gallery, and time to wander. Price is only a sample estimate."),
            ("Secondhand denim jacket", .shopping, 35, 9, ["clothes", "secondhand", "denim"], "Look for a relaxed fit and repairable seams."),
            ("Desk lamp for the dorm", .shopping, 28, 14, ["dorm", "lighting", "practical"], "Warm light, small footprint, and an adjustable neck."),
            ("Campus ceramics workshop", .activity, 22, 6, ["creative", "group", "weekend"], "Try a beginner hand-building session together."),
            ("Used bookshop afternoon", .shopping, 10, 11, ["books", "quiet", "secondhand"], "Leave room in the bag for one good paperback.")
        ]
        return examples.enumerated().map { index, example in
            SavedIdea(title: example.0, category: example.1, originalText: "Fictional sample save for trying Keeps. This is not a verified business or offer.", notes: example.5, tags: example.4, estimatedPrice: example.2, walkMinutes: example.1 == .trip ? nil : example.3, favorite: [0, 4, 8].contains(index), createdAt: Date().addingTimeInterval(Double(-index - 1) * 86_400))
        }
    }
}

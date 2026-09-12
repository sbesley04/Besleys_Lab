import SwiftUI
import UniformTypeIdentifiers
import UserNotifications

extension UTType {
    static let gatherDecision = UTType(exportedAs: "com.besleyslab.gather.document", conformingTo: .json)
}

struct GFileDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.gatherDecision, .json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

struct GArchive: Codable {
    var version = 1
    var sessions: [GSession]
}

@MainActor
final class GStore: ObservableObject {
    @Published private(set) var sessions: [GSession] = []
    @Published private(set) var mode: GMode
    @Published var hasStarted: Bool
    @Published var message: String?
    @Published var failure: String?
    private let baseURL: URL
    private let defaults: UserDefaults
    private var unreadableModes: Set<GMode> = []

    init(baseURL: URL? = nil, defaults: UserDefaults = .standard, forceDemo: Bool = false, testing: Bool = false) {
        if testing {
            let suite = "com.besleyslab.gather.uitesting"
            let isolated = UserDefaults(suiteName: suite)!
            isolated.removePersistentDomain(forName: suite)
            self.defaults = isolated
        } else { self.defaults = defaults }
        self.baseURL = baseURL ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(testing ? "Gather-UITesting" : "Gather", isDirectory: true)
        if testing {
            try? FileManager.default.removeItem(at: self.baseURL)
            self.mode = forceDemo ? .demo : .personal
            self.hasStarted = forceDemo
        } else {
            self.mode = forceDemo ? .demo : GMode(rawValue: defaults.string(forKey: "gather.mode") ?? "") ?? .personal
            self.hasStarted = forceDemo || defaults.bool(forKey: "gather.started")
        }
        load()
    }

    private func fileURL(for mode: GMode) -> URL { baseURL.appendingPathComponent("\(mode.rawValue).json") }
    private func load() {
        let url = fileURL(for: mode)
        if !FileManager.default.fileExists(atPath: url.path) {
            sessions = mode == .demo ? GDemo.sessions() : []
            do { try persist(sessions) } catch { failure = "Could not create your library. \(error.localizedDescription)" }
            return
        }
        do {
            let archive = try Self.validatedArchive(Self.readBoundedFile(url, limit: 25_000_000))
            sessions = archive.sessions
            unreadableModes.remove(mode)
        } catch {
            sessions = []
            unreadableModes.insert(mode)
            failure = "Your library could not be read. Its original file has been preserved; export it from Settings before deleting or resetting it. \(error.localizedDescription)"
        }
    }
    private func persist(_ next: [GSession]) throws {
        guard !unreadableModes.contains(mode) else { throw GError.invalid("The existing library cannot be read. Export it from Settings, then explicitly delete this library before saving new decisions.") }
        try FileManager.default.createDirectory(at: baseURL, withIntermediateDirectories: true)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(GArchive(sessions: next))
        _ = try Self.validatedArchive(data)
        try data.write(to: fileURL(for: mode), options: [.atomic, .completeFileProtectionUnlessOpen])
    }
    private func commit(_ next: [GSession]) throws {
        try persist(next)
        sessions = next
    }
    func start(_ mode: GMode) {
        switchMode(mode)
        hasStarted = true
        defaults.set(true, forKey: "gather.started")
    }
    func switchMode(_ newMode: GMode) {
        mode = newMode
        defaults.set(newMode.rawValue, forKey: "gather.mode")
        load()
    }
    func session(_ id: UUID) -> GSession? { sessions.first { $0.id == id } }
    func save(_ session: GSession) throws {
        try GValidation.session(session)
        var next = sessions
        if let index = next.firstIndex(where: { $0.id == session.id }) { next[index] = session }
        else { next.insert(session, at: 0) }
        try commit(next)
    }
    func delete(_ id: UUID) throws {
        try commit(sessions.filter { $0.id != id })
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderID(id)])
    }
    func update(_ updated: GSession, resetVotes: Bool) throws {
        if let current = session(updated.id) {
            guard current.revision == updated.revision else {
                throw GError.invalid("This decision changed while the editor was open. Close it and reopen the latest decision before editing.")
            }
            if !resetVotes {
                guard GInvitation(session: current) == GInvitation(session: updated) else {
                    throw GError.invalid("Changing a decision requires a fresh vote. Reopen the editor and confirm clearing existing votes.")
                }
                // A no-op edit must preserve ballots or reminders received after the editor opened.
                return
            }
        }
        var changed = updated
        if resetVotes {
            changed.revision = UUID(); changed.ballots = []; changed.chosenCandidateID = nil; changed.reminderDate = nil
        }
        changed.updatedAt = Date()
        try save(changed)
        if resetVotes { UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderID(changed.id)]) }
    }
    func submit(sessionID: UUID, participantID: UUID, ratings: [UUID: Int]) throws {
        guard var session = session(sessionID) else { throw GError.invalid("This decision no longer exists.") }
        guard session.chosenCandidateID == nil else { throw GError.invalid("This plan is already decided. Reopen it before changing votes.") }
        let ballot = GBallot(sessionID: session.id, revision: session.revision, participantID: participantID, ratings: ratings)
        try GValidation.ballot(ballot, for: session)
        session.ballots.removeAll { $0.participantID == participantID }
        session.ballots.append(ballot)
        session.updatedAt = Date()
        try save(session)
    }
    func choose(sessionID: UUID, candidateID: UUID?) throws {
        guard var session = session(sessionID), session.isOrganizer else { throw GError.invalid("Only the organizer can choose the final plan.") }
        if let candidateID {
            guard session.candidates.contains(where: { $0.id == candidateID }) else { throw GError.invalid("That option no longer exists.") }
        }
        session.chosenCandidateID = candidateID; session.reminderDate = nil; session.updatedAt = Date()
        try save(session)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderID(sessionID)])
    }

    @discardableResult
    func importData(_ data: Data) throws -> UUID {
        let transfer = try GTransfer.decode(data)
        switch transfer.kind {
        case .invitation:
            guard let invitation = transfer.invitation else { throw GError.invalid("No invitation was found.") }
            if let existing = session(invitation.sessionID) {
                guard !existing.isOrganizer else { throw GError.invalid("You already organize this decision. Import a returned response file instead.") }
                if existing.revision == invitation.revision {
                    guard GInvitation(session: existing) == invitation else { throw GError.invalid("The file changes options without updating its version. Ask the organizer to resend it.") }
                    message = "This invitation is already in your library. Your saved response has been kept."
                    return existing.id
                }
                throw GError.invalid("A different version of this invitation is already saved. Delete the old invited decision, then import the latest file. This prevents an old file from replacing current votes.")
            }
            try save(invitation.makeSession())
            message = "Invitation added. Choose your name, swipe, then send your response file back to the organizer."
            return invitation.sessionID
        case .ballot:
            guard let ballot = transfer.ballot, var session = session(ballot.sessionID) else { throw GError.invalid("The original decision is not on this device. Import responses on the organizer’s device.") }
            guard session.isOrganizer else { throw GError.invalid("Send this response to the organizer. Invited copies do not collect other people’s votes.") }
            guard session.chosenCandidateID == nil else { throw GError.invalid("This plan is already decided. Reopen it before importing more responses.") }
            try GValidation.ballot(ballot, for: session)
            if let previous = session.ballot(for: ballot.participantID) {
                if previous == ballot { message = "This response was already imported."; return session.id }
                guard ballot.submittedAt > previous.submittedAt else { throw GError.invalid("A newer response from this person is already saved.") }
            }
            session.ballots.removeAll { $0.participantID == ballot.participantID }
            session.ballots.append(ballot); session.updatedAt = Date()
            try save(session)
            let person = session.participants.first { $0.id == ballot.participantID }?.name ?? "Your friend"
            message = "\(person)’s response was imported."
            return session.id
        }
    }
    func importURL(_ url: URL) {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            _ = try importData(Self.readBoundedFile(url, limit: 1_000_000))
            if !hasStarted { hasStarted = true; defaults.set(true, forKey: "gather.started") }
        } catch { failure = "Could not import this file. \(error.localizedDescription)" }
    }
    func shareURL(_ transfer: GTransfer, name: String) throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("GatherExports", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let safeName = name.components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.joined(separator: "-")
        let url = directory.appendingPathComponent("\(String(safeName.prefix(60)))-\(UUID().uuidString.prefix(6)).gather")
        try transfer.encoded().write(to: url, options: .atomic)
        return url
    }
    func exportLibrary() throws -> Data {
        if unreadableModes.contains(mode) { return try Data(contentsOf: fileURL(for: mode)) }
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(GArchive(sessions: sessions))
    }
    static func readBoundedFile(_ url: URL, limit: Int) throws -> Data {
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        var data = Data()
        while data.count <= limit {
            guard let chunk = try file.read(upToCount: min(65_536, limit + 1 - data.count)), !chunk.isEmpty else { break }
            data.append(chunk)
        }
        guard data.count <= limit else { throw GError.invalid("This file exceeds the supported size limit.") }
        return data
    }
    static func validatedArchive(_ data: Data) throws -> GArchive {
        guard data.count <= 25_000_000 else { throw GError.invalid("This backup is larger than 25 MB.") }
        let archive = try JSONDecoder().decode(GArchive.self, from: data)
        guard archive.version == 1 else { throw GError.invalid("This backup uses an unsupported version.") }
        guard archive.sessions.count <= 5000, Set(archive.sessions.map(\.id)).count == archive.sessions.count
        else { throw GError.invalid("This backup has too many decisions or duplicate decision IDs.") }
        for session in archive.sessions {
            try GValidation.session(session)
            guard Set(session.ballots.map(\.participantID)).count == session.ballots.count
            else { throw GError.invalid("A decision contains multiple responses from the same person.") }
            for ballot in session.ballots { try GValidation.ballot(ballot, for: session) }
            if let choice = session.chosenCandidateID {
                guard session.candidates.contains(where: { $0.id == choice }) else { throw GError.invalid("A chosen plan is missing from its decision.") }
            }
        }
        return archive
    }
    @discardableResult
    func restoreLibrary(_ data: Data) throws -> Int {
        let archive = try Self.validatedArchive(data)
        let existing = Set(sessions.map(\.id))
        let additions = archive.sessions.filter { !existing.contains($0.id) }.map { saved -> GSession in
            var session = saved
            // Reminders are device-local and are not rescheduled by restoring a file.
            session.reminderDate = nil
            return session
        }
        try commit(sessions + additions)
        return additions.count
    }
    func eraseCurrentLibrary() throws {
        let prefix = "gather.\(mode.rawValue)."
        let oldUnreadable = unreadableModes.contains(mode)
        unreadableModes.remove(mode)
        do { try commit([]) } catch { if oldUnreadable { unreadableModes.insert(mode) }; throw error }
        cancelReminders(prefix: prefix)
    }
    func resetDemo() throws {
        guard mode == .demo else { throw GError.invalid("Switch to demo mode before resetting the demo.") }
        let prefix = "gather.\(mode.rawValue)."
        let oldUnreadable = unreadableModes.contains(.demo)
        unreadableModes.remove(.demo)
        do { try commit(GDemo.sessions()) } catch { if oldUnreadable { unreadableModes.insert(.demo) }; throw error }
        cancelReminders(prefix: prefix)
    }
    private func cancelReminders(prefix: String) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { requests in
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: requests.filter { $0.identifier.hasPrefix(prefix) }.map(\.identifier))
        }
        center.getDeliveredNotifications { notifications in
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: notifications.filter { $0.request.identifier.hasPrefix(prefix) }.map { $0.request.identifier })
        }
    }
    private func reminderID(_ id: UUID) -> String { "gather.\(mode.rawValue).\(id.uuidString)" }
    func setReminder(sessionID: UUID, date: Date) async throws {
        guard date > Date() else { throw GError.invalid("Choose a reminder time in the future.") }
        guard let initial = session(sessionID), let chosen = initial.chosenCandidate else { throw GError.invalid("Choose a plan before adding a reminder.") }
        let originalMode = mode
        let identifier = reminderID(sessionID)
        let center = UNUserNotificationCenter.current()
        let allowed = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        guard allowed else { throw GError.invalid("Notifications are off for Gather. You can enable them in iPhone Settings, then try again.") }
        guard mode == originalMode, session(sessionID) == initial else { throw GError.invalid("The decision changed while setting this reminder. Open the current plan and try again.") }
        let content = UNMutableNotificationContent()
        content.title = mode == .demo ? "Gather demo reminder" : initial.title
        content.body = "Your plan: \(chosen.title). \(initial.context)"; content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, date.timeIntervalSinceNow), repeats: false)
        try await center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
        guard mode == originalMode, var current = session(sessionID), current == initial else {
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            throw GError.invalid("The decision changed while setting this reminder. No reminder was kept.")
        }
        current.reminderDate = date
        do { try save(current) } catch { center.removePendingNotificationRequests(withIdentifiers: [identifier]); throw error }
    }
    func cancelReminder(sessionID: UUID) throws {
        guard var session = session(sessionID) else { return }
        session.reminderDate = nil
        try save(session)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderID(sessionID)])
    }
}

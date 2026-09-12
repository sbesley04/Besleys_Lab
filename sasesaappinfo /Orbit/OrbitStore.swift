import Foundation
import Combine

struct OLibrary: Codable {
    var version = 1
    var profile: OPerson
    var onboarded: Bool
    var places: [OPlace]
    var currentRoom: ORoom?
    var history: [ORoom]
    var networkRoomIDs: [UUID]?
    func validate() throws {
        guard version == 1, ONearbyProtocol.isValidName(profile.name), places.count <= 500,
              Set(places.map(\.id)).count == places.count, history.count <= 40,
              Set(history.map(\.id)).count == history.count else { throw OError.message("The saved library is invalid or uses an unsupported version.") }
        for place in places { try place.validate() }
        if let currentRoom { try currentRoom.validate() }
        for room in history { try room.validate() }
    }
}

@MainActor
final class OrbitStore: ObservableObject {
    static let shared = OrbitStore()
    @Published var profile = OPerson(id: UUID(), name: "You")
    @Published var mode = "personal"
    @Published var onboarded = false
    @Published var places: [OPlace] = []
    @Published var currentRoom: ORoom?
    @Published var history: [ORoom] = []
    @Published var error: String?
    @Published var notice: String?
    @Published var connection = "local"
    @Published var isBusy = false
    @Published var status = "Your private library"
    @Published var pending: [OPerson] = []
    @Published var inviteURL: URL?
    let nearby: NearbyTransport

    private let baseURL: URL
    private let defaults: UserDefaults
    private let client: OOnlineClient
    private let vault: OCredentialVault
    private var credentials: OOnlineCredentials?
    private var unreadableModes: Set<String> = []
    private var generation = UUID()
    private var active = true
    private var polling: Task<Void, Never>?
    private var operation: Task<Void, Never>?
    private var acknowledgements: [UUID: Task<Void, Never>] = [:]
    private var subscriptions: Set<AnyCancellable> = []
    private var onlineFailureReported = false
    private var networkRoomIDs: Set<UUID> = []

    init(baseURL: URL? = nil, defaults: UserDefaults? = nil, testing: Bool = false, forceDemo: Bool = false,
         nearby: NearbyTransport? = nil, onlineClient: OOnlineClient? = nil, credentialVault: OCredentialVault? = nil) {
        let arguments = ProcessInfo.processInfo.arguments
        let isolated = testing || arguments.contains("--uitesting")
        let suite = "com.besleyslab.orbit.uitesting"
        self.defaults = defaults ?? (isolated ? UserDefaults(suiteName: suite)! : .standard)
        self.baseURL = baseURL ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(isolated ? "Orbit-UITesting" : "Orbit", isDirectory: true)
        self.nearby = nearby ?? NearbyTransport()
        self.client = onlineClient ?? OOnlineClient()
        self.vault = credentialVault ?? OCredentialVault(memoryOnly: isolated || baseURL != nil)
        if isolated && baseURL == nil {
            try? FileManager.default.removeItem(at: self.baseURL)
            self.defaults.removePersistentDomain(forName: suite)
        }
        mode = forceDemo || arguments.contains("--demo") ? "demo" : (self.defaults.string(forKey: "orbit.mode") == "demo" ? "demo" : "personal")
        load(mode)
        bindNearby()
        if mode == "personal", !unreadableModes.contains(mode) { resumeOnline() }
    }

    func finishOnboarding(name: String, demo: Bool) {
        let cleanName = ONearbyProtocol.normalizedName(name)
        guard !cleanName.isEmpty else { error = "Add a name so friends know who is in the room."; return }
        if mode != (demo ? "demo" : "personal") { switchMode(demo) }
        var next = library
        next.profile.name = cleanName; next.onboarded = true
        if demo && next.currentRoom == nil { next.currentRoom = ODemo.room(person: next.profile) }
        do { try commit(next); status = demo ? "Demo · sample friends and messages" : "Your private library" }
        catch { self.error = error.localizedDescription }
    }

    func switchMode(_ demo: Bool) {
        endRuntime()
        mode = demo ? "demo" : "personal"
        defaults.set(mode, forKey: "orbit.mode")
        load(mode)
        if !demo && !unreadableModes.contains(mode) { resumeOnline() }
    }

    func resetDemo() {
        guard mode == "demo" else { error = "Switch to demo mode before resetting the sample library."; return }
        endRuntime()
        let person = OPerson(id: profile.id, name: profile.name)
        let sample = OLibrary(profile: person, onboarded: true, places: ODemo.places(), currentRoom: ODemo.room(person: person), history: [])
        let wasUnreadable = unreadableModes.remove("demo") != nil
        do { try commit(sample); status = "Demo reset · fictional friends and messages" }
        catch { if wasUnreadable { unreadableModes.insert("demo") }; self.error = error.localizedDescription }
    }

    @discardableResult
    func savePlace(_ place: OPlace) -> Bool {
        do {
            try place.validate()
            var next = library
            if let index = next.places.firstIndex(where: { $0.id == place.id }) { next.places[index] = place }
            else { next.places.insert(place, at: 0) }
            try commit(next)
            notice = "Saved to your \(mode == "demo" ? "demo" : "personal") library."
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func deletePlace(_ id: UUID) {
        var next = library; next.places.removeAll { $0.id == id }
        do { try commit(next) } catch { self.error = error.localizedDescription }
    }

    func createRoom(title: String, date: Date, online: Bool) {
        guard !isBusy else { error = "Wait for the current room update to finish."; return }
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, title.count <= 80, date.timeIntervalSinceReferenceDate.isFinite else {
            error = "Add a room title of up to 80 characters and a valid date."; return
        }
        guard !unreadableModes.contains(mode) else { error = "Your library could not be read. Delete or recover it before creating a room."; return }
        if mode == "personal" {
            do { try requireNoOnlineAccess() } catch { self.error = error.localizedDescription; return }
        }
        if mode == "demo" || !online {
            do {
                var room = ORoom(title: title, hostID: profile.id, members: [profile]); room.eventDate = date
                try room.validate()
                var next = library; archiveCurrent(into: &next); next.currentRoom = room
                if mode == "personal" { next.networkRoomIDs = Array(Set(next.networkRoomIDs ?? []).union([room.id])) }
                try commit(next)
                endRuntime()
                if mode == "demo" { status = "Demo room · add sample activity with Simulate friend" }
                else { connection = "nearbyHost"; nearby.host(roomID: room.id, title: room.title, localID: profile.id, name: profile.name) }
            } catch { self.error = error.localizedDescription }
            return
        }
        let token = generation; let person = profile
        isBusy = true; status = "Creating an online room…"; error = nil
        operation = Task { [weak self] in
            guard let self else { return }
            defer { if self.generation == token { self.isBusy = false; self.operation = nil } }
            do {
                let response = try await self.client.create(title: title, profile: person, eventDate: date)
                guard self.generation == token, self.mode == "personal" else { return }
                try self.establishOnline(response, expectedMemberID: person.id, expectedRoomID: nil)
            } catch { if self.generation == token { self.error = error.localizedDescription; self.status = "Online room could not be created" } }
        }
    }

    func browseNearby() {
        guard mode == "personal" else { error = "Nearby connections are off in demo mode. Switch to your personal library to join real friends."; return }
        guard !unreadableModes.contains(mode) else { error = "Resolve the saved-library error before joining a room."; return }
        do { try requireNoOnlineAccess() } catch { self.error = error.localizedDescription; return }
        endRuntime(); connection = "nearbyGuest"
        nearby.browse(localID: profile.id, name: profile.name)
    }

    func joinNearby(_ room: ONearbyRoom) {
        guard mode == "personal", connection == "nearbyGuest" else { error = "Search nearby from your personal library first."; return }
        nearby.join(room)
    }

    func joinOnline(_ url: String) {
        guard mode == "personal" else { error = "Switch to your personal library before joining a real online room."; return }
        guard !isBusy else { error = "Wait for the current request to finish."; return }
        do {
            let invitation = try OOnlineClient.parseInvite(url, baseURL: client.baseURL)
            guard !unreadableModes.contains(mode) else { throw OError.message("Resolve the saved-library error before joining a room.") }
            if let existing = try vault.load() {
                if existing.roomID == invitation.roomID, existing.memberID == profile.id { resumeOnline(); return }
                throw OError.message("Leave your existing online room before joining another. Its secure room access has been kept.")
            }
            let token = generation; let person = profile
            isBusy = true; error = nil; status = "Requesting to join…"
            operation = Task { [weak self] in
                guard let self else { return }
                defer { if self.generation == token { self.isBusy = false; self.operation = nil } }
                do {
                    let response = try await self.client.join(invite: invitation, profile: person)
                    guard self.generation == token, self.mode == "personal" else { return }
                    try self.establishOnline(response, expectedMemberID: person.id, expectedRoomID: invitation.roomID)
                } catch { if self.generation == token { self.error = error.localizedDescription; self.status = "Could not join online room" } }
            }
        } catch { self.error = error.localizedDescription }
    }

    func send(_ command: OCommand) {
        var command = command
        if let place = command.place { command.place = place.shared }
        guard let room = currentRoom else { error = "Join or create a room first."; return }
        guard !unreadableModes.contains(mode) else { error = "The local library is unavailable. Your action has not been sent."; return }
        error = nil
        if mode == "demo" || connection == "local" || connection == "nearbyHost" {
            if mode != "demo", connection == "local", networkRoomIDs.contains(room.id) {
                error = "This is a saved copy of a shared room. Rejoin the live room before sending; offline edits are not counted."; return
            }
            guard mode == "demo" || room.hostID == profile.id else { error = "This is a saved offline room. Rejoin its host before sending updates."; return }
            do { try applyAuthoritative(command, from: profile.id) }
            catch { self.error = error.localizedDescription }
        } else if connection == "nearbyGuest" {
            guard !isBusy else { error = "Wait for the host to confirm your previous update."; return }
            guard active, let host = nearby.activeHostID, nearby.activeRoomID == room.id, nearby.connectedIDs.contains(host) else {
                error = "You are disconnected. Rejoin the host before sending; this action has not been counted."; return
            }
            do {
                let data = try OJSON.encoder().encode(OWire(kind: "command", command: command))
                try nearby.send(data, to: host)
                awaitAcknowledgement(command.id)
                status = "Sent to host · waiting for confirmation"
            } catch { self.error = error.localizedDescription }
        } else if connection == "online" {
            guard active, let credentials else { error = "Reconnect to the online room before sending."; return }
            guard !isBusy else { error = "The previous update is still waiting for confirmation."; return }
            let token = generation
            isBusy = true; status = "Sending to the room…"
            operation = Task { [weak self] in
                guard let self else { return }
                defer { if self.generation == token { self.isBusy = false; self.operation = nil } }
                do {
                    let response = try await self.client.send(command, credentials: credentials)
                    guard self.generation == token, self.credentials == credentials else { return }
                    try self.acceptOnline(response, credentials: credentials)
                    guard response.room?.appliedIDs.contains(command.id) == true else { throw OError.message("The service did not confirm this action. Refresh or retry; it has not been counted on this device.") }
                } catch { if self.generation == token { self.error = error.localizedDescription; self.status = "Update unconfirmed · reconnect or retry" } }
            }
        }
    }

    func leaveRoom() {
        guard !isBusy else { error = "Wait for the current update to finish before leaving."; return }
        if connection == "online", let credentials {
            let token = generation; let isHost = currentRoom?.hostID == profile.id
            isBusy = true
            operation = Task { [weak self] in
                guard let self else { return }
                do {
                    if isHost { try await self.client.delete(credentials) }
                    else { try await self.client.leave(credentials) }
                    guard self.generation == token else { return }
                    try self.vault.clear(); self.credentials = nil
                    try self.finishLeave()
                } catch {
                    guard self.generation == token else { return }
                    self.isBusy = false; self.error = "Could not leave the online room. \(error.localizedDescription)"
                }
            }
        } else {
            do { try finishLeave() } catch { self.error = error.localizedDescription }
        }
    }

    func approve(_ id: UUID) {
        if connection == "nearbyHost" {
            guard let room = currentRoom, let memberID = nearby.memberID(forRequest: id) else { return }
            guard room.members.count < 8 || room.members.contains(where: { $0.id == memberID }) else {
                nearby.reject(id); error = "This room already has eight members. Create a new room to invite a different group."; return
            }
            nearby.accept(id)
        }
        else if connection == "online" { sendApproval(id, approving: true) }
    }
    func reject(_ id: UUID) {
        if connection == "nearbyHost" { nearby.reject(id) }
        else if connection == "online" { sendApproval(id, approving: false) }
    }

    func simulateFriend() {
        guard mode == "demo", var room = currentRoom else { error = "Sample activity is available only inside a demo room."; return }
        do {
            var friend = room.members.first { $0.id != profile.id }
            if friend == nil {
                let person = OPerson(id: UUID(), name: "Maya"); room.members.append(person); friend = person; room.revision += 1
            }
            guard let friend else { return }
            let command: OCommand
            if room.phase == "collecting", room.places.count < 12 {
                var place = ODemo.places()[room.places.count % ODemo.places().count]
                place.id = UUID(); command = OCommand(kind: "suggest", place: place)
            } else if room.phase == "voting" {
                let ratings = Dictionary(uniqueKeysWithValues: room.places.enumerated().map { ($0.element.id.uuidString.lowercased(), $0.offset % 3 == 0 ? 2 : 1) })
                command = OCommand(kind: "vote", ballot: OBallot(personID: friend.id, optionRevision: room.optionRevision, ratings: ratings))
            } else { command = OCommand(kind: "chat", text: "Sample reply: that plan works for me. This is demo activity.") }
            try room.apply(command, from: friend.id)
            var next = library; next.currentRoom = room; try commit(next)
            notice = "Simulated \(friend.name)’s response. No real person was contacted."
        } catch { self.error = error.localizedDescription }
    }

    func setActive(_ value: Bool) {
        active = value
        if value {
            if connection == "online" { beginPolling() }
        } else {
            polling?.cancel(); polling = nil
            if connection == "online" { status = "Background · online updates paused" }
        }
    }

    func erasePersonalData() {
        let online = credentials ?? (try? vault.load())
        let hostID = (mode == "personal" ? currentRoom : try? readLibrary("personal")?.currentRoom)?.hostID
        let token = generation
        isBusy = true
        operation = Task { [weak self] in
            guard let self else { return }
            var remoteError: String?
            if let online {
                do {
                    if hostID == online.memberID { try await self.client.delete(online) }
                    else { try await self.client.leave(online) }
                } catch { remoteError = "Local data was erased, but the online service could not confirm removal of the shared room. \(error.localizedDescription)" }
            }
            guard self.generation == token else { return }
            do {
                try self.vault.clear()
                let blank = OLibrary(profile: OPerson(id: UUID(), name: "You"), onboarded: false, places: [], currentRoom: nil, history: [])
                try self.write(blank, mode: "personal", permitUnreadableOverwrite: true)
                self.unreadableModes.remove("personal")
                if self.mode == "personal" { self.endRuntime(); self.publish(blank) }
                self.isBusy = false
                if let remoteError { self.error = remoteError } else { self.notice = "Personal data was erased from this device." }
            } catch { self.isBusy = false; self.error = error.localizedDescription }
        }
    }

    // MARK: Atomic local persistence
    private var library: OLibrary { OLibrary(profile: profile, onboarded: onboarded, places: places, currentRoom: currentRoom, history: history, networkRoomIDs: Array(networkRoomIDs)) }
    private func file(_ mode: String) -> URL { baseURL.appendingPathComponent("\(mode).json") }
    private func readLibrary(_ mode: String) throws -> OLibrary? {
        let url = file(mode)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let handle = try FileHandle(forReadingFrom: url); defer { try? handle.close() }
        guard let data = try handle.read(upToCount: 50_000_001), data.count <= 50_000_000 else { throw OError.message("The saved library is larger than the supported 50 MB limit.") }
        let value = try OJSON.decoder().decode(OLibrary.self, from: data); try value.validate(); return value
    }
    private func write(_ value: OLibrary, mode: String, permitUnreadableOverwrite: Bool = false) throws {
        guard !unreadableModes.contains(mode) || permitUnreadableOverwrite else { throw OError.message("The existing library could not be read and has been preserved. Resolve it or explicitly erase this library before saving.") }
        try value.validate()
        let data = try OJSON.encoder().encode(value)
        guard data.count <= 50_000_000 else { throw OError.message("Your library reached its 50 MB limit. Remove a few photos or saved places before adding more.") }
        try FileManager.default.createDirectory(at: baseURL, withIntermediateDirectories: true)
        try data.write(to: file(mode), options: [.atomic, .completeFileProtectionUnlessOpen])
    }
    private func commit(_ value: OLibrary) throws { try write(value, mode: mode); publish(value) }
    private func publish(_ value: OLibrary) {
        profile = value.profile; onboarded = value.onboarded; places = value.places
        currentRoom = value.currentRoom; history = value.history
        networkRoomIDs = Set(value.networkRoomIDs ?? [])
    }
    private func load(_ target: String) {
        do {
            if let saved = try readLibrary(target) { unreadableModes.remove(target); publish(saved) }
            else {
                let person = OPerson(id: UUID(), name: "You")
                let value = OLibrary(profile: person, onboarded: target == "demo", places: target == "demo" ? ODemo.places() : [],
                                     currentRoom: target == "demo" ? ODemo.room(person: person) : nil, history: [])
                try write(value, mode: target); publish(value)
            }
            status = target == "demo" ? "Demo · fictional friends and messages" : (currentRoom == nil ? "Your private library" : "Saved room · offline until you reconnect")
        } catch {
            unreadableModes.insert(target)
            places = []; currentRoom = nil; history = []; onboarded = true
            self.error = "Your \(target) library could not be read. The original file is preserved and new writes are blocked until you recover or explicitly erase it. \(error.localizedDescription)"
            status = "Library unavailable"
        }
    }
    private func archiveCurrent(into next: inout OLibrary) {
        if let currentRoom {
            next.history.removeAll { $0.id == currentRoom.id }
            next.history.insert(currentRoom, at: 0)
            next.history = Array(next.history.prefix(40))
        }
    }
    private func finishLeave() throws {
        var next = library; archiveCurrent(into: &next); next.currentRoom = nil
        try commit(next); endRuntime(); status = mode == "demo" ? "Demo library" : "Your private library"
    }
    private func endRuntime() {
        generation = UUID()
        operation?.cancel(); operation = nil; polling?.cancel(); polling = nil
        for task in acknowledgements.values { task.cancel() }; acknowledgements.removeAll()
        nearby.stop(); credentials = nil; pending = []; inviteURL = nil; connection = "local"; isBusy = false
    }

    // MARK: Nearby authority and confirmed snapshots
    private func bindNearby() {
        nearby.onConnected = { [weak self] id in self?.nearbyConnected(id) }
        nearby.onDisconnected = { [weak self] id in
            guard let self else { return }
            if self.connection == "nearbyGuest" {
                self.cancelAcknowledgements(message: "The host disconnected before confirming the update. Rejoin before sending again.")
            }
        }
        nearby.onData = { [weak self] data, id in self?.receiveNearby(data, from: id) }
        nearby.$status.sink { [weak self] text in
            guard let self, self.connection.hasPrefix("nearby") else { return }; self.status = text
        }.store(in: &subscriptions)
        nearby.$error.sink { [weak self] text in
            guard let self, self.connection.hasPrefix("nearby"), let text else { return }; self.error = text
        }.store(in: &subscriptions)
        nearby.$pending.sink { [weak self] requests in
            guard let self, self.connection == "nearbyHost" else { return }
            self.pending = requests.map { OPerson(id: $0.id, name: $0.name) }
        }.store(in: &subscriptions)
    }
    private func nearbyConnected(_ id: UUID) {
        guard mode == "personal" else { return }
        if connection == "nearbyHost" {
            guard var room = currentRoom, room.hostID == profile.id, nearby.activeRoomID == room.id,
                  let name = nearby.memberName(for: id) else { return }
            do {
                if let index = room.members.firstIndex(where: { $0.id == id }) { room.members[index].name = name }
                else {
                    guard room.members.count < 8 else { throw OError.message("This room already has eight members. Remove a member before approving someone new.") }
                    room.members.append(OPerson(id: id, name: name))
                }
                room.revision += 1; try room.validate()
                var next = library; next.currentRoom = room; try commit(next)
                try broadcast(room)
            } catch { sendNearbyError(error.localizedDescription, to: id); nearby.disconnect(id); self.error = error.localizedDescription }
        } else if connection == "nearbyGuest" {
            do { try nearby.send(OJSON.encoder().encode(OWire(kind: "hello")), to: id) }
            catch { self.error = error.localizedDescription }
        }
    }
    func receiveNearby(_ data: Data, from memberID: UUID) {
        guard mode == "personal", data.count <= ONearbyProtocol.maximumDataBytes, nearby.connectedIDs.contains(memberID) else { return }
        do {
            let wire = try OJSON.decoder().decode(OWire.self, from: data)
            guard wire.version == 1 else { throw OError.message("This peer uses an unsupported Orbit version.") }
            if connection == "nearbyHost" {
                guard let room = currentRoom, room.hostID == profile.id, nearby.activeRoomID == room.id,
                      room.members.contains(where: { $0.id == memberID }) else { throw OError.message("This sender is not an approved room member.") }
                if wire.kind == "hello" { try broadcast(room, to: memberID) }
                else if wire.kind == "command", let command = wire.command, wire.room == nil { try applyAuthoritative(command, from: memberID) }
                else { throw OError.message("Guests can send commands, not room snapshots.") }
            } else if connection == "nearbyGuest" {
                guard memberID == nearby.activeHostID else { throw OError.message("Only the selected host can update this room.") }
                if wire.kind == "error" {
                    cancelAcknowledgements(message: String((wire.message ?? "The host rejected the update.").prefix(500)))
                    return
                }
                guard wire.kind == "snapshot", let room = wire.room, wire.command == nil,
                      room.id == nearby.activeRoomID, room.hostID == memberID,
                      room.members.contains(where: { $0.id == profile.id }) else { throw OError.message("The received snapshot does not match your approved room.") }
                try room.validate()
                if let currentRoom, currentRoom.id == room.id, room.revision < currentRoom.revision { return }
                var next = library
                if next.currentRoom?.id != room.id { archiveCurrent(into: &next) }
                next.currentRoom = room; next.networkRoomIDs = Array(Set(next.networkRoomIDs ?? []).union([room.id])); try commit(next)
                acknowledge(room.appliedIDs)
                status = "Connected to host · room up to date"
            }
        } catch {
            if connection == "nearbyHost" { sendNearbyError(error.localizedDescription, to: memberID) }
            self.error = error.localizedDescription
        }
    }
    private func applyAuthoritative(_ command: OCommand, from memberID: UUID) throws {
        guard var room = currentRoom else { throw OError.message("This room no longer exists.") }
        try room.apply(command, from: memberID)
        var next = library; next.currentRoom = room; try commit(next)
        if connection == "nearbyHost", !nearby.connectedIDs.isEmpty { try broadcast(room) }
    }
    private func broadcast(_ room: ORoom, to memberID: UUID? = nil) throws {
        let data = try OJSON.encoder().encode(OWire(kind: "snapshot", room: room))
        try nearby.send(data, to: memberID)
    }
    private func sendNearbyError(_ message: String, to memberID: UUID) {
        do { try nearby.send(OJSON.encoder().encode(OWire(kind: "error", message: String(message.prefix(500)))), to: memberID) }
        catch { self.error = "Could not deliver the rejection to that device. \(error.localizedDescription)" }
    }
    private func awaitAcknowledgement(_ id: UUID) {
        let token = generation
        acknowledgements[id]?.cancel()
        acknowledgements[id] = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 12_000_000_000) } catch { return }
            guard let self, self.generation == token, self.acknowledgements.removeValue(forKey: id) != nil else { return }
            self.isBusy = !self.acknowledgements.isEmpty
            self.error = "The host has not confirmed this action. Rejoin or retry; it has not been counted locally."
            self.status = "Waiting for host confirmation"
        }
        isBusy = true
    }
    private func acknowledge(_ ids: [UUID]) {
        for id in ids { acknowledgements.removeValue(forKey: id)?.cancel() }
        isBusy = !acknowledgements.isEmpty
    }
    private func cancelAcknowledgements(message: String) {
        let hadPending = !acknowledgements.isEmpty
        for task in acknowledgements.values { task.cancel() }; acknowledgements.removeAll(); isBusy = false
        if hadPending { error = message }
    }

    // MARK: Real online rooms
    private func establishOnline(_ response: OOnlineResponse, expectedMemberID: UUID, expectedRoomID: UUID?) throws {
        guard let keys = response.credentials, keys.memberID == expectedMemberID,
              expectedRoomID == nil || keys.roomID == expectedRoomID else { throw OError.message("The service returned access to a different room or member.") }
        try keys.validate()
        try validateOnline(response, credentials: keys)
        try vault.save(keys)
        let oldGeneration = generation
        // End nearby/polling state without canceling the task currently accepting this response.
        nearby.stop(); polling?.cancel(); polling = nil
        for task in acknowledgements.values { task.cancel() }; acknowledgements.removeAll()
        credentials = keys; connection = "online"; inviteURL = client.invitationURL(for: keys)
        try acceptOnline(response, credentials: keys)
        if generation == oldGeneration { beginPolling() }
    }
    private func validateOnline(_ response: OOnlineResponse, credentials: OOnlineCredentials) throws {
        try response.validate()
        guard credentials.memberID == profile.id else { throw OError.message("Saved online access belongs to another profile.") }
        if let room = response.room {
            guard room.id == credentials.roomID, room.members.contains(where: { $0.id == profile.id }) else {
                throw OError.message("The service response does not match this membership.")
            }
            if room.hostID != profile.id, !response.pending.isEmpty { throw OError.message("Guest access unexpectedly included host-only requests.") }
        } else if response.status == "active" { throw OError.message("The service marked the room active without returning a room.") }
    }
    private func acceptOnline(_ response: OOnlineResponse, credentials: OOnlineCredentials) throws {
        try validateOnline(response, credentials: credentials)
        if let room = response.room {
            if let currentRoom, currentRoom.id == room.id, room.revision < currentRoom.revision { return }
            pending = response.pending
            if currentRoom != room || !networkRoomIDs.contains(room.id) {
                var next = library
                if next.currentRoom?.id != room.id { archiveCurrent(into: &next) }
                next.currentRoom = room; next.networkRoomIDs = Array(Set(next.networkRoomIDs ?? []).union([room.id])); try commit(next)
            }
            status = "Online · room up to date"
        } else {
            pending = response.pending
            if currentRoom != nil { var next = library; archiveCurrent(into: &next); next.currentRoom = nil; try commit(next) }
            status = "Request sent · waiting for host approval"
        }
        onlineFailureReported = false
    }
    private func resumeOnline() {
        do {
            guard let saved = try vault.load(), saved.memberID == profile.id else { return }
            credentials = saved; connection = "online"; inviteURL = client.invitationURL(for: saved)
            status = "Reconnecting to online room…"; beginPolling()
        } catch { self.error = error.localizedDescription }
    }
    private func requireNoOnlineAccess() throws {
        let saved = try vault.load()
        if credentials != nil || saved != nil {
            throw OError.message("Leave your current online room before starting another room or browsing nearby. Its secure access has been kept.")
        }
    }
    private func beginPolling() {
        polling?.cancel(); polling = nil
        guard active, mode == "personal", connection == "online", let keys = credentials else { return }
        let token = generation
        polling = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled && self.active && self.generation == token && self.credentials == keys {
                do {
                    let response = try await self.client.state(keys)
                    guard self.generation == token, self.credentials == keys, !Task.isCancelled else { return }
                    try self.acceptOnline(response, credentials: keys)
                } catch {
                    guard self.generation == token, !Task.isCancelled else { return }
                    if let failure = error as? OOnlineServiceFailure, failure.accessEnded {
                        do { try self.vault.clear() } catch { self.error = error.localizedDescription }
                        self.credentials = nil; self.inviteURL = nil; self.pending = []; self.connection = "local"
                        self.status = "Room access ended · saved snapshot only"
                        self.error = failure.localizedDescription
                        self.polling = nil
                        return
                    }
                    self.status = "Online connection interrupted · retrying"
                    if !self.onlineFailureReported { self.error = "Room updates are paused. \(error.localizedDescription)"; self.onlineFailureReported = true }
                }
                do { try await Task.sleep(nanoseconds: 2_000_000_000) } catch { return }
            }
        }
    }
    private func sendApproval(_ id: UUID, approving: Bool) {
        guard currentRoom?.hostID == profile.id, let keys = credentials, !isBusy else { return }
        let command = OCommand(kind: approving ? "approve" : "reject", memberID: id)
        let token = generation; isBusy = true
        operation = Task { [weak self] in
            guard let self else { return }
            defer { if self.generation == token { self.isBusy = false; self.operation = nil } }
            do {
                let response = try await self.client.send(command, credentials: keys)
                guard self.generation == token, self.credentials == keys else { return }
                try self.acceptOnline(response, credentials: keys)
            } catch { if self.generation == token { self.error = error.localizedDescription } }
        }
    }
}

import XCTest
@testable import Orbit

private final class OTestURLProtocol: URLProtocol {
    private static let lock = NSLock()
    private static var callback: ((URLRequest) throws -> (Int, Data))?
    static func install(_ callback: @escaping (URLRequest) throws -> (Int, Data)) {
        lock.lock(); Self.callback = callback; lock.unlock()
    }
    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "unit.orbit.invalid" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock(); let handler = Self.callback; Self.lock.unlock()
        do {
            guard let handler else { throw URLError(.cannotConnectToHost) }
            let (status, data) = try handler(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

final class OrbitStoreTests: XCTestCase {
    private let service = URL(string: "https://unit.orbit.invalid")!
    private let secret = String(repeating: "a", count: 64)
    private let inviteKey = String(repeating: "b", count: 64)

    @MainActor private func makeStore(demo: Bool = false, client: OOnlineClient? = nil, vault: OCredentialVault? = nil) -> (OrbitStore, URL, UserDefaults) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("OrbitStoreTests-\(UUID().uuidString)")
        let suite = "OrbitStoreTests.\(UUID().uuidString)"; let defaults = UserDefaults(suiteName: suite)!
        let store = OrbitStore(baseURL: directory, defaults: defaults, testing: true, forceDemo: demo,
                               onlineClient: client ?? OOnlineClient(baseURL: service, session: mockSession()),
                               credentialVault: vault ?? OCredentialVault(memoryOnly: true))
        addTeardownBlock {
            await MainActor.run { store.switchMode(true); store.setActive(false) }
            try? FileManager.default.removeItem(at: directory)
            defaults.removePersistentDomain(forName: suite)
        }
        return (store, directory, defaults)
    }

    private func mockSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [OTestURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    @MainActor private func waitUntil(_ condition: () -> Bool, file: StaticString = #filePath, line: UInt = #line) async throws {
        for _ in 0..<100 {
            if condition() { return }
            try await Task.sleep(nanoseconds: 30_000_000)
        }
        XCTFail("Timed out waiting for the store operation", file: file, line: line)
    }

    private func encodedResponse(room: ORoom?, credentials: OOnlineCredentials? = nil, status: String = "active", pending: [OPerson] = []) throws -> Data {
        try OJSON.encoder().encode(OOnlineResponse(status: status, room: room, pending: pending, credentials: credentials, expiresAt: Date().addingTimeInterval(3600)))
    }

    @MainActor func testDemoAndPersonalPlacesRemainSeparateAcrossReload() throws {
        let (store, url, defaults) = makeStore()
        store.finishOnboarding(name: "Ari", demo: false)
        let personal = OPlace(title: "My private café", note: "For later", photoData: Data([1, 2, 3]))
        XCTAssertTrue(store.savePlace(personal))
        let personalProfile = store.profile
        store.switchMode(true)
        XCTAssertFalse(store.places.contains { $0.id == personal.id })
        store.resetDemo()
        store.simulateFriend()
        store.switchMode(false)
        XCTAssertEqual(store.places, [personal])
        XCTAssertEqual(store.profile, personalProfile)
        let reloaded = OrbitStore(baseURL: url, defaults: defaults, testing: true, credentialVault: OCredentialVault(memoryOnly: true))
        XCTAssertEqual(reloaded.places, [personal])
        XCTAssertEqual(reloaded.profile, personalProfile)
        XCTAssertEqual(reloaded.connection, "local")
    }

    @MainActor func testInvalidPlaceDoesNotMutateSavedLibrary() throws {
        let (store, _, _) = makeStore()
        let place = OPlace(title: "Saved")
        XCTAssertTrue(store.savePlace(place))
        XCTAssertFalse(store.savePlace(OPlace(title: "")))
        XCTAssertEqual(store.places, [place])
        XCTAssertNotNil(store.error)
    }

    @MainActor func testCorruptPersonalLibraryFailsClosedWithoutOverwritingFile() throws {
        let (_, url, defaults) = makeStore()
        let bad = Data("original corrupt bytes".utf8)
        try bad.write(to: url.appendingPathComponent("personal.json"))
        let reopened = OrbitStore(baseURL: url, defaults: defaults, testing: true, credentialVault: OCredentialVault(memoryOnly: true))
        XCTAssertNotNil(reopened.error)
        XCTAssertFalse(reopened.savePlace(OPlace(title: "Must not overwrite")))
        XCTAssertEqual(try Data(contentsOf: url.appendingPathComponent("personal.json")), bad)
        reopened.switchMode(true)
        XCTAssertFalse(reopened.places.isEmpty)
        XCTAssertEqual(try Data(contentsOf: url.appendingPathComponent("personal.json")), bad)
    }

    @MainActor func testPersonalModeCannotSimulateFriends() {
        let (store, _, _) = makeStore()
        let before = store.currentRoom
        store.simulateFriend()
        XCTAssertEqual(store.currentRoom, before)
        XCTAssertNotNil(store.error)
    }

    @MainActor func testDisconnectedNearbyGuestDoesNotOptimisticallyCountVote() throws {
        let (store, _, _) = makeStore()
        let host = OPerson(id: UUID(), name: "Host")
        var room = ORoom(title: "Dinner", hostID: host.id, members: [host, store.profile], places: [OPlace(title: "A"), OPlace(title: "B")])
        room.phase = "voting"
        store.currentRoom = room; store.connection = "nearbyGuest"
        let ballot = OBallot(personID: store.profile.id, optionRevision: room.optionRevision,
                             ratings: Dictionary(uniqueKeysWithValues: room.places.map { ($0.id.uuidString.lowercased(), 2) }))
        store.send(OCommand(kind: "vote", ballot: ballot))
        XCTAssertEqual(store.currentRoom, room)
        XCTAssertTrue(store.currentRoom?.ballots.isEmpty == true)
        XCTAssertFalse(store.isBusy)
        XCTAssertNotNil(store.error)
    }

    @MainActor func testUnconnectedSenderCannotInjectHostSnapshot() throws {
        let (store, _, _) = makeStore()
        let before = store.currentRoom
        let impostor = OPerson(id: UUID(), name: "Impostor")
        let room = ORoom(title: "Injected", hostID: impostor.id, members: [impostor, store.profile])
        store.connection = "nearbyGuest"
        store.receiveNearby(try OJSON.encoder().encode(OWire(kind: "snapshot", room: room)), from: impostor.id)
        XCTAssertEqual(store.currentRoom, before)
    }

    @MainActor func testSavedSharedHostRoomIsReadOnlyOffline() throws {
        let (store, url, defaults) = makeStore()
        let room = ORoom(title: "Shared", hostID: store.profile.id, members: [store.profile])
        let archive = OLibrary(profile: store.profile, onboarded: true, places: [], currentRoom: room, history: [], networkRoomIDs: [room.id])
        try OJSON.encoder().encode(archive).write(to: url.appendingPathComponent("personal.json"))
        let reopened = OrbitStore(baseURL: url, defaults: defaults, testing: true, credentialVault: OCredentialVault(memoryOnly: true))
        reopened.send(OCommand(kind: "chat", text: "Must not look confirmed"))
        XCTAssertEqual(reopened.currentRoom, room)
        XCTAssertNotNil(reopened.error)
    }

    func testOnlineInvitesAreRestrictedToConfiguredServiceAndExactParameters() throws {
        let room = UUID()
        let valid = "https://unit.orbit.invalid/join#room=\(room.uuidString)&key=\(inviteKey)"
        XCTAssertEqual(try OOnlineClient.parseInvite(valid, baseURL: service), OOnlineInvite(roomID: room, key: inviteKey))
        XCTAssertEqual(try OOnlineClient.parseInvite("orbit://join?room=\(room.uuidString)&key=\(inviteKey)", baseURL: service).roomID, room)
        for invalid in [valid.replacingOccurrences(of: "unit.orbit.invalid", with: "attacker.invalid"),
                        valid.replacingOccurrences(of: "https:", with: "http:"),
                        valid + "&room=\(UUID().uuidString)", valid + "&extra=true",
                        "orbit://join?room=\(room.uuidString)&key=short",
                        "https://user:pass@unit.orbit.invalid/join#room=\(room.uuidString)&key=\(inviteKey)"] {
            XCTAssertThrowsError(try OOnlineClient.parseInvite(invalid, baseURL: service), invalid)
        }
    }

    func testInvitationURLNeverContainsMemberBearerToken() throws {
        let client = OOnlineClient(baseURL: service)
        let keys = OOnlineCredentials(roomID: UUID(), memberID: UUID(), token: secret, inviteKey: inviteKey)
        let url = try XCTUnwrap(client.invitationURL(for: keys))
        XCTAssertFalse(url.absoluteString.contains(secret))
        XCTAssertTrue(url.absoluteString.contains(inviteKey))
        XCTAssertNil(URLComponents(url: url, resolvingAgainstBaseURL: false)?.query)
        XCTAssertEqual(try OOnlineClient.parseInvite(url.absoluteString, baseURL: service).roomID, keys.roomID)
    }

    @MainActor func testOnlineCreatePersistsSnapshotButCapabilitiesStayOnlyInVault() async throws {
        let vault = OCredentialVault(memoryOnly: true)
        let client = OOnlineClient(baseURL: service, session: mockSession())
        let (store, directory, _) = makeStore(client: client, vault: vault)
        let room = ORoom(title: "Online dinner", hostID: store.profile.id, members: [store.profile])
        let keys = OOnlineCredentials(roomID: room.id, memberID: store.profile.id, token: secret, inviteKey: inviteKey)
        let creation = try encodedResponse(room: room, credentials: keys)
        let state = try encodedResponse(room: room)
        OTestURLProtocol.install { request in (200, request.httpMethod == "POST" ? creation : state) }
        store.createRoom(title: room.title, date: Date().addingTimeInterval(3600), online: true)
        try await waitUntil { !store.isBusy }
        XCTAssertEqual(store.connection, "online")
        XCTAssertEqual(store.currentRoom?.id, room.id)
        XCTAssertEqual(try vault.load(), keys)
        let persisted = try Data(contentsOf: directory.appendingPathComponent("personal.json"))
        XCTAssertFalse(String(decoding: persisted, as: UTF8.self).contains(secret))
        XCTAssertFalse(String(decoding: persisted, as: UTF8.self).contains(inviteKey))
        XCTAssertNotNil(store.inviteURL)
        store.browseNearby()
        XCTAssertEqual(store.connection, "online")
        XCTAssertEqual(try vault.load(), keys)
        XCTAssertNotNil(store.error)
    }

    @MainActor func testOnlinePendingJoinDoesNotExposeOrInventRoomData() async throws {
        let vault = OCredentialVault(memoryOnly: true)
        let client = OOnlineClient(baseURL: service, session: mockSession())
        let (store, _, _) = makeStore(client: client, vault: vault)
        let roomID = UUID()
        let keys = OOnlineCredentials(roomID: roomID, memberID: store.profile.id, token: secret)
        let pendingJoin = try encodedResponse(room: nil, credentials: keys, status: "pending")
        let waiting = try encodedResponse(room: nil, status: "pending")
        OTestURLProtocol.install { request in (200, request.httpMethod == "POST" ? pendingJoin : waiting) }
        store.joinOnline("orbit://join?room=\(roomID.uuidString)&key=\(inviteKey)")
        try await waitUntil { !store.isBusy }
        XCTAssertEqual(store.connection, "online")
        XCTAssertNil(store.currentRoom)
        XCTAssertTrue(store.pending.isEmpty)
        XCTAssertTrue(store.status.contains("approval"))
        XCTAssertNil(store.inviteURL)
    }

    @MainActor func testUnconfirmedOnlineCommandDoesNotFabricateAcknowledgement() async throws {
        let client = OOnlineClient(baseURL: service, session: mockSession())
        let (store, _, _) = makeStore(client: client)
        let room = ORoom(title: "Online dinner", hostID: store.profile.id, members: [store.profile])
        let keys = OOnlineCredentials(roomID: room.id, memberID: store.profile.id, token: secret, inviteKey: inviteKey)
        let creation = try encodedResponse(room: room, credentials: keys), unchanged = try encodedResponse(room: room)
        OTestURLProtocol.install { request in (200, request.url?.path == "/api/rooms" ? creation : unchanged) }
        store.createRoom(title: room.title, date: Date().addingTimeInterval(3600), online: true)
        try await waitUntil { !store.isBusy }
        store.send(OCommand(kind: "chat", text: "Must be acknowledged"))
        try await waitUntil { !store.isBusy }
        XCTAssertTrue(store.currentRoom?.messages.isEmpty == true)
        XCTAssertTrue(store.error?.contains("confirm") == true)
    }

    @MainActor func testExpiredOnlineRoomClearsAccessAndKeepsReadOnlySnapshot() async throws {
        let client = OOnlineClient(baseURL: service, session: mockSession()), vault = OCredentialVault(memoryOnly: true)
        let (store, _, _) = makeStore(client: client, vault: vault)
        let room = ORoom(title: "Ended room", hostID: store.profile.id, members: [store.profile])
        let keys = OOnlineCredentials(roomID: room.id, memberID: store.profile.id, token: secret, inviteKey: inviteKey)
        let creation = try encodedResponse(room: room, credentials: keys)
        OTestURLProtocol.install { request in
            request.httpMethod == "POST" ? (200, creation) : (404, Data("{\"error\":\"This room expired.\"}".utf8))
        }
        store.createRoom(title: room.title, date: Date().addingTimeInterval(3600), online: true)
        try await waitUntil { store.connection == "local" && store.currentRoom != nil }
        XCTAssertNil(try vault.load())
        XCTAssertEqual(store.currentRoom?.id, room.id)
        XCTAssertNil(store.inviteURL)
        store.send(OCommand(kind: "chat", text: "Offline must not count"))
        XCTAssertTrue(store.currentRoom?.messages.isEmpty == true)
    }

    func testOnlineLeaveAndDeleteAcceptTheirTerminalResponses() async throws {
        let client = OOnlineClient(baseURL: service, session: mockSession())
        let keys = OOnlineCredentials(roomID: UUID(), memberID: UUID(), token: secret)
        OTestURLProtocol.install { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer \(keys.token)")
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Orbit-Member"), keys.memberID.uuidString)
            return (200, Data((request.httpMethod == "DELETE" ? "{\"status\":\"deleted\"}" : "{\"status\":\"left\"}").utf8))
        }
        try await client.leave(keys)
        try await client.delete(keys)
    }
}

import Foundation
import Combine
import UIKit
@preconcurrency import MultipeerConnectivity

struct ONearbyRoom: Identifiable, Equatable {
    let id: String
    let title: String
    let code: String
    let hostName: String
}

struct OJoinRequest: Identifiable, Equatable {
    let id: UUID
    let name: String
}

enum ONearbyError: LocalizedError, Equatable {
    case invalid(String)
    var errorDescription: String? {
        if case let .invalid(message) = self { return message }
        return nil
    }
}

/// Small, versioned identity context. Decision content never enters discovery metadata.
struct OJoinEnvelope: Codable, Equatable {
    var version = ONearbyProtocol.version
    let roomID: UUID
    let memberID: UUID
    let name: String

    func encoded() throws -> Data { try JSONEncoder().encode(self) }

    static func decode(_ data: Data, roomID: UUID, localID: UUID) throws -> OJoinEnvelope {
        guard !data.isEmpty, data.count <= ONearbyProtocol.maximumInvitationBytes else {
            throw ONearbyError.invalid("The join request is too large or incomplete.")
        }
        let value = try JSONDecoder().decode(Self.self, from: data)
        guard value.version == ONearbyProtocol.version else {
            throw ONearbyError.invalid("This device uses a different Orbit protocol version.")
        }
        guard value.roomID == roomID, value.memberID != localID else {
            throw ONearbyError.invalid("The request does not belong to this room or device.")
        }
        guard ONearbyProtocol.isValidName(value.name) else {
            throw ONearbyError.invalid("The request needs a name of 1–20 characters without control characters.")
        }
        return value
    }
}

enum ONearbyProtocol {
    static let version = 1
    static let serviceType = "orbit-room"
    static let maximumDataBytes = 256 * 1024
    static let maximumInvitationBytes = 2048
    static let maximumGuests = 7

    static func normalizedName(_ input: String) -> String {
        let cleaned = input.unicodeScalars.filter { !CharacterSet.controlCharacters.contains($0) }
        return String(String.UnicodeScalarView(cleaned)).trimmingCharacters(in: .whitespacesAndNewlines).prefix(20).description
    }

    static func isValidName(_ input: String) -> Bool {
        !input.isEmpty && input.count <= 20 && normalizedName(input) == input
    }

    static func roomCode(_ roomID: UUID) -> String {
        String(roomID.uuidString.replacingOccurrences(of: "-", with: "").prefix(6))
    }

    static func discovery(roomID: UUID, title: String, localID: UUID, name: String) -> [String: String] {
        let safeTitle = String(title.unicodeScalars.filter { !CharacterSet.controlCharacters.contains($0) })
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return ["v": String(version), "room": roomID.uuidString, "title": String(safeTitle.prefix(40)),
                "host": localID.uuidString, "name": name]
    }

    static func decodeDiscovery(_ info: [String: String]?, localID: UUID) -> (room: ONearbyRoom, roomID: UUID, hostID: UUID)? {
        guard let info, info.count <= 8,
              info.values.reduce(0, { $0 + $1.utf8.count }) <= 512,
              info["v"] == String(version),
              let rawRoom = info["room"], let roomID = UUID(uuidString: rawRoom),
              let rawHost = info["host"], let hostID = UUID(uuidString: rawHost), hostID != localID,
              let name = info["name"], isValidName(name),
              let title = info["title"], !title.isEmpty, title.count <= 40,
              title.unicodeScalars.allSatisfy({ !CharacterSet.controlCharacters.contains($0) })
        else { return nil }
        return (ONearbyRoom(id: "\(hostID.uuidString):\(roomID.uuidString)", title: title,
                           code: roomCode(roomID), hostName: name), roomID, hostID)
    }

    static func validatePayload(_ data: Data) throws {
        guard !data.isEmpty, data.count <= maximumDataBytes else {
            throw ONearbyError.invalid("Room messages must contain 1–262,144 bytes.")
        }
    }
}

/// An approved host-and-guests network. Each guest has its own encrypted session with
/// the host, avoiding MCSession's automatic guest-to-guest mesh and preserving host authority.
@MainActor
final class NearbyTransport: NSObject, ObservableObject {
    @Published private(set) var discovered: [ONearbyRoom] = []
    @Published private(set) var pending: [OJoinRequest] = []
    @Published private(set) var connectedIDs: Set<UUID> = []
    @Published private(set) var status = "Offline"
    @Published var error: String?

    var onConnected: ((UUID) -> Void)?
    var onDisconnected: ((UUID) -> Void)?
    var onData: ((Data, UUID) -> Void)?

    var activeRoomID: UUID? { roomID }

    var activeHostID: UUID? {
        switch role {
        case .hosting: return localID
        case .joining, .joined: return expectedHostID
        case .idle, .browsing: return nil
        }
    }

    private enum Role { case idle, hosting, browsing, joining, joined }
    private struct Discovery {
        let room: ONearbyRoom
        let roomID: UUID
        let hostID: UUID
        let peer: MCPeerID
    }
    private struct Invitation {
        let request: OJoinRequest
        let envelope: OJoinEnvelope
        let peer: MCPeerID
        let handler: (Bool, MCSession?) -> Void
        let timeout: Task<Void, Never>
    }
    private final class Binding {
        let memberID: UUID
        let name: String
        let peer: MCPeerID
        let session: MCSession
        var isConnected = false
        var timeout: Task<Void, Never>?
        init(memberID: UUID, name: String, peer: MCPeerID, session: MCSession) {
            self.memberID = memberID; self.name = name; self.peer = peer; self.session = session
        }
    }

    private var role: Role = .idle
    private var localID: UUID?
    private var localName = ""
    private var localPeer: MCPeerID?
    private var roomID: UUID?
    private var expectedHostID: UUID?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var discoveries: [String: Discovery] = [:]
    private var invitations: [UUID: Invitation] = [:]
    private var bindings: [UUID: Binding] = [:]
    private var epoch = UUID()
    private var backgrounded = false
    private var notificationTokens: [NSObjectProtocol] = []

    override init() {
        super.init()
        let center = NotificationCenter.default
        notificationTokens.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor [weak self] in self?.enteredBackground() }
        })
        notificationTokens.append(center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor [weak self] in self?.enteredForeground() }
        })
    }

    deinit {
        for token in notificationTokens { NotificationCenter.default.removeObserver(token) }
    }

    func memberName(for id: UUID) -> String? {
        if id == localID { return localName }
        return bindings[id]?.name
    }

    func memberID(forRequest requestID: UUID) -> UUID? { invitations[requestID]?.envelope.memberID }

    func disconnect(_ memberID: UUID) {
        guard let binding = bindings[memberID] else { return }
        removeBinding(binding, reason: nil)
    }

    func host(roomID: UUID, title: String, localID: UUID, name: String) {
        stop()
        let cleanName = ONearbyProtocol.normalizedName(name)
        let metadata = ONearbyProtocol.discovery(roomID: roomID, title: title, localID: localID, name: cleanName)
        guard ONearbyProtocol.isValidName(cleanName), !(metadata["title"] ?? "").isEmpty else {
            error = "Add your name and a room title before hosting."; return
        }
        configureIdentity(localID: localID, name: cleanName)
        self.roomID = roomID
        role = .hosting
        let service = MCNearbyServiceAdvertiser(peer: localPeer!, discoveryInfo: metadata, serviceType: ONearbyProtocol.serviceType)
        advertiser = service; service.delegate = self
        service.startAdvertisingPeer()
        status = "Room open nearby · waiting for join requests"
    }

    func browse(localID: UUID, name: String) {
        stop()
        let cleanName = ONearbyProtocol.normalizedName(name)
        guard ONearbyProtocol.isValidName(cleanName) else { error = "Add your name before finding a room."; return }
        configureIdentity(localID: localID, name: cleanName)
        role = .browsing
        startBrowser()
    }

    func join(_ discovered: ONearbyRoom) {
        guard role == .browsing, let browser, let localPeer, let localID,
              let found = discoveries[discovered.id], found.room == discovered else {
            error = "This room is no longer available. Search nearby and choose it again."; return
        }
        do {
            let context = try OJoinEnvelope(roomID: found.roomID, memberID: localID, name: localName).encoded()
            let session = MCSession(peer: localPeer, securityIdentity: nil, encryptionPreference: .required)
            session.delegate = self
            let binding = Binding(memberID: found.hostID, name: found.room.hostName, peer: found.peer, session: session)
            bindings[found.hostID] = binding
            expectedHostID = found.hostID; roomID = found.roomID; role = .joining
            error = nil
            status = "Waiting for \(found.room.hostName) to approve · \(found.room.code)"
            startConnectionTimeout(binding, seconds: 36)
            browser.invitePeer(found.peer, to: session, withContext: context, timeout: 32)
        } catch { self.error = "Could not request to join. \(error.localizedDescription)" }
    }

    func accept(_ requestID: UUID) {
        guard role == .hosting, let localPeer, let invite = invitations.removeValue(forKey: requestID) else {
            error = "That join request expired. Ask your friend to try again."; return
        }
        invite.timeout.cancel(); refreshPending()
        guard bindings.count < ONearbyProtocol.maximumGuests,
              bindings[invite.envelope.memberID] == nil,
              !bindings.values.contains(where: { $0.peer == invite.peer }) else {
            invite.handler(false, nil)
            error = "This room is full, or that device is already joining."; return
        }
        let session = MCSession(peer: localPeer, securityIdentity: nil, encryptionPreference: .required)
        session.delegate = self
        let binding = Binding(memberID: invite.envelope.memberID, name: invite.envelope.name, peer: invite.peer, session: session)
        bindings[binding.memberID] = binding
        startConnectionTimeout(binding, seconds: 25)
        status = "Connecting to \(binding.name)…"
        invite.handler(true, session)
    }

    func reject(_ requestID: UUID) {
        guard let invite = invitations.removeValue(forKey: requestID) else { return }
        invite.timeout.cancel(); invite.handler(false, nil)
        refreshPending(); refreshStatus()
    }

    func send(_ data: Data, to memberID: UUID? = nil) throws {
        try ONearbyProtocol.validatePayload(data)
        guard !backgrounded else { throw ONearbyError.invalid("Orbit is in the background. Open the room before sending.") }
        let targets: [Binding]
        if let memberID {
            guard let binding = bindings[memberID], binding.isConnected, connectedIDs.contains(memberID) else {
                throw ONearbyError.invalid("That person is disconnected. Rejoin the room before sending.")
            }
            targets = [binding]
        } else {
            targets = bindings.values.filter { $0.isConnected && connectedIDs.contains($0.memberID) }
        }
        guard !targets.isEmpty else { throw ONearbyError.invalid("Nobody is connected yet. Wait for the room connection before sending.") }
        for binding in targets {
            guard binding.session.connectedPeers.contains(binding.peer) else {
                throw ONearbyError.invalid("The connection to \(binding.name) was lost. Rejoin the room and try again.")
            }
            do { try binding.session.send(data, toPeers: [binding.peer], with: .reliable) }
            catch { throw ONearbyError.invalid("Could not send to \(binding.name). \(error.localizedDescription)") }
        }
    }

    /// Explicit stop clears transport state without replaying stale disconnect callbacks.
    /// The owning store handles its own intentional leave action.
    func stop() {
        epoch = UUID()
        role = .idle
        for invite in invitations.values { invite.timeout.cancel(); invite.handler(false, nil) }
        invitations.removeAll(); pending = []
        advertiser?.delegate = nil; advertiser?.stopAdvertisingPeer(); advertiser = nil
        browser?.delegate = nil; browser?.stopBrowsingForPeers(); browser = nil
        let old = Array(bindings.values)
        bindings.removeAll(); connectedIDs = []
        for binding in old { binding.timeout?.cancel(); binding.session.delegate = nil; binding.session.disconnect() }
        discoveries.removeAll(); discovered = []
        localID = nil; localName = ""; localPeer = nil; roomID = nil; expectedHostID = nil
        status = "Offline"; error = nil
    }

    private func configureIdentity(localID: UUID, name: String) {
        self.localID = localID; localName = name
        // Peer displayName is intentionally small; identity is bound to approved context.
        localPeer = MCPeerID(displayName: "Orbit-\(localID.uuidString.prefix(8))")
        backgrounded = UIApplication.shared.applicationState == .background
    }

    private func startBrowser() {
        guard let localPeer else { return }
        browser?.delegate = nil; browser?.stopBrowsingForPeers()
        let service = MCNearbyServiceBrowser(peer: localPeer, serviceType: ONearbyProtocol.serviceType)
        browser = service; service.delegate = self
        service.startBrowsingForPeers()
        status = "Looking nearby · keep both devices in Orbit"
    }

    private func refreshDiscovered() {
        discovered = discoveries.values.map(\.room).sorted {
            if $0.title != $1.title { return $0.title.localizedStandardCompare($1.title) == .orderedAscending }
            return $0.id < $1.id
        }
        if role == .browsing { status = discovered.isEmpty ? "Looking nearby · keep both devices in Orbit" : "\(discovered.count) nearby room\(discovered.count == 1 ? "" : "s") found" }
    }

    private func refreshPending() { pending = invitations.values.map(\.request).sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending } }

    private func refreshStatus() {
        if backgrounded, role != .idle { status = "In background · nearby connections may pause"; return }
        switch role {
        case .idle: status = "Offline"
        case .hosting:
            status = connectedIDs.isEmpty ? "Room open nearby · waiting for join requests" : "\(connectedIDs.count) guest\(connectedIDs.count == 1 ? "" : "s") connected nearby"
        case .browsing: refreshDiscovered()
        case .joining: status = "Waiting for host approval or connection…"
        case .joined: status = "Connected to \(expectedHostID.flatMap { bindings[$0]?.name } ?? "host") nearby"
        }
    }

    private func binding(for session: MCSession, peer: MCPeerID) -> Binding? {
        bindings.values.first { $0.session === session && $0.peer == peer }
    }

    private func startConnectionTimeout(_ binding: Binding, seconds: UInt64) {
        let token = epoch
        let memberID = binding.memberID
        let expectedSession = binding.session
        binding.timeout = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: seconds * 1_000_000_000) } catch { return }
            guard let self, self.epoch == token, let current = self.bindings[memberID],
                  current.session === expectedSession, !current.isConnected else { return }
            self.removeBinding(current, reason: "The connection timed out. Keep both devices open, check Local Network permission in Settings, and ask the host to approve a new request.")
        }
    }

    private func removeBinding(_ binding: Binding, reason: String?) {
        guard bindings[binding.memberID]?.session === binding.session else { return }
        let wasConnected = connectedIDs.contains(binding.memberID)
        bindings.removeValue(forKey: binding.memberID)
        connectedIDs.remove(binding.memberID)
        binding.timeout?.cancel(); binding.session.delegate = nil; binding.session.disconnect()
        if role == .joining || role == .joined {
            expectedHostID = nil; roomID = nil; role = .browsing
            discoveries.removeAll(); discovered = []
            startBrowser()
        }
        refreshStatus()
        if let reason { error = reason }
        if wasConnected { onDisconnected?(binding.memberID) }
    }

    private func enteredBackground() {
        backgrounded = true
        if role != .idle {
            advertiser?.stopAdvertisingPeer(); browser?.stopBrowsingForPeers()
            for id in Array(invitations.keys) { reject(id) }
            refreshStatus()
        }
    }

    private func enteredForeground() {
        backgrounded = false
        if role == .hosting { advertiser?.startAdvertisingPeer() }
        if role == .browsing || role == .joining { browser?.startBrowsingForPeers() }
        for binding in Array(bindings.values) where binding.isConnected && !binding.session.connectedPeers.contains(binding.peer) {
            removeBinding(binding, reason: "The nearby connection ended while Orbit was in the background. Rejoin the room to sync again.")
        }
        refreshStatus()
    }

    private func receivedInvitation(advertiser: MCNearbyServiceAdvertiser, peer: MCPeerID, context: Data?, handler: @escaping (Bool, MCSession?) -> Void) {
        guard self.advertiser === advertiser, role == .hosting, !backgrounded,
              let roomID, let localID, let context else { handler(false, nil); return }
        do {
            let envelope = try OJoinEnvelope.decode(context, roomID: roomID, localID: localID)
            guard bindings.count + invitations.count < ONearbyProtocol.maximumGuests,
                  bindings[envelope.memberID] == nil,
                  !bindings.values.contains(where: { $0.peer == peer }),
                  !invitations.values.contains(where: { $0.envelope.memberID == envelope.memberID || $0.peer == peer }) else {
                handler(false, nil); return
            }
            let request = OJoinRequest(id: UUID(), name: envelope.name)
            let token = epoch
            let timeout = Task { @MainActor [weak self] in
                do { try await Task.sleep(nanoseconds: 25_000_000_000) } catch { return }
                guard let self, self.epoch == token, let invite = self.invitations.removeValue(forKey: request.id) else { return }
                invite.handler(false, nil); self.refreshPending(); self.refreshStatus()
                self.error = "\(request.name)’s request expired. Ask them to try joining again."
            }
            invitations[request.id] = Invitation(request: request, envelope: envelope, peer: peer, handler: handler, timeout: timeout)
            refreshPending()
            status = "\(request.name) would like to join"
        } catch { handler(false, nil) }
    }

    private func stateChanged(session: MCSession, peer: MCPeerID, state: MCSessionState) {
        guard let binding = binding(for: session, peer: peer) else { return }
        switch state {
        case .connecting: status = "Connecting to \(binding.name)…"
        case .connected:
            guard !binding.isConnected else { return }
            binding.timeout?.cancel(); binding.timeout = nil; binding.isConnected = true
            connectedIDs.insert(binding.memberID)
            if role == .joining {
                role = .joined
                browser?.stopBrowsingForPeers()
                discoveries.removeAll(); discovered = []
            }
            error = nil; refreshStatus()
            onConnected?(binding.memberID)
        case .notConnected:
            removeBinding(binding, reason: binding.isConnected ? "\(binding.name) disconnected. Rejoin the room to sync again." : "Could not join. The host may have declined, left, or lost connection. Ask them to approve a new request.")
        @unknown default:
            removeBinding(binding, reason: "The nearby connection entered an unsupported state. Rejoin the room.")
        }
    }
}

extension NearbyTransport: MCNearbyServiceAdvertiserDelegate {
    nonisolated func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                                withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        Task { @MainActor [weak self] in
            guard let self else { invitationHandler(false, nil); return }
            self.receivedInvitation(advertiser: advertiser, peer: peerID, context: context, handler: invitationHandler)
        }
    }

    nonisolated func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        Task { @MainActor [weak self] in
            guard let self, self.advertiser === advertiser else { return }
            self.status = "Nearby hosting unavailable"
            self.error = "Could not open the room nearby. Allow Local Network access in iPhone Settings and keep Wi-Fi enabled. \(error.localizedDescription)"
        }
    }
}

extension NearbyTransport: MCNearbyServiceBrowserDelegate {
    nonisolated func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        Task { @MainActor [weak self] in
            guard let self, self.browser === browser, self.role == .browsing || self.role == .joining,
                  let localID = self.localID, let parsed = ONearbyProtocol.decodeDiscovery(info, localID: localID) else { return }
            self.discoveries[parsed.room.id] = Discovery(room: parsed.room, roomID: parsed.roomID, hostID: parsed.hostID, peer: peerID)
            self.refreshDiscovered()
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        Task { @MainActor [weak self] in
            guard let self, self.browser === browser else { return }
            self.discoveries = self.discoveries.filter { $0.value.peer != peerID }
            self.refreshDiscovered()
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        Task { @MainActor [weak self] in
            guard let self, self.browser === browser else { return }
            self.status = "Nearby search unavailable"
            self.error = "Could not search nearby. Allow Local Network access in iPhone Settings and keep Wi-Fi enabled. \(error.localizedDescription)"
        }
    }
}

extension NearbyTransport: MCSessionDelegate {
    nonisolated func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        Task { @MainActor [weak self] in self?.stateChanged(session: session, peer: peerID, state: state) }
    }

    nonisolated func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard !data.isEmpty, data.count <= ONearbyProtocol.maximumDataBytes else { return }
        Task { @MainActor [weak self] in
            guard let self, let binding = self.binding(for: session, peer: peerID),
                  binding.isConnected, self.connectedIDs.contains(binding.memberID), !self.backgrounded else { return }
            self.onData?(data, binding.memberID)
        }
    }

    nonisolated func session(_ session: MCSession, didReceiveCertificate certificate: [Any]?, fromPeer peerID: MCPeerID,
                             certificateHandler: @escaping (Bool) -> Void) {
        Task { @MainActor [weak self] in
            // Encryption is required. Identity trust comes from the explicit approved invite
            // and selected discovery peer, not an unverified display name or self-signed cert.
            certificateHandler(self?.binding(for: session, peer: peerID) != nil)
        }
    }

    nonisolated func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) { stream.close() }
    nonisolated func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) { progress.cancel() }
    nonisolated func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

import Foundation
import Security

struct OOnlineCredentials: Codable, Equatable {
    var roomID: UUID
    var memberID: UUID
    var token: String
    var inviteKey: String?
    func validate() throws {
        guard (16...512).contains(token.utf8.count),
              inviteKey == nil || (16...512).contains(inviteKey!.utf8.count),
              !token.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else {
            throw OError.message("The room service returned invalid credentials.")
        }
    }
}

struct OOnlineResponse: Codable {
    var status: String
    var room: ORoom?
    var pending: [OPerson] = []
    var credentials: OOnlineCredentials?
    var expiresAt: Date?
    func validate() throws {
        guard ["active", "pending"].contains(status), pending.count <= 7,
              Set(pending.map(\.id)).count == pending.count,
              pending.allSatisfy({ ONearbyProtocol.isValidName($0.name) }),
              status != "pending" || room == nil else { throw OError.message("The room service returned an invalid response.") }
        if let room { try room.validate() }
        if let credentials { try credentials.validate() }
    }
}

struct OOnlineInvite: Equatable {
    let roomID: UUID
    let key: String
}

struct OOnlineServiceFailure: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
    var accessEnded: Bool { [401, 403, 404].contains(status) }
}

final class OOnlineClient: NSObject, URLSessionTaskDelegate {
    let baseURL: URL?
    private let suppliedSession: URLSession?
    private lazy var session: URLSession = {
        if let suppliedSession { return suppliedSession }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 30
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    init(baseURL: URL? = nil, session: URLSession? = nil) {
        suppliedSession = session
        let configured = baseURL ?? (Bundle.main.object(forInfoDictionaryKey: "OrbitServiceURL") as? String).flatMap(URL.init(string:))
        if let configured, configured.scheme?.lowercased() == "https", configured.host != nil,
           configured.user == nil, configured.password == nil, configured.query == nil, configured.fragment == nil,
           configured.path.isEmpty || configured.path == "/" { self.baseURL = configured }
        else { self.baseURL = nil }
        super.init()
    }

    static func parseInvite(_ value: String, baseURL: URL?) throws -> OOnlineInvite {
        guard value.utf8.count <= 3000,
              let components = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
              components.user == nil, components.password == nil else { throw OError.message("That is not a valid Orbit invitation.") }
        let rawItems: [URLQueryItem]
        if components.scheme?.lowercased() == "orbit", components.host?.lowercased() == "join",
           components.path.isEmpty || components.path == "/", components.fragment == nil {
            rawItems = components.queryItems ?? []
        } else if components.scheme?.lowercased() == "https", let baseURL,
                  components.host?.lowercased() == baseURL.host?.lowercased(), components.port == baseURL.port,
                  components.path == "/join", components.query == nil,
                  let fragment = components.fragment, let fragmentParts = URLComponents(string: "?" + fragment) {
            rawItems = fragmentParts.queryItems ?? []
        } else { throw OError.message("Use the invitation from this Orbit service or an orbit://join link.") }
        guard rawItems.count == 2, Set(rawItems.map(\.name)) == ["room", "key"],
              let roomString = rawItems.first(where: { $0.name == "room" })?.value, let roomID = UUID(uuidString: roomString),
              let key = rawItems.first(where: { $0.name == "key" })?.value,
              (16...512).contains(key.utf8.count),
              key.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.contains($0) || "-_".unicodeScalars.contains($0) })
        else { throw OError.message("The invitation is missing its room or valid invitation key.") }
        return OOnlineInvite(roomID: roomID, key: key)
    }

    func invitationURL(for credentials: OOnlineCredentials) -> URL? {
        guard let baseURL, let key = credentials.inviteKey, var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { return nil }
        components.path = "/join"
        var fragment = URLComponents(); fragment.queryItems = [URLQueryItem(name: "room", value: credentials.roomID.uuidString), URLQueryItem(name: "key", value: key)]
        components.percentEncodedFragment = fragment.percentEncodedQuery
        return components.url
    }

    func create(title: String, profile: OPerson, eventDate: Date) async throws -> OOnlineResponse {
        struct Body: Encodable { let title: String; let profile: OPerson; let eventDate: Date }
        return try await request(path: "/api/rooms", method: "POST", body: OJSON.encoder().encode(Body(title: title, profile: profile, eventDate: eventDate)))
    }
    func join(invite: OOnlineInvite, profile: OPerson) async throws -> OOnlineResponse {
        struct Body: Encodable { let roomID: UUID; let inviteKey: String; let profile: OPerson }
        return try await request(path: "/api/join", method: "POST", body: OJSON.encoder().encode(Body(roomID: invite.roomID, inviteKey: invite.key, profile: profile)))
    }
    func state(_ credentials: OOnlineCredentials) async throws -> OOnlineResponse {
        try await request(path: "/api/rooms/\(credentials.roomID.uuidString)", method: "GET", credentials: credentials)
    }
    func send(_ command: OCommand, credentials: OOnlineCredentials) async throws -> OOnlineResponse {
        try await request(path: "/api/rooms/\(credentials.roomID.uuidString)", method: "POST", credentials: credentials, body: OJSON.encoder().encode(command))
    }
    func delete(_ credentials: OOnlineCredentials) async throws {
        _ = try await requestData(path: "/api/rooms/\(credentials.roomID.uuidString)", method: "DELETE", credentials: credentials)
    }
    func leave(_ credentials: OOnlineCredentials) async throws {
        let data = try await requestData(path: "/api/rooms/\(credentials.roomID.uuidString)", method: "POST", credentials: credentials,
                                         body: OJSON.encoder().encode(OCommand(kind: "leave")))
        struct Response: Decodable { let status: String }
        guard try JSONDecoder().decode(Response.self, from: data).status == "left" else {
            throw OError.message("The service did not confirm that you left the room. Try again.")
        }
    }

    private func request(path: String, method: String, credentials: OOnlineCredentials? = nil, body: Data? = nil) async throws -> OOnlineResponse {
        let data = try await requestData(path: path, method: method, credentials: credentials, body: body)
        let value = try OJSON.decoder().decode(OOnlineResponse.self, from: data)
        try value.validate()
        return value
    }
    private func requestData(path: String, method: String, credentials: OOnlineCredentials? = nil, body: Data? = nil) async throws -> Data {
        guard let baseURL, let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw OError.message("The online room service is not configured in this build. Nearby rooms still work.")
        }
        if let body, body.count > ONearbyProtocol.maximumDataBytes { throw OError.message("This update is too large to send. Share fewer details.") }
        var request = URLRequest(url: url); request.httpMethod = method; request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let credentials {
            try credentials.validate()
            request.setValue("Bearer \(credentials.token)", forHTTPHeaderField: "Authorization")
            request.setValue(credentials.memberID.uuidString, forHTTPHeaderField: "X-Orbit-Member")
        }
        let (bytes, response) = try await session.bytes(for: request)
        guard let response = response as? HTTPURLResponse else { throw OError.message("The online room service did not respond correctly.") }
        guard response.expectedContentLength <= 1_000_000 else { throw OError.message("The room service response was too large.") }
        var data = Data(); data.reserveCapacity(32_768)
        for try await byte in bytes {
            guard data.count < 1_000_000 else { throw OError.message("The room service response was too large.") }
            data.append(byte)
        }
        guard (200...299).contains(response.statusCode) else {
            struct Failure: Decodable { let error: String }
            let detail = (try? JSONDecoder().decode(Failure.self, from: data).error).map { String($0.prefix(500)) }
            let fallback: String
            switch response.statusCode {
            case 401, 403: fallback = "This room access is no longer valid. Ask the host for a new invitation."
            case 404: fallback = "This room has ended or expired. Ask the host to create a new room."
            case 429: fallback = "Too many requests. Wait a moment and try again."
            default: fallback = "The room service could not complete this update. Try again."
            }
            throw OOnlineServiceFailure(status: response.statusCode, message: detail ?? fallback)
        }
        return data
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

/// Only access capabilities go into Keychain; no bearer tokens enter the library JSON.
final class OCredentialVault {
    private let service: String
    private let memoryOnly: Bool
    private var memory: OOnlineCredentials?
    init(service: String = "com.besleyslab.orbit.rooms", memoryOnly: Bool = false) { self.service = service; self.memoryOnly = memoryOnly }
    private var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "active-room"] }
    func load() throws -> OOnlineCredentials? {
        if memoryOnly { return memory }
        var request = query; request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw OError.message("Saved room access could not be read from Keychain.") }
        let credentials = try JSONDecoder().decode(OOnlineCredentials.self, from: data)
        try credentials.validate(); return credentials
    }
    func save(_ credentials: OOnlineCredentials) throws {
        try credentials.validate()
        if memoryOnly { memory = credentials; return }
        let data = try JSONEncoder().encode(credentials)
        let update = [kSecValueData as String: data]
        let result = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if result == errSecItemNotFound {
            var insert = query; insert[kSecValueData as String] = data
            insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(insert as CFDictionary, nil) == errSecSuccess else { throw OError.message("Room access could not be saved securely. Try again before leaving this screen.") }
        } else if result != errSecSuccess { throw OError.message("Room access could not be updated in Keychain.") }
    }
    func clear() throws {
        if memoryOnly { memory = nil; return }
        let result = SecItemDelete(query as CFDictionary)
        guard result == errSecSuccess || result == errSecItemNotFound else { throw OError.message("Saved room access could not be removed from Keychain.") }
    }
}

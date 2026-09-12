import XCTest
@testable import Orbit

final class NearbyProtocolTests: XCTestCase {
    func testInvitationRoundTripPreservesOnlyJoinIdentity() throws {
        let room = UUID(), member = UUID()
        let envelope = OJoinEnvelope(roomID: room, memberID: member, name: "Maya")
        let data = try envelope.encoded()
        let decoded = try OJoinEnvelope.decode(data, roomID: room, localID: UUID())
        XCTAssertEqual(decoded, envelope)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(Set(object.keys), ["version", "roomID", "memberID", "name"])
    }

    func testInvitationForAnotherRoomIsRejected() throws {
        let data = try OJoinEnvelope(roomID: UUID(), memberID: UUID(), name: "Maya").encoded()
        XCTAssertThrowsError(try OJoinEnvelope.decode(data, roomID: UUID(), localID: UUID()))
    }

    func testInvitationCannotClaimHostsIdentity() throws {
        let room = UUID(), host = UUID()
        let data = try OJoinEnvelope(roomID: room, memberID: host, name: "Host").encoded()
        XCTAssertThrowsError(try OJoinEnvelope.decode(data, roomID: room, localID: host))
    }

    func testUnsupportedInvitationVersionIsRejected() throws {
        let room = UUID()
        var envelope = OJoinEnvelope(roomID: room, memberID: UUID(), name: "Ari")
        envelope.version = 99
        XCTAssertThrowsError(try OJoinEnvelope.decode(envelope.encoded(), roomID: room, localID: UUID()))
    }

    func testInvalidAndOversizedInvitationDataAreRejected() {
        let room = UUID(), host = UUID()
        XCTAssertThrowsError(try OJoinEnvelope.decode(Data(), roomID: room, localID: host))
        XCTAssertThrowsError(try OJoinEnvelope.decode(Data("not JSON".utf8), roomID: room, localID: host))
        XCTAssertThrowsError(try OJoinEnvelope.decode(Data(repeating: 32, count: 2049), roomID: room, localID: host))
    }

    func testUntrustedNamesMustAlreadyBeNormalized() throws {
        let room = UUID()
        for name in ["", "  ", " Ari", "Ari\n", "Ari\tTest", String(repeating: "x", count: 21)] {
            let data = try OJoinEnvelope(roomID: room, memberID: UUID(), name: name).encoded()
            XCTAssertThrowsError(try OJoinEnvelope.decode(data, roomID: room, localID: UUID()), name)
        }
        XCTAssertTrue(ONearbyProtocol.isValidName("Zoë 🌱"))
        XCTAssertEqual(ONearbyProtocol.normalizedName("  Ari\n  "), "Ari")
    }

    func testDiscoveryRoundTripHasStableIDAndNoRoomContent() throws {
        let room = UUID(), host = UUID()
        let info = ONearbyProtocol.discovery(roomID: room, title: "Friday dinner", localID: host, name: "Jordan")
        XCTAssertEqual(Set(info.keys), ["v", "room", "title", "host", "name"])
        let decoded = try XCTUnwrap(ONearbyProtocol.decodeDiscovery(info, localID: UUID()))
        XCTAssertEqual(decoded.roomID, room)
        XCTAssertEqual(decoded.hostID, host)
        XCTAssertEqual(decoded.room.title, "Friday dinner")
        XCTAssertEqual(decoded.room.hostName, "Jordan")
        XCTAssertEqual(decoded.room.code, ONearbyProtocol.roomCode(room))
        XCTAssertEqual(decoded.room.id, "\(host.uuidString):\(room.uuidString)")
    }

    func testDiscoveryIgnoresOwnDeviceAndUnknownVersions() {
        let host = UUID()
        var info = ONearbyProtocol.discovery(roomID: UUID(), title: "Dinner", localID: host, name: "Ari")
        XCTAssertNil(ONearbyProtocol.decodeDiscovery(info, localID: host))
        info["v"] = "99"
        XCTAssertNil(ONearbyProtocol.decodeDiscovery(info, localID: UUID()))
    }

    func testMalformedDiscoveryMetadataIsRejected() {
        let base = ONearbyProtocol.discovery(roomID: UUID(), title: "Dinner", localID: UUID(), name: "Ari")
        for (key, value) in [("room", "bad"), ("host", "bad"), ("name", ""), ("title", ""),
                             ("title", "Dinner\nSecret"), ("title", String(repeating: "a", count: 41))] {
            var info = base; info[key] = value
            XCTAssertNil(ONearbyProtocol.decodeDiscovery(info, localID: UUID()), key)
        }
        var large = base; large["extra"] = String(repeating: "a", count: 600)
        XCTAssertNil(ONearbyProtocol.decodeDiscovery(large, localID: UUID()))
        XCTAssertNil(ONearbyProtocol.decodeDiscovery(nil, localID: UUID()))
    }

    func testDiscoveryTitleIsBoundedAndStripsControlCharacters() {
        let info = ONearbyProtocol.discovery(roomID: UUID(), title: "  " + String(repeating: "a", count: 100) + "\n", localID: UUID(), name: "Ari")
        XCTAssertEqual(info["title"]?.count, 40)
        XCTAssertFalse(info["title"]?.contains("\n") == true)
    }

    func testPayloadBoundaries() {
        XCTAssertThrowsError(try ONearbyProtocol.validatePayload(Data()))
        XCTAssertNoThrow(try ONearbyProtocol.validatePayload(Data([1])))
        XCTAssertNoThrow(try ONearbyProtocol.validatePayload(Data(repeating: 1, count: 262_144)))
        XCTAssertThrowsError(try ONearbyProtocol.validatePayload(Data(repeating: 1, count: 262_145)))
    }

    @MainActor func testStoppedTransportHasNoActiveRoomOrHostAndRejectsSend() {
        let transport = NearbyTransport()
        transport.stop()
        XCTAssertTrue(transport.connectedIDs.isEmpty)
        XCTAssertTrue(transport.pending.isEmpty)
        XCTAssertTrue(transport.discovered.isEmpty)
        XCTAssertNil(transport.activeHostID)
        XCTAssertNil(transport.activeRoomID)
        XCTAssertEqual(transport.status, "Offline")
        XCTAssertThrowsError(try transport.send(Data([1])))
    }
}

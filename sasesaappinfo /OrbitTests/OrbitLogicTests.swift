import XCTest
@testable import Orbit

final class OrbitLogicTests: XCTestCase {
    private func room() -> ORoom {
        let host = OPerson(id: UUID(), name: "Host")
        return ORoom(title: "Friday dinner", hostID: host.id,
                     members: [host, OPerson(id: UUID(), name: "Maya"), OPerson(id: UUID(), name: "Lee")],
                     places: [OPlace(title: "Olive"), OPlace(title: "Noodle")])
    }

    private func ballot(in room: ORoom, personID: UUID, values: [Int]) -> OBallot {
        OBallot(personID: personID, optionRevision: room.optionRevision,
                ratings: Dictionary(uniqueKeysWithValues: zip(room.places.map { $0.id.uuidString.lowercased() }, values)))
    }

    func testPlaceValidationRejectsOversizedAndUnsafeValues() throws {
        let place = OPlace(title: "A good idea", latitude: 40.7, longitude: -74.0, url: "https://example.com")
        XCTAssertNoThrow(try place.validate())
        var invalid = place; invalid.title = String(repeating: "x", count: 121)
        XCTAssertThrowsError(try invalid.validate())
        invalid = place; invalid.note = String(repeating: "x", count: 1_001)
        XCTAssertThrowsError(try invalid.validate())
        invalid = place; invalid.longitude = nil
        XCTAssertThrowsError(try invalid.validate())
        invalid = place; invalid.latitude = .infinity
        XCTAssertThrowsError(try invalid.validate())
        invalid = place; invalid.url = "javascript:alert(1)"
        XCTAssertThrowsError(try invalid.validate())
        invalid = place; invalid.photoData = Data(repeating: 0, count: 3_000_001)
        XCTAssertThrowsError(try invalid.validate())
    }

    func testSuggestionSharesPlaceDetailsWithoutPrivatePhoto() throws {
        var current = room()
        let guest = current.members[1].id
        let original = OPlace(title: "A saved place", note: "Try the noodles", latitude: 40.7, longitude: -74,
                              photoData: Data([1, 2, 3]))
        try current.apply(OCommand(kind: "suggest", place: original), from: guest)
        let shared = try XCTUnwrap(current.places.first { $0.id == original.id })
        XCTAssertNil(shared.photoData)
        XCTAssertEqual(shared.latitude, original.latitude)
        XCTAssertEqual(shared.note, original.note)
        XCTAssertEqual(original.photoData, Data([1, 2, 3]))
    }

    func testOnlyHostCanChangeVotingPhaseOrChoosePlan() throws {
        var current = room()
        let guest = current.members[1].id
        let original = current
        XCTAssertThrowsError(try current.apply(OCommand(kind: "start"), from: guest))
        XCTAssertThrowsError(try current.apply(OCommand(kind: "remove", placeID: current.places[0].id), from: guest))
        XCTAssertEqual(current, original)
        try current.apply(OCommand(kind: "start"), from: current.hostID)
        try current.apply(OCommand(kind: "vote", ballot: ballot(in: current, personID: guest, values: [2, 1])), from: guest)
        XCTAssertThrowsError(try current.apply(OCommand(kind: "choose", placeID: current.places[0].id), from: guest))
        XCTAssertThrowsError(try current.apply(OCommand(kind: "reopen"), from: guest))
        XCTAssertEqual(current.phase, "voting")
        XCTAssertNil(current.selectedPlaceID)
    }

    func testBallotMustBelongToSenderAndMatchEveryCurrentOption() throws {
        var current = room()
        try current.apply(OCommand(kind: "start"), from: current.hostID)
        let guest = current.members[1].id
        let legitimate = ballot(in: current, personID: guest, values: [2, -1])
        XCTAssertNoThrow(try current.validate(legitimate))
        var invalid = legitimate; invalid.optionRevision = UUID()
        XCTAssertThrowsError(try current.validate(invalid))
        invalid = legitimate; invalid.ratings.removeValue(forKey: current.places[0].id.uuidString.lowercased())
        XCTAssertThrowsError(try current.validate(invalid))
        invalid = legitimate; invalid.ratings[current.places[0].id.uuidString.lowercased()] = 0
        XCTAssertThrowsError(try current.validate(invalid))
        let impersonated = ballot(in: current, personID: current.hostID, values: [2, 2])
        XCTAssertThrowsError(try current.apply(OCommand(kind: "vote", ballot: impersonated), from: guest))
        XCTAssertTrue(current.ballots.isEmpty)
    }

    func testDuplicateCommandIsAppliedExactlyOnce() throws {
        var current = room()
        let command = OCommand(kind: "chat", text: "Seven works for me.")
        try current.apply(command, from: current.members[1].id)
        let afterFirst = current
        try current.apply(command, from: current.members[1].id)
        XCTAssertEqual(current, afterFirst)
        XCTAssertEqual(current.messages.count, 1)
        XCTAssertEqual(current.appliedIDs.filter { $0 == command.id }.count, 1)
    }

    func testReopeningClearsOldVotesAndInvalidatesTheirRevision() throws {
        var current = room()
        try current.apply(OCommand(kind: "start"), from: current.hostID)
        let previous = ballot(in: current, personID: current.members[1].id, values: [2, 1])
        try current.apply(OCommand(kind: "vote", ballot: previous), from: previous.personID)
        try current.apply(OCommand(kind: "choose", placeID: current.places[0].id), from: current.hostID)
        try current.apply(OCommand(kind: "reopen"), from: current.hostID)
        XCTAssertEqual(current.phase, "collecting")
        XCTAssertTrue(current.ballots.isEmpty)
        XCTAssertNil(current.selectedPlaceID)
        XCTAssertNotEqual(current.optionRevision, previous.optionRevision)
        XCTAssertThrowsError(try current.validate(previous))
    }

    func testRankingsPrioritizeObjectionsThenSupportThenIntensity() throws {
        var current = room()
        current.places = [OPlace(title: "Objection"), OPlace(title: "Strong support"),
                          OPlace(title: "Everyone yes"), OPlace(title: "Weak support")]
        current.phase = "voting"
        let byPerson = [[2, 2, 1, 1], [2, 1, 1, 1], [-2, -1, 1, -1]]
        current.ballots = zip(current.members, byPerson).map { ballot(in: current, personID: $0.0.id, values: $0.1) }
        try current.validate()
        XCTAssertEqual(current.rankings.map(\.place.title), ["Everyone yes", "Strong support", "Weak support", "Objection"])
        XCTAssertTrue(current.pending.isEmpty)
        XCTAssertEqual(current.rankings[0].responses, 3)
        XCTAssertEqual(current.rankings.last?.strongNo, 1)
    }

    func testRoomRejectsDuplicateMembersAndMissingChosenPlace() {
        var current = room()
        current.members.append(current.members[1])
        XCTAssertThrowsError(try current.validate())
        current = room(); current.phase = "decided"; current.selectedPlaceID = UUID()
        XCTAssertThrowsError(try current.validate())
        current = room(); current.members = (0..<9).map { OPerson(id: UUID(), name: "Person \($0)") }; current.hostID = current.members[0].id
        XCTAssertThrowsError(try current.validate())
    }

    func testEmojiChatKeepsNewestMessagesWithinNearbyPacketBudget() throws {
        var current = room()
        var sent: [String] = []
        for index in 0..<200 {
            let prefix = "\(index):"
            let text = prefix + String(repeating: "🙂", count: 1_000 - prefix.count)
            sent.append(text)
            try current.apply(OCommand(kind: "chat", text: text), from: current.members[1].id)
            let snapshot = try OJSON.encoder().encode(OWire(kind: "snapshot", room: current))
            XCTAssertLessThan(snapshot.count, 256 * 1024)
        }
        XCTAssertLessThan(current.messages.count, sent.count)
        XCTAssertEqual(current.messages.map(\.text), Array(sent.suffix(current.messages.count)))
        XCTAssertEqual(current.messages.last?.text, sent.last)
        XCTAssertFalse(current.messages.contains { $0.text == sent.first })
    }
}

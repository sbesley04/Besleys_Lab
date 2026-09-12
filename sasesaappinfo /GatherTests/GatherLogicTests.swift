import XCTest
@testable import Gather

final class GatherLogicTests: XCTestCase {
    private func fixture() -> GSession {
        GSession(title: "Dinner", participants: [GParticipant(name: "Ari"), GParticipant(name: "Bea"), GParticipant(name: "Cam")],
                 candidates: [GCandidate(title: "A"), GCandidate(title: "B"), GCandidate(title: "C")])
    }
    private func ballot(_ session: GSession, person: Int, values: [Int], time: TimeInterval = 1000) -> GBallot {
        GBallot(sessionID: session.id, revision: session.revision, participantID: session.participants[person].id,
                ratings: Dictionary(uniqueKeysWithValues: zip(session.candidates.map(\.id), values)), submittedAt: Date(timeIntervalSince1970: time))
    }
    @MainActor private func makeStore(forceDemo: Bool = false) -> GStore {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("GatherTests-\(UUID().uuidString)")
        let suite = "GatherTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        addTeardownBlock { try? FileManager.default.removeItem(at: url); defaults.removePersistentDomain(forName: suite) }
        return GStore(baseURL: url, defaults: defaults, forceDemo: forceDemo)
    }

    func testRankingPrioritizesObjectionsBeforeScore() {
        var session = fixture()
        session.ballots = [ballot(session, person: 0, values: [2, 1, -1]), ballot(session, person: 1, values: [2, 1, -1]), ballot(session, person: 2, values: [-2, 1, -1])]
        XCTAssertEqual(session.rankings.first?.candidate.title, "B")
        XCTAssertEqual(session.rankings.first?.support, 3)
        XCTAssertTrue(session.rankings.first?.everyoneAccepts == true)
        XCTAssertEqual(session.rankings.first(where: { $0.candidate.title == "A" })?.objections, ["Cam"])
    }
    func testIncompleteResponsesAreVisibleAndDuplicatePeopleDoNotCountTwice() {
        var session = fixture()
        let old = ballot(session, person: 0, values: [-1, 1, 2], time: 100)
        let newer = ballot(session, person: 0, values: [2, 1, -1], time: 200)
        session.ballots = [old, newer]
        XCTAssertEqual(session.completeBallots.count, 1)
        XCTAssertEqual(session.pendingNames, ["Bea", "Cam"])
        XCTAssertEqual(session.completeBallots.first?.ratings[session.candidates[0].id], 2)
        XCTAssertEqual(session.rankings.first?.responses, 1)
    }
    func testInvitationContainsNoPrivateBallotsOrFinalPlan() throws {
        var session = fixture()
        session.ballots = [ballot(session, person: 0, values: [2, 1, -1])]
        session.chosenCandidateID = session.candidates[0].id
        let data = try GTransfer.invite(session).encoded()
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let invitation = try XCTUnwrap(object["invitation"] as? [String: Any])
        XCTAssertNil(object["ballot"])
        XCTAssertNil(invitation["ballots"])
        XCTAssertNil(invitation["chosenCandidateID"])
        let imported = try XCTUnwrap(GTransfer.decode(data).invitation).makeSession()
        XCTAssertFalse(imported.isOrganizer)
        XCTAssertTrue(imported.ballots.isEmpty)
        XCTAssertNil(imported.chosenCandidateID)
        XCTAssertEqual(imported.candidates, session.candidates)
    }
    func testBallotRejectsWrongPersonRevisionAndCandidateSet() {
        let session = fixture()
        var invalid = ballot(session, person: 0, values: [2, 1, -1])
        invalid.revision = UUID()
        XCTAssertThrowsError(try GValidation.ballot(invalid, for: session))
        invalid.revision = session.revision; invalid.participantID = UUID()
        XCTAssertThrowsError(try GValidation.ballot(invalid, for: session))
        invalid.participantID = session.participants[0].id
        invalid.ratings.removeValue(forKey: session.candidates[0].id)
        invalid.ratings[UUID()] = 2
        XCTAssertThrowsError(try GValidation.ballot(invalid, for: session))
    }
    func testInvalidRatingAndOversizedTransferAreRejected() {
        let session = fixture()
        let invalid = ballot(session, person: 0, values: [2, 0, -1])
        XCTAssertThrowsError(try GValidation.ballot(invalid, for: session))
        XCTAssertThrowsError(try GTransfer.response(invalid).validated())
        XCTAssertThrowsError(try GTransfer.decode(Data(repeating: 32, count: 1_000_001)))
    }
    @MainActor func testInvitationAndReturnedResponseWorkAcrossSeparateStores() throws {
        let organizer = makeStore(), friend = makeStore()
        let session = fixture()
        try organizer.save(session)
        try friend.importData(GTransfer.invite(session).encoded())
        let friendSession = try XCTUnwrap(friend.session(session.id))
        XCTAssertTrue(friendSession.ballots.isEmpty)
        try friend.submit(sessionID: session.id, participantID: session.participants[1].id,
                          ratings: [session.candidates[0].id: 2, session.candidates[1].id: 1, session.candidates[2].id: -2])
        let response = try XCTUnwrap(friend.session(session.id)?.ballot(for: session.participants[1].id))
        try organizer.importData(GTransfer.response(response).encoded())
        XCTAssertEqual(organizer.session(session.id)?.completeBallots.count, 1)
        XCTAssertEqual(organizer.session(session.id)?.pendingNames, ["Ari", "Cam"])
        try organizer.importData(GTransfer.response(response).encoded())
        XCTAssertEqual(organizer.session(session.id)?.completeBallots.count, 1)
    }
    @MainActor func testStaleImportFailsWithoutChangingStore() throws {
        let store = makeStore()
        let original = fixture()
        try store.save(original)
        let response = ballot(original, person: 0, values: [2, 1, -1])
        var updated = original; updated.title = "New dinner"
        try store.update(updated, resetVotes: true)
        let before = store.sessions
        XCTAssertThrowsError(try store.importData(GTransfer.response(response).encoded()))
        XCTAssertEqual(store.sessions, before)
    }
    @MainActor func testNoOpEditorSnapshotPreservesNewlyImportedResponse() throws {
        let store = makeStore(); let snapshot = fixture()
        try store.save(snapshot)
        let response = ballot(snapshot, person: 0, values: [2, 1, -1])
        try store.importData(GTransfer.response(response).encoded())
        try store.update(snapshot, resetVotes: false)
        XCTAssertEqual(store.session(snapshot.id)?.ballots, [response])
        var changed = snapshot; changed.title = "Changed"
        XCTAssertThrowsError(try store.update(changed, resetVotes: false))
        XCTAssertEqual(store.session(snapshot.id)?.ballots, [response])
    }
    @MainActor func testOldResponseCannotReplaceNewerResponse() throws {
        let store = makeStore(); let session = fixture()
        try store.save(session)
        let newer = ballot(session, person: 0, values: [2, 1, -1], time: 200)
        try store.importData(GTransfer.response(newer).encoded())
        let older = ballot(session, person: 0, values: [-2, 1, 2], time: 100)
        XCTAssertThrowsError(try store.importData(GTransfer.response(older).encoded()))
        XCTAssertEqual(store.session(session.id)?.ballots, [newer])
    }
    @MainActor func testDecidedPlanRequiresExplicitReopenBeforeVoting() throws {
        let store = makeStore(); let session = fixture()
        try store.save(session)
        try store.choose(sessionID: session.id, candidateID: session.candidates[0].id)
        let ratings = [session.candidates[0].id: 2, session.candidates[1].id: 1, session.candidates[2].id: -1]
        XCTAssertThrowsError(try store.submit(sessionID: session.id, participantID: session.participants[0].id, ratings: ratings))
        try store.choose(sessionID: session.id, candidateID: nil)
        XCTAssertNoThrow(try store.submit(sessionID: session.id, participantID: session.participants[0].id, ratings: ratings))
    }
    @MainActor func testDemoAndPersonalLibrariesStaySeparate() throws {
        let store = makeStore(); let personal = fixture()
        try store.save(personal)
        store.switchMode(.demo)
        XCTAssertEqual(store.sessions.count, 2)
        XCTAssertNil(store.session(personal.id))
        try store.eraseCurrentLibrary()
        XCTAssertTrue(store.sessions.isEmpty)
        try store.resetDemo()
        XCTAssertEqual(store.sessions.count, 2)
        store.switchMode(.personal)
        XCTAssertEqual(store.sessions, [personal])
    }
    @MainActor func testBackupRestoresNewDecisionsAndPreservesExistingOnes() throws {
        let store = makeStore(); let existing = fixture(); let new = fixture()
        try store.save(existing)
        var alteredExisting = existing; alteredExisting.title = "Must not overwrite"
        var restored = new; restored.chosenCandidateID = restored.candidates[0].id; restored.reminderDate = Date().addingTimeInterval(1000)
        let data = try JSONEncoder().encode(GArchive(sessions: [alteredExisting, restored]))
        XCTAssertEqual(try store.restoreLibrary(data), 1)
        XCTAssertEqual(store.session(existing.id)?.title, existing.title)
        XCTAssertNil(store.session(new.id)?.reminderDate)
        XCTAssertEqual(try store.restoreLibrary(data), 0)
        let exported = try GStore.validatedArchive(store.exportLibrary())
        XCTAssertEqual(exported.sessions.count, 2)
    }
    @MainActor func testInvalidBackupIsRejectedAtomically() throws {
        let store = makeStore(); let session = fixture(); try store.save(session)
        var bad = fixture(); bad.ballots = [ballot(bad, person: 0, values: [2, 1, -1])]; bad.ballots.append(bad.ballots[0])
        let before = store.sessions
        XCTAssertThrowsError(try store.restoreLibrary(JSONEncoder().encode(GArchive(sessions: [fixture(), bad]))))
        XCTAssertEqual(store.sessions, before)
    }
    @MainActor func testUnreadableLibraryIsPreservedUntilExplicitErase() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("GatherCorruption-\(UUID().uuidString)")
        let suite = "GatherTests.\(UUID().uuidString)"; let defaults = UserDefaults(suiteName: suite)!
        defer { try? FileManager.default.removeItem(at: url); defaults.removePersistentDomain(forName: suite) }
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        let corrupt = Data("unreadable library".utf8)
        try corrupt.write(to: url.appendingPathComponent("personal.json"))
        let store = GStore(baseURL: url, defaults: defaults)
        XCTAssertNotNil(store.failure)
        XCTAssertThrowsError(try store.save(fixture()))
        XCTAssertEqual(try store.exportLibrary(), corrupt)
        try store.eraseCurrentLibrary()
        XCTAssertNoThrow(try store.save(fixture()))
    }
}

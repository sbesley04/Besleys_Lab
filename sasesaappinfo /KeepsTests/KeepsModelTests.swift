import XCTest
@testable import Keeps

final class KeepsModelTests: XCTestCase {
    func testCaptureKeepsOriginalAndExtractsLinkAndTagsWithoutInventingMetadata() {
        let text = "A quiet place for Friday\nhttps://example.com/place?id=4 #quiet #dinner"
        let idea = CaptureParser.draft(from: text)
        XCTAssertEqual(idea.title, "A quiet place for Friday")
        XCTAssertEqual(idea.originalText, text)
        XCTAssertEqual(idea.sourceURL, "https://example.com/place?id=4")
        XCTAssertEqual(idea.tags, ["dinner", "quiet"])
        XCTAssertNil(idea.estimatedPrice)
        XCTAssertNil(idea.walkMinutes)
    }

    func testURLOnlyCaptureUsesHostnameAndRejectsExecutableSchemes() {
        XCTAssertEqual(CaptureParser.draft(from: "https://www.example.com/reel/123").title, "example.com")
        XCTAssertNil(SavedIdea(title: "Unsafe", sourceURL: "javascript:alert(1)").externalURL)
        XCTAssertNil(SavedIdea(title: "Local", sourceURL: "file:///private/test").externalURL)
        XCTAssertNotNil(SavedIdea(title: "Web", sourceURL: "https://example.com").externalURL)
    }

    func testFiltersExcludeArchivedUnknownAndOverBudgetIdeas() {
        let good = SavedIdea(title: "Quiet noodle bar", category: .food, tags: ["vegetarian"], estimatedPrice: 18, walkMinutes: 12)
        var unknown = good; unknown.estimatedPrice = nil
        var tooFar = good; tooFar.walkMinutes = 30
        var archived = good; archived.archived = true
        var filter = RetrievalFilter(query: "quiet vegetarian", category: .food, maxPrice: 20, maxWalk: 15)
        XCTAssertTrue(filter.matches(good))
        XCTAssertFalse(filter.matches(unknown))
        XCTAssertFalse(filter.matches(tooFar))
        XCTAssertFalse(filter.matches(archived))
        filter.maxPrice = nil
        XCTAssertTrue(filter.matches(unknown))
        filter.favoritesOnly = true
        XCTAssertFalse(filter.matches(good))
    }

    func testDirectionMappingRetainsFourPreferenceIntensities() {
        XCTAssertEqual(SwipePreference.fromDrag(x: 5, y: -100), .strongYes)
        XCTAssertEqual(SwipePreference.fromDrag(x: 100, y: 5), .weakYes)
        XCTAssertEqual(SwipePreference.fromDrag(x: -100, y: 5), .weakNo)
        XCTAssertEqual(SwipePreference.fromDrag(x: 5, y: 100), .strongNo)
    }

    func testBackupRoundTripIncludesOriginalPhotoAndHistory() throws {
        let item = SavedIdea(title: "A photo idea", category: .shopping, originalText: "Original caption", notes: "My note", tags: ["dorm"], estimatedPrice: 20, photoData: Data([1, 2, 3]))
        let decision = DecisionRecord(selectedTitle: item.title, selectedIdeaID: item.id, consideredCount: 3)
        let data = try JSONEncoder().encode(KeepsBackup(items: [item], decisions: [decision]))
        let restored = try KeepsBackup.decode(data)
        XCTAssertEqual(restored.items, [item])
        XCTAssertEqual(restored.decisions, [decision])
    }

    func testBackupRejectsMalformedVersionDuplicateAndInvalidValues() throws {
        XCTAssertThrowsError(try KeepsBackup.decode(Data("not a backup".utf8)))
        let item = SavedIdea(title: "A good idea")
        var backup = KeepsBackup(items: [item], decisions: [])
        backup.version = 99
        XCTAssertThrowsError(try KeepsBackup.decode(JSONEncoder().encode(backup)))
        backup.version = 1; backup.items = [item, item]
        XCTAssertThrowsError(try KeepsBackup.decode(JSONEncoder().encode(backup)))
        var invalid = item; invalid.estimatedPrice = -1
        backup.items = [invalid]
        XCTAssertThrowsError(try KeepsBackup.decode(JSONEncoder().encode(backup)))
        invalid = item; invalid.title = String(repeating: "a", count: 301); backup.items = [invalid]
        XCTAssertThrowsError(try KeepsBackup.decode(JSONEncoder().encode(backup)))
        XCTAssertThrowsError(try KeepsBackup.decode(Data(count: KeepsBackup.maximumBytes + 1)))
    }
}

@MainActor
final class KeepsStoreTests: XCTestCase {
    private var folder: URL!
    private var defaults: UserDefaults!
    private var suite: String!
    override func setUp() async throws {
        suite = "KeepsTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)!
        folder = FileManager.default.temporaryDirectory.appendingPathComponent(suite, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    }
    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: folder)
        defaults.removePersistentDomain(forName: suite)
    }
    private func makeStore() -> KeepsStore { KeepsStore(storageFolder: folder, userDefaults: defaults, launchArguments: []) }

    func testPersonalLibraryPersistsAndDemoDoesNotMix() throws {
        let store = makeStore()
        store.switchMode(.personal)
        let mine = SavedIdea(title: "My private save")
        XCTAssertTrue(store.save(mine))
        store.switchMode(.demo)
        XCTAssertEqual(store.items.count, 12)
        XCTAssertFalse(store.items.contains(where: { $0.id == mine.id }))
        store.clearLibrary()
        XCTAssertEqual(store.items.count, 0)
        store.switchMode(.personal)
        XCTAssertEqual(store.items, [mine])
        let reopened = makeStore()
        XCTAssertEqual(reopened.items, [mine])
        XCTAssertFalse(reopened.isDemo)
    }

    func testImportMergesNewIdeasPreservesExistingAndDoesNotScheduleImportedReminder() throws {
        let store = makeStore(); store.switchMode(.personal)
        let existing = SavedIdea(title: "Updated locally", notes: "Keep this")
        XCTAssertTrue(store.save(existing))
        var incomingExisting = existing; incomingExisting.notes = "Older backup"
        let addition = SavedIdea(title: "Imported idea", reminderAt: Date().addingTimeInterval(10_000))
        let data = try JSONEncoder().encode(KeepsBackup(items: [incomingExisting, addition], decisions: []))
        XCTAssertEqual(try store.importBackup(data), 1)
        XCTAssertEqual(store.items.first(where: { $0.id == existing.id })?.notes, "Keep this")
        XCTAssertNil(store.items.first(where: { $0.id == addition.id })?.reminderAt)
        XCTAssertEqual(try store.importBackup(data), 0)
    }

    func testInvalidLocalSaveRollsBackAndExistingLibraryRemainsReadable() throws {
        let store = makeStore(); store.switchMode(.personal)
        let item = SavedIdea(title: "Valid")
        XCTAssertTrue(store.save(item))
        XCTAssertFalse(store.save(SavedIdea(title: String(repeating: "x", count: 301))))
        XCTAssertEqual(store.items, [item])
        XCTAssertEqual(makeStore().items, [item])
    }

    func testUnreadableOriginalIsPreservedBeforeWriteAndErasedOnExplicitClear() throws {
        let broken = Data("preserve these original bytes".utf8)
        try broken.write(to: folder.appendingPathComponent("personal.keepsbackup"))
        let store = makeStore(); store.switchMode(.personal)
        XCTAssertNotNil(store.error)
        XCTAssertEqual(try store.recoveryBackupData(), broken)
        XCTAssertTrue(store.save(SavedIdea(title: "New idea")))
        XCTAssertEqual(try store.recoveryBackupData(), broken)
        XCTAssertEqual(store.recoveryFiles.count, 1)
        store.clearLibrary()
        XCTAssertTrue(store.recoveryFiles.isEmpty)
        XCTAssertTrue(makeStore().items.isEmpty)
    }

    func testDeletedIdeaCannotBeChosenOrResurrectedByReminder() async throws {
        let store = makeStore(); store.switchMode(.personal)
        let item = SavedIdea(title: "Deleted idea")
        XCTAssertTrue(store.save(item)); store.delete(item)
        XCTAssertFalse(store.choose(item, considered: 3))
        let scheduled = await store.scheduleReminder(for: item, at: Date().addingTimeInterval(3_600))
        XCTAssertFalse(scheduled)
        XCTAssertTrue(store.items.isEmpty)
        XCTAssertTrue(store.decisions.isEmpty)
    }
}

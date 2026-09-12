import XCTest

final class KeepsUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    func testDemoLibraryAndRetrieval() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
        XCTAssertTrue(app.buttons["keeps.demo"].waitForExistence(timeout: 15))
        app.buttons["keeps.demo"].tap()
        XCTAssertTrue(app.buttons["keeps.add"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Juniper noodle bar"].exists)
        capture("Keeps — demo library")
        app.buttons["keeps.retrieve"].tap()
        XCTAssertTrue(app.buttons["keeps.startSession"].waitForExistence(timeout: 10))
        capture("Keeps — retrieve")
        reveal(app.buttons["keeps.startSession"], in: app)
        app.buttons["keeps.startSession"].tap()
        reveal(app.buttons["keeps.vote.strongYes"], in: app)
        capture("Keeps — personal swipe session")
        for index in 0..<8 {
            let id = index < 3 ? "keeps.vote.strongYes" : "keeps.vote.weakNo"
            reveal(app.buttons[id], in: app)
            app.buttons[id].tap()
        }
        let choose = app.buttons["keeps.retrieve.choose"].firstMatch
        XCTAssertTrue(choose.waitForExistence(timeout: 5))
        reveal(choose, in: app)
        capture("Keeps — shortlisted ideas")
        choose.tap()
        XCTAssertTrue(app.staticTexts["Make it happen."].waitForExistence(timeout: 5))
        capture("Keeps — chosen idea")
    }

    func testFreshLibraryCanOpenCapture() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
        XCTAssertTrue(app.buttons["keeps.fresh"].waitForExistence(timeout: 15))
        app.buttons["keeps.fresh"].tap()
        XCTAssertTrue(app.buttons["keeps.add"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Juniper noodle bar"].exists)
        app.buttons["keeps.add"].tap()
        XCTAssertTrue(app.buttons["keeps.capture.review"].waitForExistence(timeout: 5))
        app.buttons["keeps.capture.review"].tap()
        XCTAssertTrue(app.buttons["keeps.save"].waitForExistence(timeout: 5))
        capture("Keeps — save an idea")
        let title = app.descendants(matching: .any)["keeps.editor.title"].firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.tap()
        title.typeText("My test cafe")
        app.buttons["keeps.save"].tap()
        let saved = app.buttons["keeps.idea.My test cafe"]
        XCTAssertTrue(saved.waitForExistence(timeout: 10))
        saved.tap()
        XCTAssertTrue(app.buttons["keeps.detail.edit"].waitForExistence(timeout: 5))
        for _ in 0..<4 where !app.buttons["keeps.detail.archive"].isHittable { app.swipeUp() }
        app.buttons["keeps.detail.archive"].tap()
        XCTAssertTrue(app.buttons["Restore to library"].waitForExistence(timeout: 5))
    }

    func testVerticalCardSwipes() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--demo"]
        app.launch()
        XCTAssertTrue(app.buttons["keeps.retrieve"].waitForExistence(timeout: 10))
        app.buttons["keeps.retrieve"].tap()
        reveal(app.buttons["keeps.startSession"], in: app)
        app.buttons["keeps.startSession"].tap()
        let card = app.staticTexts["keeps.retrieve.card"]
        XCTAssertTrue(card.waitForExistence(timeout: 5))
        let first = card.label
        let start = card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -130)))
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "label != %@", first), object: card)], timeout: 3), .completed, "Upward card swipe must record strong yes")
        let second = card.label
        let next = card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        next.press(forDuration: 0.05, thenDragTo: next.withOffset(CGVector(dx: 0, dy: 130)))
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "label != %@", second), object: card)], timeout: 3), .completed, "Downward card swipe must record strong no")
    }

    private func capture(_ title: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = title
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<8 where !element.isHittable {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.75)).press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.28)))
        }
        XCTAssertTrue(element.isHittable)
    }
}

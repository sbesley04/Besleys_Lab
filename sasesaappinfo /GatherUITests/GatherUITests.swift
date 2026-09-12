import XCTest

final class GatherUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    func testDemoCanBeOpenedAndExplored() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
        XCTAssertTrue(app.buttons["demo.start"].waitForExistence(timeout: 15))
        app.buttons["demo.start"].tap()
        XCTAssertTrue(app.buttons["session.create"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Friday dinner"].exists)
        capture("Gather — demo home")
        app.staticTexts["Friday dinner"].tap()
        XCTAssertTrue(app.buttons["vote.start"].waitForExistence(timeout: 10))
        capture("Gather — decision")
        app.buttons["vote.start"].tap()
        XCTAssertTrue(app.buttons["vote.person.0"].waitForExistence(timeout: 5))
        app.buttons["vote.person.0"].tap()
        reveal(app.buttons["vote.strongYes"], in: app)
        capture("Gather — four-way voting")
        app.buttons["vote.strongYes"].tap()
        reveal(app.buttons["vote.undo"], in: app)
        app.buttons["vote.undo"].tap()
        for id in ["vote.strongYes", "vote.weakYes", "vote.weakNo", "vote.strongNo"] {
            reveal(app.buttons[id], in: app)
            app.buttons[id].tap()
        }
        XCTAssertTrue(app.staticTexts["vote.complete"].waitForExistence(timeout: 10))
        capture("Gather — response saved")
        app.buttons["Back to the decision"].tap()
        reveal(app.buttons["result.choose.0"], in: app)
        app.buttons["result.choose.0"].tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Choose Little Olive")).firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
        confirm.tap()
        for _ in 0..<6 where !app.staticTexts["You have a plan"].isHittable { app.swipeDown() }
        XCTAssertTrue(app.staticTexts["You have a plan"].waitForExistence(timeout: 5))
        capture("Gather — chosen plan")
    }

    func testFreshModeStartsWithoutSampleDecisions() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
        XCTAssertTrue(app.buttons["fresh.start"].waitForExistence(timeout: 15))
        app.buttons["fresh.start"].tap()
        XCTAssertTrue(app.buttons["session.create"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Friday dinner"].exists)
        app.buttons["session.create"].tap()
        XCTAssertTrue(app.textFields["session.title"].waitForExistence(timeout: 5))
        capture("Gather — new decision")
        app.textFields["session.title"].tap()
        app.textFields["session.title"].typeText("Test dinner")
        for index in 0..<3 {
            let field = app.textFields["candidate.title.\(index)"]
            reveal(field, in: app)
            field.tap()
            field.typeText("Test option \(index + 1)")
        }
        app.buttons["session.save"].tap()
        XCTAssertTrue(app.staticTexts["Test dinner"].waitForExistence(timeout: 5))
        app.staticTexts["Test dinner"].tap()
        XCTAssertTrue(app.buttons["vote.start"].waitForExistence(timeout: 5))
    }

    func testVerticalCardSwipes() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--demo"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Friday dinner"].waitForExistence(timeout: 10))
        app.staticTexts["Friday dinner"].tap()
        app.buttons["vote.start"].tap()
        app.buttons["vote.person.0"].tap()
        let card = app.descendants(matching: .any)["vote.card"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 5))
        let first = card.label
        card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.65)).press(forDuration: 0.05, thenDragTo: card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)))
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "label != %@", first), object: card)], timeout: 3), .completed, "Upward card swipe must record strong yes")
        let second = card.label
        card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)).press(forDuration: 0.05, thenDragTo: card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.85)))
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
            let startY = app.keyboards.firstMatch.exists ? 0.52 : 0.75
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: startY)).press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.25)))
        }
        XCTAssertTrue(element.isHittable)
    }
}

import XCTest

final class OrbitUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    private func launch(demo: Bool = true) {
        app.launchArguments = ["--uitesting"] + (demo ? ["--demo"] : [])
        app.launch()
    }

    private func button(_ identifier: String) -> XCUIElement { app.buttons.matching(identifier: identifier).firstMatch }

    private func scrollTo(_ element: XCUIElement, attempts: Int = 9) {
        let keyboardDone = button("orbit.editor.done")
        if app.keyboards.count > 0 && keyboardDone.exists && keyboardDone.isHittable { keyboardDone.tap() }
        for _ in 0..<attempts {
            if element.exists && element.isHittable { return }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.50, dy: 0.65)).press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.50, dy: 0.25)))
        }
        XCTAssertTrue(element.exists && element.isHittable, "Expected a reachable control: \(element)")
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func chooseDemoPlan() {
        XCTAssertTrue(button("orbit.room.open").waitForExistence(timeout: 12))
        button("orbit.room.open").tap()
        scrollTo(button("orbit.room.swipe"))
        button("orbit.room.swipe").tap()
        for _ in 0..<3 {
            XCTAssertTrue(button("orbit.vote.strongYes").waitForExistence(timeout: 5))
            scrollTo(button("orbit.vote.strongYes"))
            button("orbit.vote.strongYes").tap()
        }
        XCTAssertTrue(button("orbit.swipe.submit").waitForExistence(timeout: 5))
        scrollTo(button("orbit.swipe.submit"))
        capture("Orbit-complete-ballot")
        button("orbit.swipe.submit").tap()
        scrollTo(button("orbit.room.choose"))
        button("orbit.room.choose").tap()
        app.buttons["Confirm plan"].tap()
        XCTAssertTrue(app.staticTexts["PLAN CONFIRMED"].waitForExistence(timeout: 6))
    }

    func testDemoDecisionChatAndNativeCalendarCancel() {
        launch()
        capture("Orbit-demo-home")
        chooseDemoPlan()
        capture("Orbit-confirmed-plan")
        let chat = app.segmentedControls.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Chat' ")).firstMatch
        chat.tap()
        let input = app.descendants(matching: .any).matching(identifier: "orbit.chat.input").firstMatch
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        input.tap(); input.typeText("Looking forward to this plan.")
        button("orbit.chat.send").tap()
        XCTAssertTrue(app.staticTexts["Looking forward to this plan."].waitForExistence(timeout: 6))
        capture("Orbit-room-chat")
        app.segmentedControls.buttons["Plan"].tap()
        scrollTo(button("orbit.plan.calendar"))
        button("orbit.plan.calendar").tap()
        XCTAssertTrue(button("orbit.action.confirm").waitForExistence(timeout: 5))
        button("orbit.action.confirm").tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 10), "The native Calendar editor should expose Cancel.")
        capture("Orbit-native-calendar-editor")
        app.buttons["Cancel"].firstMatch.tap()
        if app.buttons["Discard Changes"].waitForExistence(timeout: 2) { app.buttons["Discard Changes"].tap() }
        XCTAssertFalse(app.staticTexts["Saved to Calendar."].exists, "Cancel must not report a saved event.")
    }

    func testPersonalManualSaveValidationAndPhotoPicker() {
        launch(demo: false)
        XCTAssertTrue(button("orbit.fresh").waitForExistence(timeout: 8))
        scrollTo(button("orbit.fresh")); button("orbit.fresh").tap()
        XCTAssertTrue(app.alerts["Add your name"].waitForExistence(timeout: 3))
        app.alerts.buttons["OK"].tap()
        let name = app.textFields["orbit.onboarding.name"]
        name.tap(); name.typeText("Taylor")
        button("orbit.fresh").tap()
        app.tabBars.buttons["Places"].tap()
        button("orbit.place.add").tap()
        app.segmentedControls.buttons["Write one"].tap()
        button("orbit.add.manual").tap()
        let title = app.descendants(matching: .any).matching(identifier: "orbit.editor.title").firstMatch
        title.tap(); title.typeText("Library courtyard picnic")
        let note = app.descendants(matching: .any).matching(identifier: "orbit.editor.note").firstMatch
        note.tap(); note.typeText("Bring a blanket after class.")
        let done = button("orbit.editor.done")
        XCTAssertTrue(done.waitForExistence(timeout: 5)); done.tap()
        let photo = app.descendants(matching: .any).matching(identifier: "orbit.editor.photo").firstMatch
        scrollTo(photo); photo.tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 8), "Native photo selection must be reachable.")
        capture("Orbit-native-photo-picker")
        let cell = app.collectionViews.cells.allElementsBoundByIndex.first { $0.isHittable }
        if let cell {
            cell.tap()
            if app.buttons["Add"].waitForExistence(timeout: 2) { app.buttons["Add"].tap() }
        } else { app.buttons["Cancel"].firstMatch.tap() }
        XCTAssertTrue(button("orbit.editor.save").waitForExistence(timeout: 8))
        scrollTo(button("orbit.editor.save")); button("orbit.editor.save").tap()
        if app.alerts.buttons["OK"].waitForExistence(timeout: 4) { app.alerts.buttons["OK"].tap() }
        XCTAssertTrue(app.staticTexts["Library courtyard picnic"].waitForExistence(timeout: 6))
        capture("Orbit-personal-saved-place")
        app.buttons["orbit.place.Library courtyard picnic"].tap()
        scrollTo(button("orbit.place.edit")); button("orbit.place.edit").tap()
        let changedTitle = app.descendants(matching: .any).matching(identifier: "orbit.editor.title").firstMatch
        changedTitle.tap(); changedTitle.typeText(" Friday")
        let editedTitle = (changedTitle.value as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        XCTAssertTrue(editedTitle.contains("Friday"), "The edit must change the title before saving.")
        scrollTo(button("orbit.editor.save")); button("orbit.editor.save").tap()
        if app.alerts.buttons["OK"].waitForExistence(timeout: 4) { app.alerts.buttons["OK"].tap() }
        XCTAssertTrue(app.staticTexts[editedTitle].waitForExistence(timeout: 6), "The exact edited title must persist after saving.")
    }

    func testActualMapsSearchAndReviewOrHonestNetworkError() {
        launch()
        app.tabBars.buttons["Places"].tap()
        button("orbit.place.add").tap()
        let query = app.textFields["orbit.maps.query"]
        XCTAssertTrue(query.waitForExistence(timeout: 5))
        query.tap(); query.typeText("Washington Square Park New York")
        button("orbit.maps.search").tap()
        let result = button("orbit.maps.result")
        if result.waitForExistence(timeout: 35) {
            capture("Orbit-live-Maps-results")
            result.tap()
            XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "orbit.editor.title").firstMatch.waitForExistence(timeout: 5))
            capture("Orbit-Maps-place-review")
            print("ORBIT_MAPS_LIVE_RESULT_VERIFIED")
        } else {
            let error = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Apple Maps couldn' OR label CONTAINS 'Maps search needs' OR label CONTAINS 'No results to show yet' ")).firstMatch
            XCTAssertTrue(error.exists, "Maps must provide a real result or a truthful error/empty state.")
            capture("Orbit-Maps-service-unavailable")
            print("ORBIT_MAPS_EXTERNAL_SERVICE_UNAVAILABLE")
        }
    }
}

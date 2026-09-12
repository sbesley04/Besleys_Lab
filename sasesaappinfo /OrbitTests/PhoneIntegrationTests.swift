import XCTest
@testable import Orbit

final class PhoneIntegrationTests: XCTestCase {
    func testTitlesAreTrimmedAndInvalidTitlesRejected() throws {
        XCTAssertEqual(try OPhoneValidation.title("  Dinner with friends\n"), "Dinner with friends")
        XCTAssertThrowsError(try OPhoneValidation.title(" \n "))
        XCTAssertThrowsError(try OPhoneValidation.title(String(repeating: "x", count: 301)))
    }

    func testOnlyReasonableFutureDatesAreAccepted() throws {
        let now = Date(timeIntervalSince1970: 1_000_000)
        XCTAssertNoThrow(try OPhoneValidation.futureDate(now.addingTimeInterval(3_600), now: now))
        XCTAssertThrowsError(try OPhoneValidation.futureDate(now, now: now))
        XCTAssertThrowsError(try OPhoneValidation.futureDate(now.addingTimeInterval(-1), now: now))
        XCTAssertThrowsError(try OPhoneValidation.futureDate(Date(timeIntervalSince1970: .infinity), now: now))
        XCTAssertThrowsError(try OPhoneValidation.futureDate(now.addingTimeInterval(315_576_001), now: now))
    }

    func testCoordinateValidationDoesNotInventMissingValues() {
        let valid = OPhoneValidation.coordinate(latitude: 40.73, longitude: -73.99)
        XCTAssertEqual(valid?.latitude, 40.73)
        XCTAssertEqual(valid?.longitude, -73.99)
        XCTAssertNil(OPhoneValidation.coordinate(latitude: nil, longitude: 0))
        XCTAssertNil(OPhoneValidation.coordinate(latitude: 0, longitude: nil))
        XCTAssertNil(OPhoneValidation.coordinate(latitude: 91, longitude: 0))
        XCTAssertNil(OPhoneValidation.coordinate(latitude: 0, longitude: -181))
        XCTAssertNil(OPhoneValidation.coordinate(latitude: .nan, longitude: 0))
        XCTAssertNil(OPhoneValidation.coordinate(latitude: 0, longitude: .infinity))
    }

    func testWebLinksAllowOnlyWebDestinations() {
        XCTAssertEqual(OPhoneValidation.webURL(" https://example.com/place ")?.absoluteString, "https://example.com/place")
        XCTAssertNil(OPhoneValidation.webURL("javascript:alert(1)"))
        XCTAssertNil(OPhoneValidation.webURL("file:///private/example"))
        XCTAssertNil(OPhoneValidation.webURL("tel:+15555550123"))
        XCTAssertNil(OPhoneValidation.webURL("just a phrase"))
    }

    func testRecipientsAreTrimmedDeduplicatedAndPreservePhoneFormatting() {
        XCTAssertEqual(OPhoneValidation.recipients([" +1 (555) 555-0123 ", "", " +1 (555) 555-0123", "person@example.com", "PERSON@example.com", String(repeating: "a", count: 321)]), ["+1 (555) 555-0123", "person@example.com"])
    }
}

# Verification

Verified on September 7, 2026 with Xcode 26.6 and the iPhone 17 Pro simulator running iOS 26.5.

Both native apps build successfully with no third-party dependencies. **31 distinct automated tests pass.**

## Gather

14 model/storage tests cover consensus ranking, incomplete respondents, duplicate defense, invitation privacy, participant and revision validation, invitation/response exchange between separate stores, stale response rejection, finalized decisions, concurrent imports during editing, demo isolation, backup restore, and unreadable data preservation.

3 interface tests cover a complete demo vote and chosen plan, creating a real decision from an empty personal library, and actual upward/downward card drags. The drag tests caught and verified a fix for competition between page scrolling and voting.

Result: `Gather-verified.xcresult`.

## Keeps

11 model/storage tests cover capture parsing, safe source URLs, filtering unknown estimates, preference intensity, photo/history backup round trips, malformed imports, persistence, demo isolation, merge deduplication, invalid-save rollback, corrupt-file recovery and erasure, and rejection of reminders for deleted ideas.

3 interface tests cover demo retrieval through choosing an idea, creating and archiving a real save from an empty library, and actual upward/downward card drags. All interface tests were rerun after the gesture fix.

Results: `Keeps-tests.xcresult` for model/storage tests; `Keeps-verified.xcresult` for the final interface tests.

## Visual inspection and scope

Inspected screenshots captured from the running apps: home/library, voting, and chosen-plan screens. The apps share the same palette and card styling, with distinct group-decision and personal-library navigation.

Tests use isolated application data. No messages were sent to other people, no bookings or payments were made, and no private user content was needed.

The apps use local storage, explicit file sharing, native photo selection, and native notification APIs. They do not include a cloud backend, browser-based guest voting, automatic booking, or AI scraping. Physical-device signing and App Store/TestFlight distribution require an Apple developer identity; those distribution steps were not performed.

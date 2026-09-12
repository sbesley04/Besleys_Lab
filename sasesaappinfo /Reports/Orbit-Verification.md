# Orbit verification

Status as of September 11, 2026. This report covers Orbit only; Gather and Keeps have separate verification results.

## Completed

- **9 domain XCTest cases passed, 0 failures.** Executed against the real `Orbit/Domain.swift` in a standalone macOS XCTest runner. Coverage includes value bounds, private-photo removal from shared suggestions, host authority, ballot validation, idempotence, vote invalidation after reopening, ranking, room membership limits, and maximum-length emoji chat. The chat test confirms snapshots stay below the nearby transport's 256 KiB payload cap while retaining the newest complete messages.
- The App Intent typechecked against the iOS Simulator SDK using an isolated store stub with the same `savePlace → Bool` signature as the implemented store. This is a targeted typecheck, not a complete native build.
- The generated Orbit Xcode project, app Info plist, and privacy manifest passed plist validation. Project generation preserves the configured online endpoint and discovers the Swift files in the app, unit-test, and UI-test directories.
- The opaque 1024 × 1024 app icon was rendered and visually inspected. Both its asset-catalog metadata and image dimensions were checked.
- The launcher scripts passed Bash syntax validation. Their Simulator build/install/launch path is pending the native run below.

## In progress

- The native app and combined unit/UI suite are being compiled and exercised by the UI implementation owner. No passing complete native build or native test count is claimed here yet.
- An earlier sandboxed native build stopped at asset compilation because CoreSimulator exposed no available runtimes. That environment failure did not verify or disprove app compilation; it is superseded only by a subsequent successful native run.
- The service is being deployed separately. No live online room or native-to-browser round trip has been verified for this report yet. The intended endpoint is `https://orbit-together.sambesley04.chatgpt.site`; the native Info plist remains authoritative for the build's configured endpoint.

## Checks that still need real devices or live service

- Two physical devices: nearby discovery, code comparison, host approval, encrypted room updates, disconnect, and reconnect behavior.
- A native host and remote browser guest: join approval, suggestions, chat, votes, final plan, reconnect, and expiry/deletion behavior against the deployed service.
- Physical-device permission and integration flows for location, contact selection, Messages send/cancel, Calendar save/cancel, Reminders, photo selection, and notifications. Simulator availability differs from a configured phone.

## Persistence and privacy review

Orbit uses Codable JSON persistence, not SwiftData. Saves validate before atomic writes; reads are bounded to 50 MB plus one byte, and unreadable original files are preserved with subsequent writes blocked. Personal and demo modes use separate files. Online credentials use Keychain, while app-only mode settings use UserDefaults.

The native source currently uses no required-reason API category beyond its own UserDefaults (`CA92.1`). The manifest declares no tracking and app-functionality collection of names, random user identifiers, messages, other shared content, and shared place coordinates. A private photo is removed from a room suggestion. Contacts and photos use system pickers; current-location access, Reminders access, and notifications begin with explicit user actions. The app contains no analytics SDK.

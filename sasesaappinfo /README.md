# Gather, Keeps & Orbit

**Orbit is the newest app:** [setup and features](README-Orbit.md). Double-click **Open Orbit.command** for its populated iPhone demo, or select the **Orbit** scheme in the workspace. Its companion service is live and supports friends in different locations through private invitations and host approval.

## Gather & Keeps

Two independent native iPhone and iPad apps in one Xcode workspace. Both work without an account, API key, subscription, or backend. They share a restrained cream-and-sage visual system, but solve different parts of choosing a plan.

## Open the apps

Open **ChoiceApps.xcworkspace** in Xcode. Choose the **Gather** or **Keeps** scheme and an iPhone simulator, then Run. Each app also has its own `.xcodeproj`.

For a shortcut, double-click **Open Demos.command**. It builds and installs both apps on an available iPhone simulator, then launches their populated demo modes. You can also run `Scripts/run-demo.sh Gather` or `Scripts/run-demo.sh Keeps` separately.

The projects use native Apple frameworks and have no third-party packages to install. They target iOS 17 and later. A physical iPhone or an App Store release requires signing with your Apple developer identity in Xcode; simulator builds do not.

## Gather: reach a group decision

- Create a decision with 3–12 options and a list of participants.
- Add price, travel time, notes, and optional original or booking links.
- Vote with four directional swipes or the equivalent labeled buttons. Undo a vote while completing a ballot.
- Pass one phone around, or share an invitation file with friends who have Gather installed. They open it, select their name, vote, and return their response file. The organizer imports responses to update the result.
- See the leading options, who has responded, and strong objections. Confirm a final plan, open its source link, or schedule a local reminder.

Invitations omit existing ballots. Responses are checked against the decision, its revision, its participant list, and its complete option list. This is an asynchronous file exchange among trusted participants, not an authenticated voting system or a live cloud service. Editing the options invalidates older ballots; finalized plans must be reopened before voting changes.

The demo includes a dinner decision with sample responses and a completed evening plan. Sample places and votes are explicitly fictional.

## Keeps: retrieve what you saved

- Capture a link, pasted text, or a photo. Keep the original material alongside an editable title, notes, category, tags, and optional cost/walking estimates.
- Search, favorite, archive, edit, and delete ideas.
- Retrieve ideas by topic, category, budget, walking time, and favorites. Unknown prices or walking times do not pass a corresponding limit.
- Swipe a retrieved shortlist, see your strongest choices, and record the one you choose. The current session's swipes do not silently change lasting preferences.
- Revisit decision history, open original links, and schedule local reminders.
- Export a portable `.keepsbackup` containing the library and saved photos. Import merges new identifiers without replacing existing ideas. Imported reminders are not automatically scheduled.

Keeps uses local text/link parsing and explicit filters. It does not scrape TikTok, infer facts from photographs, access private accounts, or send saved material to an AI service. A price or category you enter remains an estimate, not verified venue information.

The demo includes twelve fictional saves across food, activities, trips, and shopping, with favorites and a sample past decision.

## Demo and personal data

On first launch, choose **Try the demo** or start with an empty personal collection. Switch modes in the app's settings. Demo and personal data are persisted separately. Resetting demo data affects only the demo collection.

Gather and Keeps store data in each app's private device container and use no analytics or developer-operated server. Orbit's separate online service and data handling are described in [its guide](README-Orbit.md). Device-level Apple backups may include app data according to the device's backup settings. Share/export actions hand the selected content to the destination you choose. Keep your exported backups somewhere you control.

Reminders use the device's notification permission and can be canceled inside the app. External links use the system browser. Booking is a user action on the linked service; these apps do not make reservations or payments automatically.

## Project structure

- `Gather/` and `Keeps/`: app source, icons, and privacy manifests.
- `GatherTests/` and `KeepsTests/`: model, import, and persistence tests.
- `GatherUITests/` and `KeepsUITests/`: simulator interaction tests.
- `Configuration/`: document types, app URL schemes, and other app metadata.
- `Scripts/generate_projects.py`: regenerates both Xcode projects from the checked-in Swift files. Normal use does not require running it.
- `Reports/`: build/test results and screenshots from verification.

Run the tests with Product → Test in the selected app scheme. The UI tests use isolated storage so they do not modify the user's personal or demo collection.

## Verification and previews

Both apps compile, and 31 automated tests pass on the iPhone 17 Pro simulator. See [verification details](Reports/Verification.md), [Gather's demo screen](Reports/Gather-demo.png), and [Keeps' demo screen](Reports/Keeps-demo.png).

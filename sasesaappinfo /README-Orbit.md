# Orbit

Orbit is the third, separate native iPhone and iPad app in this workspace. A room combines a short list of ideas, four-way preference input, a conversation, and a plan the host confirms. Private saved places supply ideas without exposing the whole library.

The app targets iOS 17 and later and uses Apple frameworks without third-party packages. Gather and Keeps remain separate apps with their own data.

## Run it

Double-click **Open Orbit.command** to build and launch the populated demo on an available iPhone simulator. Xcode and an installed iOS Simulator runtime are required. The launcher keeps existing demo edits; **You → Reset the demo** restores the fictional sample room.

From Terminal in this directory:

```sh
Scripts/run-orbit.sh demo
Scripts/run-orbit.sh resume
```

`resume` opens the last saved space. In the app, **You** switches between demo and personal spaces. The launcher never uses the test-storage reset argument. Set `ORBIT_DEVICE` to a simulator UDID to select a device, or `ORBIT_SKIP_WINDOW=1` to skip opening its window.

Alternatively, open **ChoiceApps.xcworkspace**, select **Orbit** and an iPhone simulator, and Run. **Orbit.xcodeproj** also opens independently. A physical iPhone requires signing with your developer identity in Xcode.

## Try the main flow

1. Open the demo room to see fictional friends, suggestions, and messages. Add a place or use **Simulate friend** for labeled sample activity.
2. Start voting after the room has at least two options. Swipe up for strong yes, right for weak yes, left for weak no, and down for strong no; labeled buttons provide the same input.
3. Send the complete ballot. Results prioritize fewer strong objections, then more yes responses, then preference intensity. The host confirms an option; reopening suggestions clears old votes.
4. Use the chosen plan to open Maps or the original link, review a Calendar event, add a Reminder, schedule a local notification, or share the plan.

Demo data is fictional. Explicit Calendar, Reminders, Maps, Messages, and notification actions still use the real system features. Orbit does not automatically book, pay, or send messages.

## Invite real friends

Use your personal space to create an **online** or **nearby** room. Rooms support up to eight people, including the host. There is no invitation-file or response-file workflow.

Online rooms use an invitation link and manual host approval. The companion website lets friends request access and participate from a browser; native clients use the same room service. Updates refresh while Orbit is open. This version does not deliver background chat notifications. Online room data expires seven days after creation.

The intended service address is `https://orbit-together.sambesley04.chatgpt.site`. Deployment and native-to-browser verification status is recorded in **Reports/Orbit-Verification.md**. The native endpoint is configured by `OrbitServiceURL` in **Configuration/Orbit-Info.plist**; a placeholder configuration cannot connect to real online rooms. Regenerating the project preserves the configured endpoint.

Nearby rooms use encrypted peer connections, with each guest connected to the host. Compare the room code before approving a request. Everyone needs Orbit installed, open, and in range. Nearby mode does not connect friends over the internet, and a host leaving interrupts the room.

## Private saves and phone features

Save an idea manually, search Apple Maps, keep a source link, or attach a photo selected from the system photo picker. Maps results need an internet connection. Cost fields are your estimates. Location is requested only after **Use my location**; you can search a place and city without granting it.

Suggesting an idea shares its title, note, source link, address, category, estimate, and any place coordinates with the room. Photos stay in the private saved library. Deleting the private copy does not remove a suggestion already shared with a room.

The contact picker returns only the contact detail you select. Messages uses the native composer, where you review and send. The Calendar editor lets you review and save an event. Adding to Reminders requests the system's Reminders permission and saves the requested item to the default list. Events and reminders you save into those apps are managed there afterward.

The **Save an idea to Orbit** App Shortcut takes a title and optional note and opens Orbit. Titles are limited to 120 characters and notes to 1,000 characters. A failed save reports an error.

## Data and limits

Personal and demo libraries are separate atomic JSON files in the app's private Application Support directory. Each library supports up to 500 saved ideas and 40 historical rooms, with a 50 MB encoded storage limit. An individual photo is limited to 3 MB. A file that cannot be decoded is preserved and further writes are blocked; the app does not silently replace it. Device backup settings may include this local data.

Online room data includes selected suggestions, names, random member identifiers, votes, and chat. Room access credentials are kept in Keychain. The service retains shared room data for seven days; it does not receive the whole private library or private photos. There are no ads, tracking, or third-party analytics in the app. **You → Privacy** explains the data flows. Erasing personal data removes the local library and attempts to leave or delete the online room; an unconfirmed remote removal is reported. Shared copies on other devices may remain.

Rooms accept up to 12 suggestions. Chat messages have a 1,000-character limit; older chat is trimmed to keep room snapshots bounded. Room changes and ballots are checked against the sender, host authority, and current option revision.

## Development and verification

- **Orbit/** contains the native UI, domain model, persistence, online and nearby clients, phone integrations, App Intents, icon, and privacy manifest.
- **OrbitTests/** contains domain, phone integration, nearby protocol, and store/client tests; **OrbitUITests/** contains simulator interaction tests.
- **Scripts/generate_projects.py Orbit** regenerates only the Orbit project and its metadata from the checked-in Swift files. The workspace keeps all three app projects.
- **Reports/Orbit-Verification.md** distinguishes completed checks from device or service checks still pending.

Use Product → Test in the Orbit scheme. UI tests use `--uitesting --demo`, with separate disposable storage. Normal launches do not clear personal or demo data.

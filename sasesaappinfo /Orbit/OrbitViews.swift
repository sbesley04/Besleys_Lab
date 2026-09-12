import SwiftUI
import MapKit
import PhotosUI
import ImageIO
import MessageUI

enum OStyle {
    static let cream = Color(red: 247/255, green: 245/255, blue: 240/255)
    static let ink = Color(red: 32/255, green: 37/255, blue: 31/255)
    static let sage = Color(red: 77/255, green: 102/255, blue: 88/255)
    static let pale = Color(red: 230/255, green: 236/255, blue: 228/255)
}
extension View {
    func orbitCard() -> some View { background(.white, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(OStyle.ink.opacity(0.07), lineWidth: 1)) }
}
struct OPrimaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { configuration.label.font(.headline).padding(.horizontal, 18).padding(.vertical, 15).foregroundStyle(.white).background(OStyle.sage.opacity(configuration.isPressed ? 0.75 : 1), in: RoundedRectangle(cornerRadius: 14)) }
}
struct OSecondaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { configuration.label.font(.headline).padding(.horizontal, 16).padding(.vertical, 14).foregroundStyle(OStyle.sage).background(OStyle.pale.opacity(configuration.isPressed ? 0.65 : 1), in: RoundedRectangle(cornerRadius: 14)) }
}
struct ODemoBanner: View {
    @EnvironmentObject private var store: OrbitStore
    var body: some View {
        if store.mode == "demo" { Label("DEMO · Friends and plans are simulated", systemImage: "sparkle").font(.caption.weight(.semibold)).foregroundStyle(OStyle.sage).frame(maxWidth: .infinity, alignment: .leading).padding(12).background(OStyle.pale, in: RoundedRectangle(cornerRadius: 12)) }
    }
}
struct OFeature: View {
    let symbol: String; let title: String; let text: String
    var body: some View { HStack(alignment: .top, spacing: 14) { Image(systemName: symbol).font(.title3).foregroundStyle(OStyle.sage).frame(width: 24); VStack(alignment: .leading, spacing: 5) { Text(title).font(.headline); Text(text).font(.subheadline).foregroundStyle(.secondary) } } }
}
struct OWelcomeView: View {
    @EnvironmentObject private var store: OrbitStore
    @State private var name = ""
    @State private var error: String?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack { Image(systemName: "circle.hexagongrid").font(.title); Text("orbit").font(.system(size: 30, weight: .bold, design: .rounded)) }.foregroundStyle(OStyle.sage).padding(.top, 25)
                Text("Less back-and-forth.\nOne shared plan.").font(.system(size: 39, weight: .bold, design: .rounded)).fixedSize(horizontal: false, vertical: true)
                Text("Bring your people, share a few places, and find something everyone can get behind.").font(.title3).foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 20) {
                    OFeature(symbol: "link", title: "A real room for your group", text: "Invite with a link or connect nearby. Suggestions, responses, and chat stay together.")
                    OFeature(symbol: "hand.draw", title: "Four quick ways to respond", text: "Swipe strong yes, weak yes, weak no, or strong no. See where the group agrees.")
                    OFeature(symbol: "calendar", title: "Follow through on your phone", text: "Use Maps, Messages, Calendar, and Reminders when your plan is ready.")
                }.padding(20).orbitCard()
                TextField("Your first name", text: $name).textContentType(.givenName).padding(16).orbitCard().accessibilityIdentifier("orbit.onboarding.name")
                Button { start(demo: false) } label: { Text("Start planning").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()).accessibilityIdentifier("orbit.fresh")
                Button { start(demo: true) } label: { Text("Try a room in demo mode").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.demo")
                Text("No account needed. Your saved places stay on your device until you suggest one in a room. Online rooms expire after 7 days.").font(.footnote).foregroundStyle(.secondary)
            }.padding(24)
        }.background(OStyle.cream).foregroundStyle(OStyle.ink)
        .alert("Add your name", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK", role: .cancel) {} } message: { Text(error ?? "") }
    }
    private func start(demo: Bool) {
        let value = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard demo || (!value.isEmpty && value.count <= 20) else { error = "Use a first name or nickname of 1–20 characters so people know who is joining."; return }
        guard value.count <= 20 else { error = "Keep your name under 21 characters."; return }
        store.finishOnboarding(name: value.isEmpty ? "Alex" : value, demo: demo)
    }
}

struct ORoomsView: View {
    @EnvironmentObject private var store: OrbitStore
    @State private var create = false
    @State private var join = false
    @State private var nearby = false
    @State private var openRoom = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    ODemoBanner()
                    VStack(alignment: .leading, spacing: 7) { Text("Find your shared yes.").font(.largeTitle.bold()); Text("A room for the people, places, and conversation behind the plan.").foregroundStyle(.secondary) }
                    if let room = store.currentRoom {
                        Button { openRoom = true } label: { roomCard(room) }.buttonStyle(.plain).accessibilityIdentifier("orbit.room.open")
                    }
                    if store.isBusy { HStack(spacing: 10) { ProgressView(); Text(store.status).font(.subheadline) }.padding(16).orbitCard() }
                    if store.currentRoom == nil || store.mode == "demo" {
                        Button { create = true } label: { Label("Create a room", systemImage: "plus").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()).accessibilityIdentifier("orbit.room.create")
                    }
                    if store.mode != "demo" {
                        HStack(spacing: 12) {
                            Button { join = true } label: { Label("Join a link", systemImage: "link").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.room.join")
                            Button { nearby = true } label: { Label("Nearby", systemImage: "antenna.radiowaves.left.and.right").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.room.nearby")
                        }.disabled(store.currentRoom != nil)
                        if store.currentRoom != nil { Text("Leave the current room before joining another one.").font(.caption).foregroundStyle(.secondary) }
                    }
                    if store.currentRoom == nil && !store.isBusy {
                        VStack(alignment: .leading, spacing: 18) {
                            OFeature(symbol: "1.circle", title: "Collect a few options", text: "Search Maps, use a saved place, or write your own idea.")
                            OFeature(symbol: "2.circle", title: "Invite and swipe", text: "Friends join the room, talk, and send their preferences.")
                            OFeature(symbol: "3.circle", title: "Confirm and go", text: "The host confirms a plan. Add it to your own calendar or reminders.")
                        }.padding(20).orbitCard()
                    }
                    if !store.history.isEmpty {
                        Text("Recent plans").font(.title3.bold()).padding(.top, 6)
                        ForEach(store.history.filter { $0.id != store.currentRoom?.id }) { room in
                            NavigationLink { ORoomView(initialRoom: room) } label: { roomCard(room) }.buttonStyle(.plain)
                        }
                    }
                    Text("Online rooms update while Orbit is open. Nearby rooms need everyone to keep the app open and remain in range.").font(.footnote).foregroundStyle(.secondary)
                }.padding(22)
            }.background(OStyle.cream)
            .navigationTitle("orbit").navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $create) { OCreateRoomView() }
            .sheet(isPresented: $join) { OJoinLinkView() }
            .sheet(isPresented: $nearby) { ONearbyBrowserView(nearby: store.nearby) }
            .navigationDestination(isPresented: $openRoom) { if let room = store.currentRoom { ORoomView(initialRoom: room) } }
            .onChange(of: store.currentRoom?.id) { _, newID in if newID != nil { create = false; join = false; nearby = false; openRoom = true } }
        }
    }
    private func roomCard(_ room: ORoom) -> some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack { Label(room.phase == "decided" ? "PLAN CONFIRMED" : (room.phase == "voting" ? "READY TO SWIPE" : "COLLECTING IDEAS"), systemImage: room.phase == "decided" ? "checkmark.circle" : "person.2").font(.caption.weight(.semibold)).foregroundStyle(OStyle.sage); Spacer(); Image(systemName: "arrow.up.right").foregroundStyle(OStyle.sage) }
            Text(room.title).font(.title2.bold()).foregroundStyle(OStyle.ink)
            Text(room.selectedPlace?.title ?? "\(room.members.count) people · \(room.places.count) options").font(.subheadline).foregroundStyle(.secondary)
            Text(room.eventDate.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(20).orbitCard()
    }
}

struct OCreateRoomView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var date = Date().addingTimeInterval(7_200)
    @State private var online = true
    @State private var error: String?
    var body: some View {
        NavigationStack {
            Form {
                Section("The plan") { TextField("Friday dinner, weekend ideas…", text: $title).accessibilityIdentifier("orbit.create.title"); DatePicker("When", selection: $date, in: Date()...) }
                if store.mode != "demo" {
                    Section {
                        Picker("Connect with friends", selection: $online) { Text("Online invite link").tag(true); Text("Nearby phones").tag(false) }.pickerStyle(.inline)
                    } footer: { Text(online ? "People can join from anywhere. The room's shared content is stored on Orbit's service for up to 7 days. Anyone with the link can request to join; you approve them." : "Orbit discovers phones nearby over local wireless. Everyone needs Orbit open, Wi-Fi and Bluetooth available, and local network permission. The host approves join requests.") }
                } else { Section { Text("This creates a separate demo room. Use Simulate a friend to try responses and chat without other people.").foregroundStyle(.secondary) } }
                Button("Create room") {
                    let clean = title.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !clean.isEmpty, clean.count <= 80 else { error = "Add a room title of 1–80 characters."; return }
                    do { try OPhoneValidation.futureDate(date); store.createRoom(title: clean, date: date, online: online); dismiss() }
                    catch { self.error = error.localizedDescription }
                }.fontWeight(.semibold).disabled(store.isBusy).accessibilityIdentifier("orbit.create.confirm")
            }.scrollContentBackground(.hidden).background(OStyle.cream)
            .navigationTitle("New room").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .alert("Check your plan", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK", role: .cancel) {} } message: { Text(error ?? "") }
        }
    }
}

struct OJoinLinkView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.dismiss) private var dismiss
    @State private var link = ""
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                Image(systemName: "link").font(.system(size: 40, weight: .light)).foregroundStyle(OStyle.sage)
                Text("Meet them in Orbit.").font(.largeTitle.bold())
                Text("Paste the invite your friend sent. The host will approve your request before you can see or join the conversation.").foregroundStyle(.secondary)
                TextField("Orbit invite link", text: $link, axis: .vertical).textInputAutocapitalization(.never).autocorrectionDisabled().padding(16).orbitCard().accessibilityIdentifier("orbit.join.link")
                PasteButton(payloadType: String.self) { values in link = String(values.joined(separator: "").prefix(4_000)) }
                Button { store.joinOnline(link); dismiss() } label: { Text("Request to join").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()).disabled(link.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isBusy).accessibilityIdentifier("orbit.join.confirm")
                Spacer()
            }.padding(24).background(OStyle.cream)
            .navigationTitle("Join a room").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}

struct ONearbyBrowserView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var nearby: NearbyTransport
    var body: some View {
        NavigationStack {
            List {
                Section { Label(nearby.status, systemImage: "antenna.radiowaves.left.and.right").font(.subheadline); Text("Ask your friend to create a nearby room and keep Orbit open. Compare the six-character code on both phones before joining.").font(.subheadline).foregroundStyle(.secondary) }
                if nearby.discovered.isEmpty { Section { ContentUnavailableView("Looking for nearby rooms", systemImage: "person.2.wave.2", description: Text("Keep Wi-Fi and Bluetooth available and allow Local Network access when asked.")) } }
                ForEach(nearby.discovered) { room in
                    Button { store.joinNearby(room) } label: { VStack(alignment: .leading, spacing: 6) { Text(room.title).font(.headline); Text("\(room.hostName) · \(room.code)").font(.subheadline).foregroundStyle(.secondary) } }
                }
                if let error = nearby.error { Section { Text(error).foregroundStyle(.red); Button("Try finding rooms again") { nearby.error = nil; store.browseNearby() } } }
            }.scrollContentBackground(.hidden).background(OStyle.cream)
            .navigationTitle("Nearby rooms").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .onAppear { store.browseNearby() }
            .onChange(of: store.currentRoom?.id) { _, id in if id != nil { dismiss() } }
            .onDisappear { if store.currentRoom == nil { nearby.stop() } }
        }
    }
}

struct ORoomView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.dismiss) private var dismiss
    let initialRoom: ORoom
    @State private var section = "Plan"
    @State private var add = false
    @State private var swipe = false
    @State private var invite = false
    @State private var leave = false
    @State private var reopen = false
    @State private var choose: OPlace?
    private var room: ORoom { store.currentRoom?.id == initialRoom.id ? store.currentRoom! : (store.history.first(where: { $0.id == initialRoom.id }) ?? initialRoom) }
    private var live: Bool { store.currentRoom?.id == initialRoom.id }
    private var host: Bool { room.hostID == store.profile.id }
    private var voted: Bool { room.ballots.contains(where: { $0.personID == store.profile.id }) }
    var body: some View {
        VStack(spacing: 0) {
            Picker("Room section", selection: $section) { Text("Plan").tag("Plan"); Text("Chat · \(room.messages.count)").tag("Chat") }.pickerStyle(.segmented).padding(.horizontal, 20).padding(.vertical, 10).accessibilityIdentifier("orbit.room.section")
            if section == "Chat" { OChatView(room: room, live: live) }
            else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        ODemoBanner()
                        VStack(alignment: .leading, spacing: 9) {
                            Text(room.title).font(.largeTitle.bold())
                            Text(room.eventDate.formatted(date: .abbreviated, time: .shortened)).foregroundStyle(.secondary)
                            Label(live ? connectionLabel : "Saved history · not connected", systemImage: live ? "circle.fill" : "clock").font(.caption).foregroundStyle(OStyle.sage)
                            if live && !store.status.isEmpty { Text(store.status).font(.caption).foregroundStyle(.secondary) }
                        }
                        members
                        if live && host && !store.pending.isEmpty { approvals }
                        if room.phase == "collecting" { collecting }
                        else if room.phase == "voting" { voting }
                        else if let place = room.selectedPlace {
                            VStack(alignment: .leading, spacing: 12) { Label("PLAN CONFIRMED", systemImage: "checkmark.circle.fill").font(.caption.weight(.semibold)).foregroundStyle(OStyle.sage); OPlaceCard(place: place); Text("The host chose this plan. Check availability with the venue before going.").font(.footnote).foregroundStyle(.secondary) }
                            OPlanActions(room: room, place: place, live: live)
                        }
                        if live && store.mode == "demo" { Button { store.simulateFriend() } label: { Label("Simulate a friend", systemImage: "sparkle").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.demo.friend") }
                        if live && host && room.phase != "collecting" { Button("Reopen suggestions") { reopen = true }.accessibilityIdentifier("orbit.room.reopen") }
                    }.padding(22)
                }
            }
        }.background(OStyle.cream)
        .navigationTitle("Your room").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if live {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if store.mode != "demo" { Button("Invite friends", systemImage: "person.badge.plus") { invite = true } }
                        Button(host ? "Close room on this phone" : "Leave room", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) { leave = true }
                    } label: { Image(systemName: "ellipsis.circle") }.accessibilityLabel("Room actions").accessibilityIdentifier("orbit.room.menu")
                }
            }
        }
        .sheet(isPresented: $add) { OAddPlaceView(includeLibrary: true) { place in
            guard store.currentRoom?.id == initialRoom.id else { store.error = "This room changed. Return to the room before suggesting a place."; return false }
            store.send(OCommand(kind: "suggest", place: place.shared)); return store.error == nil
        } }
        .sheet(isPresented: $swipe) { OSwipeView(room: room) }
        .sheet(isPresented: $invite) { OInviteView(room: room) }
        .confirmationDialog("Reopen suggestions?", isPresented: $reopen, titleVisibility: .visible) { Button("Reopen and clear votes", role: .destructive) { store.send(OCommand(kind: "reopen")) }; Button("Cancel", role: .cancel) {} } message: { Text("Everyone will need to swipe again after the options change.") }
        .confirmationDialog(host ? "Close this room on your phone?" : "Leave this room?", isPresented: $leave, titleVisibility: .visible) { Button(host ? "Close room" : "Leave room", role: .destructive) { store.leaveRoom(); dismiss() }; Button("Cancel", role: .cancel) {} } message: { Text(store.connection == "nearbyHost" ? "Nearby friends will disconnect when the host leaves. A copy of your plan stays in history." : "You will stop receiving live updates. A copy of the plan stays in history.") }
        .confirmationDialog("Confirm \(choose?.title ?? "this plan")?", isPresented: Binding(get: { choose != nil }, set: { if !$0 { choose = nil } }), titleVisibility: .visible) {
            Button("Confirm plan") { if let place = choose { store.send(OCommand(kind: "choose", placeID: place.id)) }; choose = nil }
            Button("Cancel", role: .cancel) { choose = nil }
        } message: { Text(room.pending.isEmpty ? "This becomes the group's chosen plan. It does not make a booking or charge anyone." : "\(room.pending.count) people haven't responded yet. Confirming now chooses the plan without their responses.") }
    }
    private var connectionLabel: String { switch store.connection { case "online": return "Online room · updates while open"; case "nearbyHost": return "Hosting nearby · \(ONearbyProtocol.roomCode(room.id))"; case "nearbyGuest": return "Connected nearby"; default: return store.mode == "demo" ? "Simulated room" : "Local room" } }
    private var members: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Text("\(room.members.count) people").font(.headline); Spacer(); if live && store.mode != "demo" { Button("Invite") { invite = true }.accessibilityIdentifier("orbit.room.invite") } }
            ForEach(room.members) { person in
                HStack { Text(String(person.name.prefix(1)).uppercased()).font(.caption.bold()).frame(width: 30, height: 30).background(OStyle.pale, in: Circle()); Text(person.name + (person.id == store.profile.id ? " (you)" : "")); Spacer(); Text(person.id == room.hostID ? "Host" : "Member").font(.caption).foregroundStyle(.secondary); if room.ballots.contains(where: { $0.personID == person.id }) { Image(systemName: "checkmark.circle.fill").foregroundStyle(OStyle.sage).accessibilityLabel("Preferences received") } }
            }
        }.padding(18).orbitCard()
    }
    private var approvals: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Requests to join").font(.headline)
            ForEach(store.pending) { person in HStack { Text(person.name); Spacer(); Button("Decline") { store.reject(person.id) }.foregroundStyle(.secondary); Button("Allow") { store.approve(person.id) }.fontWeight(.semibold) } }
            Text("Only allow people you recognize. Approved people can see the room and chat.").font(.caption).foregroundStyle(.secondary)
        }.padding(18).orbitCard()
    }
    @ViewBuilder private var collecting: some View {
        HStack { Text("Ideas on the table").font(.title2.bold()); Spacer(); Text("\(room.places.count)/12").font(.caption).foregroundStyle(.secondary) }
        if room.places.isEmpty { ContentUnavailableView("Start with two good options", systemImage: "mappin.and.ellipse", description: Text("Search Maps or suggest something you already saved.")) }
        ForEach(room.places) { place in
            VStack(alignment: .leading, spacing: 9) { OPlaceCard(place: place); if live && host { Button("Remove option", role: .destructive) { store.send(OCommand(kind: "remove", placeID: place.id)) }.font(.caption) } }
        }
        if live {
            Button { add = true } label: { Label("Suggest a place", systemImage: "plus").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).disabled(room.places.count >= 12 || store.isBusy).accessibilityIdentifier("orbit.room.suggest")
            if host { Button { store.send(OCommand(kind: "start")) } label: { Text("Start the swipes").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()).disabled(room.places.count < 2 || store.isBusy).accessibilityIdentifier("orbit.room.start") }
            else { Text("The host starts voting once the options are ready.").font(.footnote).foregroundStyle(.secondary) }
        }
    }
    @ViewBuilder private var voting: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(voted ? "Your preferences are in." : "What works for you?").font(.title2.bold())
            Text("\(room.ballots.count) of \(room.members.count) people have responded. Each complete response covers all \(room.places.count) options.").foregroundStyle(.secondary)
            if live { Button { swipe = true } label: { Text(voted ? "Change my preferences" : "Swipe the options").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()).accessibilityIdentifier("orbit.room.swipe") }
        }
        if voted || !live {
            Text("Where the group stands").font(.title2.bold())
            if let best = room.rankings.first, best.strongNo > 0 { Text("Every option has at least one strong no. Talk it through or reopen suggestions.").font(.subheadline).foregroundStyle(.secondary) }
            if room.ballots.isEmpty { Text("No responses yet.").foregroundStyle(.secondary) }
            ForEach(room.rankings.prefix(3)) { rank in
                VStack(alignment: .leading, spacing: 12) {
                    Text(rank.place.title).font(.title3.bold())
                    Text("\(rank.yes) yes · \(rank.strongYes) strong yes · \(rank.strongNo) strong no").font(.subheadline).foregroundStyle(OStyle.sage)
                    if !rank.place.note.isEmpty { Text(rank.place.note).font(.subheadline).foregroundStyle(.secondary) }
                    if live && host && !room.ballots.isEmpty { Button("Choose this plan") { choose = rank.place }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.room.choose") }
                }.padding(18).orbitCard()
            }
            Text("Fewer strong objections rank first, then more yeses, then preference intensity. The host makes the final choice.").font(.footnote).foregroundStyle(.secondary)
        } else { Text("Group results appear after you send your own preferences.").font(.footnote).foregroundStyle(.secondary) }
    }
}

struct OSwipeView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.dismiss) private var dismiss
    let room: ORoom
    @State private var ratings: [String: Int] = [:]
    @State private var index = 0
    @State private var drag = CGSize.zero
    @State private var exit = false
    @State private var error: String?
    private var valid: Bool { store.currentRoom?.id == room.id && store.currentRoom?.optionRevision == room.optionRevision && store.currentRoom?.phase == "voting" }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    ODemoBanner()
                    if !valid {
                        ContentUnavailableView("The room changed", systemImage: "arrow.clockwise", description: Text("Return to the room to see the latest options. No partial responses were sent."))
                        Button("Back to room") { dismiss() }.buttonStyle(OPrimaryButton())
                    } else if index < room.places.count {
                        HStack { Text("\(index + 1) OF \(room.places.count)").font(.caption.weight(.semibold)).foregroundStyle(OStyle.sage); Spacer(); Text("Your preference").font(.caption).foregroundStyle(.secondary) }
                        ProgressView(value: Double(index), total: Double(max(1, room.places.count)))
                        OPlaceCard(place: room.places[index], large: true).accessibilityIdentifier("orbit.swipe.card")
                            .offset(x: drag.width * 0.25, y: drag.height * 0.15)
                            .rotationEffect(.degrees(Double(drag.width / 45)))
                            .gesture(DragGesture(minimumDistance: 25).onChanged { drag = $0.translation }.onEnded { value in
                                let movement = value.translation; drag = .zero
                                guard max(abs(movement.width), abs(movement.height)) > 65 else { return }
                                rate(abs(movement.width) > abs(movement.height) ? (movement.width > 0 ? 1 : -1) : (movement.height < 0 ? 2 : -2))
                            })
                        VStack(spacing: 10) { ratingButton("Strong yes", symbol: "arrow.up", value: 2, id: "strongYes"); HStack(spacing: 10) { ratingButton("Weak no", symbol: "arrow.left", value: -1, id: "weakNo"); ratingButton("Weak yes", symbol: "arrow.right", value: 1, id: "weakYes") }; ratingButton("Strong no", symbol: "arrow.down", value: -2, id: "strongNo") }
                        Text("Swipe a direction or tap a button. Strong no is an objection the group will see. Nothing is sent until you finish and confirm.").font(.footnote).foregroundStyle(.secondary)
                    } else {
                        Image(systemName: "checkmark.circle").font(.system(size: 46, weight: .light)).foregroundStyle(OStyle.sage)
                        Text("Ready to send.").font(.largeTitle.bold())
                        Text("Your complete response will be shared with the room. You can change it while voting stays open.").foregroundStyle(.secondary)
                        ForEach(room.places) { place in HStack { Text(place.title); Spacer(); Text(label(ratings[place.id.uuidString.lowercased()] ?? 0)).font(.subheadline).foregroundStyle(OStyle.sage) }.padding(14).orbitCard() }
                        Button {
                            guard valid else { return }
                            let ballot = OBallot(personID: store.profile.id, optionRevision: room.optionRevision, ratings: ratings)
                            do { try room.validate(ballot); store.send(OCommand(kind: "vote", ballot: ballot)); dismiss() }
                            catch { self.error = error.localizedDescription }
                        } label: { Text("Send my preferences").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()).disabled(store.isBusy).accessibilityIdentifier("orbit.swipe.submit")
                    }
                }.padding(22)
            }.background(OStyle.cream)
            .navigationTitle("A quick swipe").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { if index > 0 { exit = true } else { dismiss() } } }
                if index > 0 && valid { ToolbarItem(placement: .topBarTrailing) { Button("Undo") { index -= 1; ratings.removeValue(forKey: room.places[index].id.uuidString.lowercased()) }.accessibilityIdentifier("orbit.swipe.undo") } }
            }
            .interactiveDismissDisabled(index > 0)
            .confirmationDialog("Discard these unsent preferences?", isPresented: $exit, titleVisibility: .visible) { Button("Discard", role: .destructive) { dismiss() }; Button("Keep swiping", role: .cancel) {} }
            .alert("Couldn't send preferences", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK", role: .cancel) {} } message: { Text(error ?? "") }
        }
    }
    private func rate(_ value: Int) { guard valid, index < room.places.count else { return }; ratings[room.places[index].id.uuidString.lowercased()] = value; withAnimation(.easeOut(duration: 0.15)) { index += 1; drag = .zero } }
    private func label(_ value: Int) -> String { switch value { case 2: return "Strong yes"; case 1: return "Weak yes"; case -1: return "Weak no"; case -2: return "Strong no"; default: return "Unrated" } }
    private func ratingButton(_ title: String, symbol: String, value: Int, id: String) -> some View { Button { rate(value) } label: { Label(title, systemImage: symbol).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, 14).foregroundStyle(OStyle.sage).background(value == 2 ? OStyle.pale : .white, in: RoundedRectangle(cornerRadius: 12)) }.accessibilityIdentifier("orbit.vote.\(id)") }
}

struct OChatView: View {
    @EnvironmentObject private var store: OrbitStore
    let room: ORoom
    let live: Bool
    @State private var draft = ""
    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { reader in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        ODemoBanner()
                        if room.messages.isEmpty { ContentUnavailableView("Start the conversation", systemImage: "bubble.left.and.bubble.right", description: Text("Ask a question or suggest what would make this plan work for you.")) }
                        ForEach(room.messages) { message in
                            HStack {
                                if message.personID == store.profile.id { Spacer(minLength: 35) }
                                VStack(alignment: .leading, spacing: 7) {
                                    HStack { Text(message.name).font(.caption.weight(.semibold)); Spacer(); Text(message.createdAt.formatted(date: .omitted, time: .shortened)).font(.caption2).foregroundStyle(.secondary) }
                                    Text(message.text).font(.body).textSelection(.enabled)
                                }.padding(14).background(message.personID == store.profile.id ? OStyle.pale : .white, in: RoundedRectangle(cornerRadius: 16))
                                if message.personID != store.profile.id { Spacer(minLength: 35) }
                            }.id(message.id)
                        }
                        Color.clear.frame(height: 1).id("chat-bottom")
                    }.padding(20)
                }
                .onAppear { reader.scrollTo("chat-bottom", anchor: .bottom) }
                .onChange(of: room.messages.last?.id) { _, _ in
                    if let last = room.messages.last, last.personID == store.profile.id, last.text == draft.trimmingCharacters(in: .whitespacesAndNewlines) { draft = "" }
                    withAnimation { reader.scrollTo("chat-bottom", anchor: .bottom) }
                }
            }
            if live {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .bottom, spacing: 12) {
                        TextField("Message the room", text: $draft, axis: .vertical).lineLimit(1...4).padding(13).background(.white, in: RoundedRectangle(cornerRadius: 14)).accessibilityIdentifier("orbit.chat.input")
                        Button { store.send(OCommand(kind: "chat", text: draft.trimmingCharacters(in: .whitespacesAndNewlines))) } label: { Image(systemName: "arrow.up").font(.headline).frame(width: 45, height: 45).foregroundStyle(.white).background(OStyle.sage, in: Circle()) }.disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.count > 1_000 || store.isBusy).accessibilityLabel("Send message").accessibilityIdentifier("orbit.chat.send")
                    }
                    if draft.count > 900 { Text("\(draft.count)/1,000 characters").font(.caption).foregroundStyle(draft.count > 1_000 ? .red : .secondary) }
                }.padding(.horizontal, 18).padding(.vertical, 12).background(OStyle.cream)
            } else { Text("This is saved history. Join a live room to continue chatting.").font(.footnote).foregroundStyle(.secondary).padding() }
        }
    }
}

struct OInviteView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.dismiss) private var dismiss
    let room: ORoom
    @State private var contacts = false
    @State private var composer = false
    @State private var recipients: [(name: String, number: String)] = []
    @State private var feedback: String?
    private var bodyText: String { "Join me in Orbit for \(room.title). Suggest a place, swipe the options, and chat here: \(store.inviteURL?.absoluteString ?? "")" }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Image(systemName: "person.badge.plus").font(.system(size: 40, weight: .light)).foregroundStyle(OStyle.sage)
                    Text("Bring your people in.").font(.largeTitle.bold())
                    if let url = store.inviteURL, store.connection == "online" {
                        Text("Send this link. Friends can request to join from another phone; the host approves each request.").foregroundStyle(.secondary)
                        ShareLink(item: url, subject: Text("Join \(room.title)"), message: Text("Join our room in Orbit.")) { Label("Share invite link", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()).accessibilityIdentifier("orbit.invite.share")
                        Text(url.absoluteString).font(.caption).foregroundStyle(.secondary).textSelection(.enabled).padding(14).orbitCard()
                        ForEach(Array(recipients.enumerated()), id: \.offset) { index, recipient in HStack { VStack(alignment: .leading) { Text(recipient.name); Text(recipient.number).font(.caption).foregroundStyle(.secondary) }; Spacer(); Button { recipients.remove(at: index) } label: { Image(systemName: "xmark.circle") }.accessibilityLabel("Remove \(recipient.name)") } }
                        Button { contacts = true } label: { Label("Choose a contact", systemImage: "person.crop.circle.badge.plus").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.invite.contact")
                        Button {
                            if MFMessageComposeViewController.canSendText() { composer = true }
                            else { feedback = "Messages is unavailable here. On a configured iPhone, this opens a real message you can review and send. You can still use Share invite link on this device." }
                        } label: { Label("Open in Messages", systemImage: "message").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.invite.message")
                        Text("Orbit only receives the contact you choose. Choosing a contact doesn't send anything; you review and send the invitation in Messages.").font(.footnote).foregroundStyle(.secondary)
                    } else {
                        Text("This room is available to phones nearby. Ask your friends to open Orbit, tap Nearby, and select this room.").foregroundStyle(.secondary)
                        VStack(alignment: .leading, spacing: 8) { Text("ROOM CODE").font(.caption.weight(.semibold)).foregroundStyle(OStyle.sage); Text(ONearbyProtocol.roomCode(room.id)).font(.system(size: 38, weight: .bold, design: .monospaced)); Text("Compare this code before the host approves a join request.").font(.subheadline).foregroundStyle(.secondary) }.padding(20).orbitCard()
                        Text("Keep the app open and remain nearby. An online room is needed to invite someone in another location.").font(.footnote).foregroundStyle(.secondary)
                    }
                }.padding(24)
            }.background(OStyle.cream).navigationTitle("Invite friends").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
            .sheet(isPresented: $contacts) {
                OContactPicker(onPick: { name, phone in
                    contacts = false
                    guard let phone, !phone.isEmpty else { feedback = "That contact has no phone number. Choose another contact, or use Share invite link."; return }
                    if !recipients.contains(where: { $0.number == phone }) { recipients.append((name, phone)) }
                }, onCancel: { contacts = false })
            }
            .sheet(isPresented: $composer) { OMessageComposer(recipients: recipients.map(\.number), body: bodyText, onComplete: { composer = false }, onError: { feedback = $0 }, onSent: { feedback = "Messages accepted your invitation for sending. Delivery is handled by Messages." }) }
            .alert("Invitation", isPresented: Binding(get: { feedback != nil }, set: { if !$0 { feedback = nil } })) { Button("OK", role: .cancel) {} } message: { Text(feedback ?? "") }
        }
    }
}

enum OPlanAction: String, Identifiable { case calendar, reminder, notification; var id: String { rawValue } }
struct OPlanActions: View {
    @EnvironmentObject private var store: OrbitStore
    let room: ORoom
    let place: OPlace
    let live: Bool
    @State private var action: OPlanAction?
    @State private var error: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("Make it happen").font(.title2.bold())
            if store.mode == "demo" { Text("These actions use your real phone apps, even in demo. Calendar lets you review before saving.").font(.footnote).foregroundStyle(.secondary) }
            Button { openMaps() } label: { Label("Open in Maps", systemImage: "map").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()).accessibilityIdentifier("orbit.plan.maps")
            if let url = place.webURL { Link(destination: url) { Label("Open original link", systemImage: "arrow.up.right.square").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()) }
            Button { action = .calendar } label: { Label("Add to Calendar", systemImage: "calendar.badge.plus").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.plan.calendar")
            Button { action = .reminder } label: { Label("Add to Reminders", systemImage: "checklist").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.plan.reminder")
            Button { action = .notification } label: { Label("Notify me on this phone", systemImage: "bell").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.plan.notification")
            ShareLink(item: "\(room.title)\n\(place.title)\n\(room.eventDate.formatted(date: .complete, time: .shortened))\n\(place.address)\n\(place.url)") { Label("Share the confirmed plan", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton())
            Text("Reservations and payments stay with the venue. Orbit doesn't book or buy anything automatically.").font(.footnote).foregroundStyle(.secondary)
        }
        .sheet(item: $action) { kind in OPlanActionView(room: room, place: place, kind: kind, wasLive: live) }
        .alert("Maps", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK", role: .cancel) {} } message: { Text(error ?? "") }
    }
    private func openMaps() {
        if let coordinate = OPhoneValidation.coordinate(latitude: place.latitude, longitude: place.longitude) {
            let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
            item.name = place.title
            item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking])
        } else if store.mode == "demo" { error = "This fictional demo place has no real map location. Add a place from Maps search to try directions." }
        else {
            var components = URLComponents(string: "https://maps.apple.com/")!
            components.queryItems = [URLQueryItem(name: "q", value: place.address.isEmpty ? place.title : "\(place.title), \(place.address)")]
            if let url = components.url { UIApplication.shared.open(url) }
        }
    }
}

struct OPlanActionView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.dismiss) private var dismiss
    let room: ORoom
    let place: OPlace
    let kind: OPlanAction
    let wasLive: Bool
    @State private var date = Date().addingTimeInterval(3_600)
    @State private var calendar = false
    @State private var busy = false
    @State private var success: String?
    @State private var error: String?
    @State private var operation: Task<Void, Never>?
    @State private var startingMode = ""
    private var stillValid: Bool { store.mode == startingMode && (!wasLive || (store.currentRoom?.id == room.id && store.currentRoom?.selectedPlaceID == place.id && store.currentRoom?.phase == "decided")) }
    private var title: String { switch kind { case .calendar: return "Add to Calendar"; case .reminder: return "Add to Reminders"; case .notification: return "Notify me" } }
    var body: some View {
        NavigationStack {
            Form {
                Section { Text(place.title).font(.headline); Text(room.title).foregroundStyle(.secondary); DatePicker(kind == .calendar ? "Plan starts" : "When", selection: $date, in: Date()...) }
                if let success { Section { Label(success, systemImage: "checkmark.circle.fill").foregroundStyle(OStyle.sage); Button("Done") { dismiss() } } }
                else {
                    Section {
                        Text(kind == .calendar ? "Open the native calendar editor to choose a calendar, review details, and save or cancel. Orbit doesn't request access to your calendar history." : (kind == .reminder ? "This saves a real reminder in your default Reminders list. Apple requires Reminders access for this action." : "This schedules a notification on this device. Orbit will ask for permission if needed. It doesn't notify the rest of the group.")).font(.subheadline).foregroundStyle(.secondary)
                        Button(busy ? "Working…" : (kind == .calendar ? "Review in Calendar" : title)) { perform() }.disabled(busy).accessibilityIdentifier("orbit.action.confirm")
                    }
                }
            }.scrollContentBackground(.hidden).background(OStyle.cream).navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { operation?.cancel(); dismiss() } } }
            .onAppear { startingMode = store.mode; date = room.eventDate > Date() ? room.eventDate : Date().addingTimeInterval(3_600) }
            .onDisappear { operation?.cancel() }
            .sheet(isPresented: $calendar) { OCalendarEditor(place: place, title: "\(room.title): \(place.title)", date: date, onComplete: { saved in calendar = false; if saved { success = "Saved to Calendar." } }, onError: { error = $0 }) }
            .alert("Couldn't finish that", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK", role: .cancel) {} } message: { Text(error ?? "") }
        }
    }
    private func perform() {
        do { try OPhoneValidation.futureDate(date); guard stillValid else { throw OError.message("The plan changed. Return to the room before saving it to your phone.") } }
        catch { self.error = error.localizedDescription; return }
        if kind == .calendar { calendar = true; return }
        busy = true
        operation = Task { @MainActor in
            defer { busy = false }
            do {
                if kind == .reminder {
                    try await OPhoneActions.addReminder(title: "\(room.title): \(place.title)", notes: [place.address, place.note, place.url].filter { !$0.isEmpty }.joined(separator: "\n"), due: date, isStillValid: { stillValid })
                    success = "Saved to the Reminders app."
                } else {
                    try await OPhoneActions.scheduleNotification(id: "plan.\(room.id.uuidString)", title: room.title, body: place.title, date: date, isStillValid: { stillValid })
                    success = "Notification scheduled for \(date.formatted(date: .abbreviated, time: .shortened))."
                }
            } catch is CancellationError { }
            catch { self.error = error.localizedDescription }
        }
    }
}

struct OPlaceCard: View {
    let place: OPlace
    var large = false
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let data = place.photoData, let image = UIImage(data: data) { Image(uiImage: image).resizable().scaledToFill().frame(height: large ? 160 : 110).clipped().clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityHidden(true) }
            else if large { ZStack { OStyle.pale; Image(systemName: "mappin.and.ellipse").font(.system(size: 42, weight: .light)).foregroundStyle(OStyle.sage) }.frame(height: 145).clipShape(RoundedRectangle(cornerRadius: 14)).accessibilityHidden(true) }
            HStack { Text(place.category.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(OStyle.sage); Spacer(); if let price = place.price { Text("~$\(price)").font(.subheadline).foregroundStyle(.secondary) } }
            Text(place.title).font(large ? .title.bold() : .headline).foregroundStyle(OStyle.ink)
            if !place.address.isEmpty { Label(place.address, systemImage: "mappin").font(.caption).foregroundStyle(.secondary).lineLimit(2) }
            if !place.note.isEmpty { Text(place.note).font(.subheadline).foregroundStyle(.secondary).lineLimit(large ? 5 : 3) }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(18).orbitCard()
    }
}

struct OPlacesView: View {
    @EnvironmentObject private var store: OrbitStore
    @State private var query = ""
    @State private var add = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ODemoBanner()
                    VStack(alignment: .leading, spacing: 7) { Text("Your next good idea.").font(.largeTitle.bold()); Text("Keep places here. Share one with a room when it's relevant.").foregroundStyle(.secondary) }
                    if store.places.isEmpty { ContentUnavailableView { Label("Save somewhere to try", systemImage: "bookmark") } description: { Text("Search real places in Maps, write a note, or add a photo.") } actions: { Button("Add a place") { add = true }.buttonStyle(OSecondaryButton()) } }
                    else {
                        let shown = store.places.filter { query.isEmpty || "\($0.title) \($0.note) \($0.category) \($0.address)".localizedCaseInsensitiveContains(query) }
                        if shown.isEmpty { ContentUnavailableView.search(text: query) }
                        ForEach(shown) { place in NavigationLink { OSavedPlaceView(placeID: place.id) } label: { OPlaceCard(place: place) }.buttonStyle(.plain).accessibilityIdentifier("orbit.place.\(place.title)") }
                    }
                }.padding(22)
            }.background(OStyle.cream).navigationTitle("Saved places").navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search your places")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { add = true } label: { Image(systemName: "plus") }.accessibilityLabel("Add place").accessibilityIdentifier("orbit.place.add") } }
            .sheet(isPresented: $add) { OAddPlaceView(includeLibrary: false) { store.savePlace($0) } }
        }
    }
}

struct OSavedPlaceView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.dismiss) private var dismiss
    let placeID: UUID
    @State private var edit = false
    @State private var delete = false
    private var place: OPlace? { store.places.first { $0.id == placeID } }
    var body: some View {
        Group {
            if let place {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        ODemoBanner(); OPlaceCard(place: place, large: true)
                        if let url = place.webURL { Link(destination: url) { Label("Open original link", systemImage: "arrow.up.right.square").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()) }
                        if let room = store.currentRoom, room.phase == "collecting" {
                            Button { store.send(OCommand(kind: "suggest", place: place.shared)) } label: { Label("Suggest in \(room.title)", systemImage: "person.2").frame(maxWidth: .infinity) }.buttonStyle(OSecondaryButton()).disabled(room.places.contains(where: { $0.id == place.id }) || store.isBusy)
                            Text("The title, note, address, source link, and estimate are shared. Your photo stays in your private library.").font(.footnote).foregroundStyle(.secondary)
                        }
                        Button("Edit place") { edit = true }.buttonStyle(OSecondaryButton()).accessibilityIdentifier("orbit.place.edit")
                        Button("Delete saved place", role: .destructive) { delete = true }.accessibilityIdentifier("orbit.place.delete")
                        Text("Your saved places stay on this device. A place already suggested in a room remains there if you delete your private copy.").font(.footnote).foregroundStyle(.secondary)
                    }.padding(22)
                }.background(OStyle.cream)
                .sheet(isPresented: $edit) { NavigationStack { OPlaceEditor(initial: place) { value in let saved = store.savePlace(value); if saved { edit = false }; return saved }.toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { edit = false } } } } }
                .confirmationDialog("Delete this saved place?", isPresented: $delete, titleVisibility: .visible) { Button("Delete place", role: .destructive) { store.deletePlace(placeID); if !store.places.contains(where: { $0.id == placeID }) { dismiss() } }; Button("Cancel", role: .cancel) {} }
            } else { ContentUnavailableView("Place removed", systemImage: "bookmark.slash") }
        }.navigationTitle("Your place").navigationBarTitleDisplayMode(.inline)
    }
}

struct OAddPlaceView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var search = OPlaceSearch()
    @StateObject private var location = OLocation()
    let includeLibrary: Bool
    let onSave: (OPlace) -> Bool
    @State private var query = ""
    @State private var source = "Maps"
    @State private var pendingPlaceID: UUID?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(includeLibrary ? "One more good option." : "Somewhere worth saving.").font(.title.bold())
                    Picker("Source", selection: $source) { Text("Maps").tag("Maps"); if includeLibrary { Text("Saved").tag("Saved") }; Text("Write one").tag("Write") }.pickerStyle(.segmented).accessibilityIdentifier("orbit.add.source")
                    if source == "Maps" {
                        Text("Search actual Apple Maps listings. Results need an internet connection; a price estimate is yours to add.").font(.subheadline).foregroundStyle(.secondary)
                        HStack { TextField("Place, food, or city", text: $query).submitLabel(.search).onSubmit { runSearch() }.textInputAutocapitalization(.words).accessibilityIdentifier("orbit.maps.query"); Button { runSearch() } label: { Image(systemName: "magnifyingglass").padding(10) }.accessibilityLabel("Search Maps").accessibilityIdentifier("orbit.maps.search") }.padding(12).orbitCard()
                        Button { location.request() } label: { Label(location.requesting ? "Finding location…" : "Use my location", systemImage: "location") }.disabled(location.requesting).accessibilityIdentifier("orbit.maps.location")
                        if let status = location.status { Text(status).font(.caption).foregroundStyle(.secondary) }
                        if search.isSearching { ProgressView("Searching Apple Maps…").frame(maxWidth: .infinity).padding() }
                        if let error = search.error { Text(error).font(.subheadline).foregroundStyle(.secondary) }
                        ForEach(search.results) { place in NavigationLink { OPlaceEditor(initial: place, allowsPhoto: !includeLibrary, onSave: submit) } label: { OPlaceCard(place: place) }.buttonStyle(.plain).accessibilityIdentifier("orbit.maps.result") }
                        if !query.isEmpty && !search.isSearching && search.results.isEmpty && search.error == nil { Text("No results to show yet. Search a name with its city, or write your own option.").font(.footnote).foregroundStyle(.secondary) }
                    } else if source == "Saved" {
                        if store.places.isEmpty { ContentUnavailableView("No saved places yet", systemImage: "bookmark", description: Text("Search Maps or write an idea to get started.")) }
                        ForEach(store.places) { place in Button { _ = submit(place) } label: { OPlaceCard(place: place) }.buttonStyle(.plain).disabled(store.isBusy) }
                    } else {
                        Text("Save a place, an activity, or any idea. Include only details you know.").foregroundStyle(.secondary)
                        NavigationLink { OPlaceEditor(initial: OPlace(title: ""), allowsPhoto: !includeLibrary, onSave: submit) } label: { Label(includeLibrary ? "Write an idea" : "Write an idea or add a photo", systemImage: "square.and.pencil").frame(maxWidth: .infinity) }.buttonStyle(OPrimaryButton()).accessibilityIdentifier("orbit.add.manual")
                    }
                }.padding(22)
            }.background(OStyle.cream).navigationTitle(includeLibrary ? "Suggest a place" : "Add a place").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .onChange(of: location.coordinate?.latitude) { _, _ in if location.coordinate != nil && !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { runSearch() } }
            .onChange(of: store.currentRoom?.revision) { _, _ in if let pendingPlaceID, store.currentRoom?.places.contains(where: { $0.id == pendingPlaceID }) == true { dismiss() } }
            .onDisappear { search.cancel(); location.cancel() }
        }
    }
    private func runSearch() { Task { await search.search(query, near: location.coordinate) } }
    private func submit(_ place: OPlace) -> Bool {
        pendingPlaceID = includeLibrary ? place.id : nil
        let accepted = onSave(place)
        if accepted && (!includeLibrary || store.currentRoom?.places.contains(where: { $0.id == place.id }) == true) { dismiss() }
        return accepted
    }
}

struct OPlaceEditor: View {
    @EnvironmentObject private var store: OrbitStore
    let initial: OPlace
    let allowsPhoto: Bool
    let onSave: (OPlace) -> Bool
    @State private var place: OPlace
    @State private var price = ""
    @State private var photo: PhotosPickerItem?
    @State private var loading = false
    @State private var error: String?
    init(initial: OPlace, allowsPhoto: Bool = true, onSave: @escaping (OPlace) -> Bool) { self.initial = initial; self.allowsPhoto = allowsPhoto; self.onSave = onSave; _place = State(initialValue: initial); _price = State(initialValue: initial.price.map(String.init) ?? "") }
    var body: some View {
        Form {
            Section("The idea") {
                TextField("Place or idea name", text: $place.title, axis: .vertical).accessibilityIdentifier("orbit.editor.title")
                TextField("Category, e.g. Dinner", text: $place.category)
                TextField("Address or location", text: $place.address, axis: .vertical)
                TextField("What should your friends know?", text: $place.note, axis: .vertical).lineLimit(3...6).accessibilityIdentifier("orbit.editor.note")
            }
            Section {
                TextField("https://…", text: $place.url).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityLabel("Original link")
                HStack { Text("Estimated cost ($)"); Spacer(); TextField("Unknown", text: $price).keyboardType(.numberPad).multilineTextAlignment(.trailing).accessibilityIdentifier("orbit.editor.price") }
            } footer: { Text("Estimates are not verified prices. Leave the cost blank if you don't know.") }
            if allowsPhoto { Section {
                if let data = place.photoData, let image = UIImage(data: data) { Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 180); Button("Remove photo", role: .destructive) { place.photoData = nil } }
                PhotosPicker(selection: $photo, matching: .images) { Label(loading ? "Preparing photo…" : "Choose a photo", systemImage: "photo") }.disabled(loading).accessibilityIdentifier("orbit.editor.photo")
            } header: { Text("Private photo") } footer: { Text("Photos stay in your saved library and are not sent to a room. Save privately first if you want to keep the photo.") } }
            Button(store.isBusy ? "Waiting for confirmation…" : "Save idea") { save() }.fontWeight(.semibold).disabled(loading || store.isBusy).accessibilityIdentifier("orbit.editor.save")
        }.scrollContentBackground(.hidden).background(OStyle.cream).navigationTitle("Review the idea").navigationBarTitleDisplayMode(.inline)
        .onChange(of: photo) { _, selected in
            guard let selected else { return }
            loading = true
            Task {
                defer { loading = false; photo = nil }
                do {
                    guard let data = try await selected.loadTransferable(type: Data.self), data.count <= 30_000_000,
                          let source = CGImageSourceCreateWithData(data as CFData, nil),
                          let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 1_400, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary),
                          let imageData = UIImage(cgImage: thumbnail).jpegData(compressionQuality: 0.75), imageData.count <= 3_000_000 else { throw OError.message("This photo couldn't be prepared. Choose a smaller image under 30 MB.") }
                    place.photoData = imageData
                } catch { self.error = error.localizedDescription }
            }
        }
        .alert("Check the idea", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK", role: .cancel) {} } message: { Text(error ?? "") }
    }
    private func save() {
        place.title = place.title.trimmingCharacters(in: .whitespacesAndNewlines)
        place.category = place.category.trimmingCharacters(in: .whitespacesAndNewlines)
        if place.category.isEmpty { place.category = "Place" }
        place.url = place.url.trimmingCharacters(in: .whitespacesAndNewlines)
        if !place.url.isEmpty && !place.url.contains("://") { place.url = "https://" + place.url }
        let value = price.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.isEmpty || (Int(value).map { (0...100_000).contains($0) } ?? false) else { error = "Use a whole-dollar estimate between 0 and 100,000, or leave it blank."; return }
        place.price = Int(value)
        do { try place.validate(); if !onSave(place) { error = store.error ?? "This idea could not be saved. Your draft is still here."; store.error = nil } }
        catch { self.error = error.localizedDescription }
    }
}

struct OYouView: View {
    @EnvironmentObject private var store: OrbitStore
    @State private var reset = false
    @State private var erase = false
    @State private var switchMode = false
    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) { Text(store.profile.name).font(.largeTitle.bold()); Label(store.mode == "demo" ? "Demo profile" : "Your profile on this device", systemImage: store.mode == "demo" ? "sparkle" : "person.crop.circle").foregroundStyle(OStyle.sage); Text("\(store.places.count) saved places · \(store.history.count) recent rooms").font(.subheadline).foregroundStyle(.secondary) }.padding(.vertical, 8)
                }
                Section("Try it your way") {
                    Button(store.mode == "demo" ? "Switch to my personal space" : "Try the demo room") { if store.currentRoom != nil { switchMode = true } else { store.switchMode(store.mode != "demo") } }.accessibilityIdentifier("orbit.settings.mode")
                    if store.mode == "demo" { Button("Reset the demo") { reset = true }.accessibilityIdentifier("orbit.settings.reset") }
                }
                Section {
                    NavigationLink("How rooms work") { OHelpView() }
                    NavigationLink("Privacy & phone permissions") { OPrivacyView() }
                    if store.mode != "demo" { Button("Erase personal data from this phone", role: .destructive) { erase = true }.accessibilityIdentifier("orbit.settings.erase") }
                }
                Section { Text("Orbit · 1.0\nPeople, places, one plan.").font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity).multilineTextAlignment(.center).listRowBackground(Color.clear) }
            }.scrollContentBackground(.hidden).background(OStyle.cream).navigationTitle("Your space")
            .confirmationDialog("Switch spaces and leave this room?", isPresented: $switchMode, titleVisibility: .visible) { Button("Switch spaces") { store.switchMode(store.mode != "demo") }; Button("Cancel", role: .cancel) {} } message: { Text("Your private saved places stay separate. A nearby room disconnects when its host leaves.") }
            .confirmationDialog("Reset the demo?", isPresented: $reset, titleVisibility: .visible) { Button("Reset demo", role: .destructive) { store.resetDemo() }; Button("Cancel", role: .cancel) {} } message: { Text("Demo edits are replaced with sample data. Your personal space stays separate. Items you explicitly saved to Calendar or Reminders remain in those apps.") }
            .confirmationDialog("Erase your personal data from this phone?", isPresented: $erase, titleVisibility: .visible) { Button("Erase personal data", role: .destructive) { store.erasePersonalData() }; Button("Cancel", role: .cancel) {} } message: { Text("This removes your personal profile, saved places, and local history and leaves your room. Content already shared online or with other phones may remain there. Calendar events and Reminders you saved are managed in those apps.") }
        }
    }
}

struct OHelpView: View {
    var body: some View {
        List {
            Section("Make a room") { Text("Create an online room for friends in different places, or a nearby room when everyone is together. Give the plan a title and time. Add at least two options, then start voting.") }
            Section("Bring friends") { Text("Online: share the invitation link and approve requests. Nearby: friends tap Nearby and compare the room code before you approve. Rooms support up to eight people. Nearby participants need Orbit open and in range.") }
            Section("Decide together") { Text("Swipe up for strong yes, right for weak yes, left for weak no, and down for strong no. Buttons work too. Send your complete response at the end. Fewer strong objections rank first; the host confirms the plan. Reopening suggestions clears votes so everyone responds to the same options.") }
            Section("Talk in the room") { Text("Use Chat for questions and details. Online rooms update while Orbit is open, and expire after seven days. Orbit doesn't send background chat notifications.") }
            Section("Use your phone") { Text("Search real Maps listings, pick a single contact for Messages, review a native Calendar event, add a real Reminder, or schedule a local notification. The app asks for each permission when you choose the relevant action. Messages sending needs a configured physical device.") }
            Section("Try demo mode") { Text("Demo rooms have fictional places, people, votes, and messages. Simulate a friend generates a labeled sample response. Calendar, Reminders, Maps search, and notifications still use real phone features when you explicitly open them.") }
        }.scrollContentBackground(.hidden).background(OStyle.cream).navigationTitle("How Orbit works")
    }
}

struct OPrivacyView: View {
    var body: some View {
        List {
            Section("Private saves") { Text("Your profile and saved places are stored by Orbit on this device. Photos are excluded when you suggest a place in a room. Your device's backup settings may include local app data.") }
            Section("What a room shares") { Text("Approved members can see names, suggestions, preference responses, and messages. Online room data is stored on Orbit's service and expires after seven days. Invite links allow people to request access; share them with people you trust. Nearby room content travels through encrypted connections between the host and approved phones.") }
            Section("Maps and location") { Text("Searching Maps sends your search to Apple. Location is requested only when you tap Use my location, and is used to focus that search. Orbit doesn't continuously track your location. Coordinates of a place you suggest are shared with the room.") }
            Section("Contacts and Messages") { Text("The contact picker only returns the person or phone number you choose; Orbit doesn't scan or upload your address book. A Messages invitation is not sent until you choose Send in the native composer. Messages manages delivery.") }
            Section("Calendar and Reminders") { Text("The native Calendar editor lets you save an event without giving Orbit access to your calendar history. Adding a Reminder requires Apple's Reminders permission. Orbit uses that access to save the reminder you requested and doesn't retrieve your reminder lists for recommendations.") }
            Section("Deleting data") { Text("Erasing personal data removes the copy on this phone. Previously shared content can remain with other room members or the online service until expiry. Events and reminders you explicitly saved to other apps are managed there. There are no ads or third-party analytics in Orbit.") }
        }.scrollContentBackground(.hidden).background(OStyle.cream).navigationTitle("Privacy")
    }
}

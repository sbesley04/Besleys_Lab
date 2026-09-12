import SwiftUI
import UIKit

struct GSharedFile: Identifiable { let id = UUID(); let url: URL }
struct GActivitySheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

struct GSessionDetail: View {
    @EnvironmentObject var store: GStore
    @Environment(\.dismiss) private var dismiss
    @State private var editing = false
    @State private var voting = false
    @State private var reminders = false
    @State private var sharedFile: GSharedFile?
    @State private var chosenTarget: GCandidate?
    @State private var confirmDelete = false
    @State private var confirmReopen = false
    let sessionID: UUID
    var body: some View {
        Group {
            if let session = store.session(sessionID) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        if store.mode == .demo { GDemoBanner() }
                        VStack(alignment: .leading, spacing: 10) {
                            GTag(title: session.isOrganizer ? "You organize" : "Invited decision", symbol: "person.2")
                            Text(session.title).font(.largeTitle.bold())
                            if !session.context.isEmpty { Text(session.context).font(.subheadline).foregroundStyle(GTheme.muted) }
                        }
                        if let chosen = session.chosenCandidate { chosenPlan(session, chosen: chosen) }
                        else {
                            Button { voting = true } label: { Label(session.isOrganizer ? "Swipe your preferences" : "Choose your name & vote", systemImage: "hand.draw") }
                                .buttonStyle(GPrimaryButton()).accessibilityIdentifier("vote.start")
                        }
                        if session.isOrganizer {
                            responseSummary(session)
                            if session.chosenCandidateID == nil {
                                Button { shareInvitation(session) } label: { Label("Send invitation file", systemImage: "square.and.arrow.up") }
                                    .buttonStyle(GSecondaryButton()).accessibilityIdentifier("invitation.share")
                                Text("Friends open the .gather attachment in Gather, vote, then send a response file back. Import their replies from the home screen. Files do not sync automatically; there is no web voting page.")
                                    .font(.footnote).foregroundStyle(GTheme.muted)
                            }
                            results(session)
                        } else {
                            GCard {
                                VStack(alignment: .leading, spacing: 10) {
                                    Label("Send your response back", systemImage: "envelope").font(.headline)
                                    Text("This is your private copy. The organizer’s votes are not included, and results do not update here. After swiping, share your response file with the organizer.").font(.subheadline).foregroundStyle(GTheme.muted)
                                    if !session.completeBallots.isEmpty {
                                        ForEach(session.completeBallots) { ballot in
                                            Button { shareBallot(ballot, session: session) } label: {
                                                Label("Send \(session.participants.first(where: { $0.id == ballot.participantID })?.name ?? "my") response", systemImage: "square.and.arrow.up")
                                            }.buttonStyle(GSecondaryButton())
                                        }
                                    }
                                }
                            }
                        }
                        VStack(alignment: .leading, spacing: 12) {
                            Text("THE SHORTLIST").font(.caption.bold()).tracking(1.5).foregroundStyle(GTheme.muted)
                            ForEach(session.candidates) { candidate in
                                GCard {
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text(candidate.title).font(.headline)
                                        if !candidate.detail.isEmpty { Text(candidate.detail).font(.subheadline).foregroundStyle(GTheme.muted) }
                                        Label("$\(candidate.price) per person · \(candidate.minutes) min away", systemImage: "location").font(.caption).foregroundStyle(GTheme.muted)
                                        if let url = URL(string: candidate.url), !candidate.url.isEmpty {
                                            Link(destination: url) { Label("View website", systemImage: "arrow.up.right") }.font(.subheadline)
                                        }
                                    }
                                }
                            }
                        }
                    }.padding(20)
                }.background(GTheme.background)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            if session.isOrganizer { Button("Edit decision", systemImage: "pencil") { editing = true } }
                            if session.chosenCandidateID != nil { Button("Reopen decision", systemImage: "arrow.uturn.backward") { confirmReopen = true } }
                            Button("Delete decision", systemImage: "trash", role: .destructive) { confirmDelete = true }
                        } label: { Image(systemName: "ellipsis.circle") }.accessibilityLabel("Decision options")
                    }
                }
                .sheet(isPresented: $editing) { GSessionEditor(session: session) }
                .sheet(isPresented: $voting) { GVotingView(sessionID: sessionID) }
                .sheet(isPresented: $reminders) { GReminderView(sessionID: sessionID) }
                .sheet(item: $sharedFile) { GActivitySheet(url: $0.url) }
                .confirmationDialog("Choose this plan?", isPresented: Binding(get: { chosenTarget != nil }, set: { if !$0 { chosenTarget = nil } }), titleVisibility: .visible) {
                    if let candidate = chosenTarget {
                        Button("Choose \(candidate.title)") {
                            do { try store.choose(sessionID: sessionID, candidateID: candidate.id) } catch { store.failure = error.localizedDescription }
                            chosenTarget = nil
                        }
                    }
                } message: {
                    Text("\(session.completeBallots.count) of \(session.participants.count) people have responded. Check objections before confirming. This saves a plan; it does not make a reservation or notify friends.")
                }
                .confirmationDialog("Delete this decision?", isPresented: $confirmDelete, titleVisibility: .visible) {
                    Button("Delete decision", role: .destructive) {
                        do { try store.delete(sessionID); dismiss() } catch { store.failure = error.localizedDescription }
                    }
                } message: { Text("The decision, responses, and its reminder will be removed from this device.") }
                .confirmationDialog("Reopen this decision?", isPresented: $confirmReopen, titleVisibility: .visible) {
                    Button("Reopen & remove reminder") {
                        do { try store.choose(sessionID: sessionID, candidateID: nil) } catch { store.failure = error.localizedDescription }
                    }
                } message: { Text("Existing votes are kept. The chosen plan and reminder are removed so you can collect more votes.") }
            } else { ContentUnavailableView("Decision removed", systemImage: "rectangle.stack", description: Text("Return to your library to start another decision.")) }
        }
    }
    private func responseSummary(_ session: GSession) -> some View {
        GCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack { Text("The group").font(.headline); Spacer(); Text("\(session.completeBallots.count)/\(session.participants.count)").font(.subheadline.monospacedDigit()).foregroundStyle(GTheme.sage) }
                ProgressView(value: Double(session.completeBallots.count), total: Double(session.participants.count))
                ForEach(session.participants) { person in
                    HStack {
                        Text(person.name).font(.subheadline)
                        Spacer()
                        Label(session.ballot(for: person.id) == nil ? "Waiting" : "Responded", systemImage: session.ballot(for: person.id) == nil ? "circle.dashed" : "checkmark.circle.fill")
                            .font(.caption).foregroundStyle(session.ballot(for: person.id) == nil ? GTheme.muted : GTheme.sage)
                    }
                }
                Text("Pass your phone around for local voting, or exchange files. Names are self-selected; files are intended for people you trust.").font(.caption).foregroundStyle(GTheme.muted)
            }
        }
    }
    @ViewBuilder private func results(_ session: GSession) -> some View {
        if !session.completeBallots.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text(session.pendingNames.isEmpty ? "WHERE YOU LANDED" : "EARLY RESULTS").font(.caption.bold()).tracking(1.5).foregroundStyle(GTheme.muted)
                if !session.pendingNames.isEmpty { Text("Still waiting for \(session.pendingNames.joined(separator: ", ")). These results may change.").font(.subheadline).foregroundStyle(GTheme.muted) }
                if !session.rankings.contains(where: \.everyoneAccepts) {
                    Label("No option is a yes for everyone who responded.", systemImage: "exclamationmark.bubble").font(.subheadline.weight(.medium))
                }
                ForEach(Array(session.rankings.prefix(3).enumerated()), id: \.element.id) { index, result in
                    GCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .top) {
                                Text(String(format: "%02d", index + 1)).font(.title3.monospacedDigit()).foregroundStyle(GTheme.sage)
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(result.candidate.title).font(.headline)
                                    Text("\(result.support) of \(result.responses) lean yes · \(result.strongYes) strong yes").font(.caption).foregroundStyle(GTheme.muted)
                                }
                            }
                            if result.objections.isEmpty {
                                Label("No strong objections among responses", systemImage: "checkmark.circle").font(.caption).foregroundStyle(GTheme.sage)
                            } else {
                                Label("Strong no: \(result.objections.joined(separator: ", "))", systemImage: "hand.raised").font(.caption.weight(.medium)).foregroundStyle(.brown)
                            }
                            if session.chosenCandidateID == nil {
                                Button("Choose this plan") { chosenTarget = result.candidate }.buttonStyle(GSecondaryButton()).accessibilityIdentifier("result.choose.\(index)")
                            }
                        }
                    }
                }
                Text("Ranked by fewer strong objections, then more yes votes, then preference intensity. Ties use alphabetical order. The organizer makes the final call.")
                    .font(.caption).foregroundStyle(GTheme.muted)
            }
        }
    }
    private func chosenPlan(_ session: GSession, chosen: GCandidate) -> some View {
        GCard {
            VStack(alignment: .leading, spacing: 14) {
                Label("You have a plan", systemImage: "checkmark.circle.fill").font(.subheadline.weight(.semibold)).foregroundStyle(GTheme.sage)
                Text(chosen.title).font(.title2.bold())
                Text("$\(chosen.price) per person · \(chosen.minutes) min away").font(.subheadline).foregroundStyle(GTheme.muted)
                if let url = URL(string: chosen.url), !chosen.url.isEmpty {
                    Link(destination: url) { Label("Open website to book", systemImage: "arrow.up.right") }.buttonStyle(GPrimaryButton())
                    Text("Booking happens on the venue’s website. Gather does not reserve or charge anything.").font(.caption).foregroundStyle(GTheme.muted)
                }
                ShareLink(item: "Our plan: \(chosen.title)\n\(session.title)\n\(session.context)\n\(chosen.url)") {
                    Label("Share the final plan", systemImage: "square.and.arrow.up")
                }.buttonStyle(GSecondaryButton())
                if let date = session.reminderDate {
                    Label("Reminder: \(date.formatted(date: .abbreviated, time: .shortened))", systemImage: "bell.fill").font(.caption)
                    Button("Remove reminder") { do { try store.cancelReminder(sessionID: sessionID) } catch { store.failure = error.localizedDescription } }.font(.subheadline)
                } else {
                    Button { reminders = true } label: { Label("Set a reminder", systemImage: "bell") }.buttonStyle(GSecondaryButton()).accessibilityIdentifier("reminder.add")
                }
            }
        }
    }
    private func shareInvitation(_ session: GSession) {
        do { sharedFile = GSharedFile(url: try store.shareURL(.invite(session), name: "\(session.title)-invitation")) }
        catch { store.failure = error.localizedDescription }
    }
    private func shareBallot(_ ballot: GBallot, session: GSession) {
        do { sharedFile = GSharedFile(url: try store.shareURL(.response(ballot), name: "\(session.title)-response")) }
        catch { store.failure = error.localizedDescription }
    }
}

struct GReminderView: View {
    @EnvironmentObject var store: GStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let sessionID: UUID
    @State private var date = Date().addingTimeInterval(3600)
    @State private var saving = false
    @State private var errorMessage: String?
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Remind me", selection: $date, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                } footer: { Text(store.mode == .demo ? "This creates a real notification on this device, labeled as a demo reminder." : "A local notification on this device. Friends do not receive this reminder.") }
                if let errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(.red)
                        Button("Open iPhone Settings") { if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) } }
                    }
                }
                Section {
                    Button(saving ? "Setting reminder…" : "Set reminder") {
                        saving = true
                        Task {
                            do { try await store.setReminder(sessionID: sessionID, date: date); dismiss() }
                            catch { errorMessage = error.localizedDescription }
                            saving = false
                        }
                    }.disabled(saving)
                }
            }.scrollContentBackground(.hidden).background(GTheme.background)
                .navigationTitle("Reminder").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(saving) } }
                .interactiveDismissDisabled(saving)
        }
    }
}

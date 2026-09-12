import SwiftUI

struct GVotingView: View {
    @EnvironmentObject var store: GStore
    @Environment(\.dismiss) private var dismiss
    let sessionID: UUID
    @State private var participant: GParticipant?
    @State private var ratings: [UUID: Int] = [:]
    @State private var history: [UUID] = []
    @State private var finished = false
    @State private var drag = CGSize.zero
    @State private var errorMessage: String?
    @State private var sharedFile: GSharedFile?
    @State private var confirmDiscard = false
    var body: some View {
        NavigationStack {
            Group {
                if let session = store.session(sessionID) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            if store.mode == .demo { GDemoBanner() }
                            if finished { completed(session) }
                            else if let participant { votingBody(session, participant: participant) }
                            else { participantPicker(session) }
                        }.padding(20)
                    }.background(GTheme.background)
                } else { ContentUnavailableView("Decision unavailable", systemImage: "rectangle.stack") }
            }
            .navigationTitle(finished ? "Response saved" : "Your preferences").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(finished ? "Done" : "Close") {
                        if !finished && !ratings.isEmpty { confirmDiscard = true } else { dismiss() }
                    }.accessibilityIdentifier("vote.close")
                }
            }
            .interactiveDismissDisabled(!ratings.isEmpty && !finished)
            .sheet(item: $sharedFile) { GActivitySheet(url: $0.url) }
            .alert("Could not save response", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
            .confirmationDialog("Discard unfinished votes?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Discard & close", role: .destructive) { dismiss() }
            } message: { Text("Responses are saved only after every option is rated. Any previous completed response is kept.") }
        }
    }
    private func participantPicker(_ session: GSession) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Who’s swiping?").font(.largeTitle.bold())
            Text("Choose your own name. On one phone, take turns and pass it on when you finish.").font(.subheadline).foregroundStyle(GTheme.muted)
            ForEach(Array(session.participants.enumerated()), id: \.element.id) { index, person in
                Button { participant = person } label: {
                    GCard {
                        HStack {
                            Image(systemName: "person.crop.circle").font(.title2).foregroundStyle(GTheme.sage)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(person.name).font(.headline)
                                Text(session.ballot(for: person.id) == nil ? "Ready to vote" : "Vote again · replaces your previous response").font(.caption).foregroundStyle(GTheme.muted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption)
                        }
                    }
                }.buttonStyle(.plain).accessibilityIdentifier("vote.person.\(index)")
            }
            Text("Votes are hidden during this session. Gather trusts the name you choose; it does not verify identity.").font(.footnote).foregroundStyle(GTheme.muted)
        }
    }
    private func votingBody(_ session: GSession, participant: GParticipant) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text(participant.name).font(.title2.bold())
                Spacer()
                Text("\(min(history.count + 1, session.candidates.count)) of \(session.candidates.count)").font(.subheadline.monospacedDigit()).foregroundStyle(GTheme.muted)
            }
            ProgressView(value: Double(history.count), total: Double(session.candidates.count)).accessibilityLabel("Voting progress")
            if !session.context.isEmpty { Text(session.context).font(.caption).foregroundStyle(GTheme.muted) }
            if history.count < session.candidates.count {
                let candidate = session.candidates[history.count]
                Text("↑ STRONG YES").font(.caption.bold()).foregroundStyle(GTheme.sage).frame(maxWidth: .infinity)
                GCard {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack { Image(systemName: "mappin.and.ellipse").font(.system(size: 30, weight: .light)); Spacer(); GTag(title: "Option \(history.count + 1)") }.foregroundStyle(GTheme.sage)
                        Text(candidate.title).font(.system(size: 30, weight: .bold, design: .rounded)).fixedSize(horizontal: false, vertical: true)
                        if !candidate.detail.isEmpty { Text(candidate.detail).font(.body).foregroundStyle(GTheme.muted) }
                        Divider()
                        HStack { Label("$\(candidate.price)/person", systemImage: "dollarsign.circle"); Spacer(); Label("\(candidate.minutes) min", systemImage: "figure.walk") }.font(.subheadline)
                        HStack { Text("← Weak no"); Spacer(); Text("Weak yes →") }.font(.caption.weight(.medium)).foregroundStyle(GTheme.muted)
                    }.padding(.vertical, 14)
                }
                .offset(x: drag.width * 0.35, y: drag.height * 0.25)
                .rotationEffect(.degrees(Double(drag.width) / 30))
                .highPriorityGesture(DragGesture(minimumDistance: 10).onChanged { drag = $0.translation }.onEnded { value in
                    let x = value.translation.width, y = value.translation.height
                    withAnimation(.easeOut(duration: 0.16)) { drag = .zero }
                    guard max(abs(x), abs(y)) >= 65 else { return }
                    if abs(y) > abs(x) { record(y < 0 ? .strongYes : .strongNo, session: session, candidate: candidate) }
                    else { record(x > 0 ? .weakYes : .weakNo, session: session, candidate: candidate) }
                })
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("vote.card")
                .accessibilityLabel("\(candidate.title). \(candidate.detail). \(candidate.price) dollars per person. \(candidate.minutes) minutes away. Use the preference buttons below.")
                Text("↓ STRONG NO").font(.caption.bold()).foregroundStyle(GTheme.muted).frame(maxWidth: .infinity)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    voteButton(.strongYes, session: session, candidate: candidate, identifier: "vote.strongYes")
                    voteButton(.weakYes, session: session, candidate: candidate, identifier: "vote.weakYes")
                    voteButton(.weakNo, session: session, candidate: candidate, identifier: "vote.weakNo")
                    voteButton(.strongNo, session: session, candidate: candidate, identifier: "vote.strongNo")
                }
                HStack {
                    Button { undo() } label: { Label("Undo", systemImage: "arrow.uturn.backward") }.disabled(history.isEmpty).accessibilityIdentifier("vote.undo")
                    Spacer()
                    Text("Swipe the card or tap a choice").font(.caption).foregroundStyle(GTheme.muted)
                }.padding(.top, 4)
            } else {
                Text("All options rated").font(.title2.bold())
                Button("Save response") { finish(session) }.buttonStyle(GPrimaryButton())
                Button("Undo last choice") { undo() }.buttonStyle(GSecondaryButton())
            }
        }
    }
    private func voteButton(_ preference: GPreference, session: GSession, candidate: GCandidate, identifier: String) -> some View {
        Button { record(preference, session: session, candidate: candidate) } label: {
            Label(preference.title, systemImage: preference.symbol).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, 15)
                .foregroundStyle(preference.rawValue > 0 ? GTheme.sage : GTheme.ink)
                .background(preference.rawValue > 0 ? GTheme.sage.opacity(0.1) : Color.white, in: RoundedRectangle(cornerRadius: 13))
                .overlay(RoundedRectangle(cornerRadius: 13).stroke(GTheme.line, lineWidth: 1))
        }.buttonStyle(.plain).accessibilityIdentifier(identifier)
    }
    private func completed(_ session: GSession) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 52)).foregroundStyle(GTheme.sage)
            Text("Your say is saved.").font(.largeTitle.bold()).accessibilityIdentifier("vote.complete")
            Text(session.isOrganizer ? "\(participant?.name ?? "Your") response is in. Pass the phone to the next person, or return to see where the group agrees." : "One more step: send your response file back to the organizer so it counts toward the group’s decision.").font(.title3).foregroundStyle(GTheme.muted)
            if !session.isOrganizer {
                Button {
                    guard let participant, let ballot = session.ballot(for: participant.id) else { return }
                    do { sharedFile = GSharedFile(url: try store.shareURL(.response(ballot), name: "\(session.title)-\(participant.name)-response")) }
                    catch { errorMessage = error.localizedDescription }
                } label: { Label("Send my response file", systemImage: "square.and.arrow.up") }.buttonStyle(GPrimaryButton()).accessibilityIdentifier("ballot.share")
            }
            Button(session.isOrganizer ? "Back to the decision" : "Done") { dismiss() }.buttonStyle(GSecondaryButton())
            if session.isOrganizer {
                Button("Let someone else vote") { participant = nil; ratings = [:]; history = []; finished = false }.buttonStyle(GSecondaryButton())
            }
        }.padding(.vertical, 25)
    }
    private func record(_ preference: GPreference, session: GSession, candidate: GCandidate) {
        guard !finished, ratings[candidate.id] == nil else { return }
        ratings[candidate.id] = preference.rawValue; history.append(candidate.id)
        if history.count == session.candidates.count { finish(session) }
    }
    private func undo() { if let id = history.popLast() { ratings.removeValue(forKey: id) } }
    private func finish(_ session: GSession) {
        guard let participant else { return }
        do { try store.submit(sessionID: session.id, participantID: participant.id, ratings: ratings); finished = true }
        catch { errorMessage = error.localizedDescription }
    }
}

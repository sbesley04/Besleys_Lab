import SwiftUI

struct GSessionEditor: View {
    @EnvironmentObject var store: GStore
    @Environment(\.dismiss) private var dismiss
    private let original: GSession?
    @State private var title: String
    @State private var context: String
    @State private var participants: [GParticipant]
    @State private var candidates: [GCandidate]
    @State private var errorMessage: String?
    @State private var confirmReset = false

    init(session: GSession? = nil) {
        original = session
        _title = State(initialValue: session?.title ?? "")
        _context = State(initialValue: session?.context ?? "")
        _participants = State(initialValue: session?.participants ?? [GParticipant(name: "You")])
        _candidates = State(initialValue: session?.candidates ?? (0..<3).map { _ in GCandidate(title: "") })
    }
    var body: some View {
        NavigationStack {
            Form {
                if store.mode == .demo { Section { GDemoBanner().listRowBackground(Color.clear) } }
                Section {
                    TextField("Friday dinner", text: $title).accessibilityIdentifier("session.title")
                    TextField("Time, budget, dietary needs…", text: $context, axis: .vertical).lineLimit(2...5)
                } header: { Text("The decision") } footer: { Text("Put hard constraints in the notes and only add options that meet them. Votes express preference, not dietary safety.") }
                Section {
                    ForEach($participants) { $person in
                        HStack {
                            TextField("Name", text: $person.name).textContentType(.nickname)
                            if participants.count > 1 {
                                Button(role: .destructive) { participants.removeAll { $0.id == person.id } } label: { Image(systemName: "minus.circle") }
                                    .buttonStyle(.borderless).accessibilityLabel("Remove \(person.name.isEmpty ? "person" : person.name)")
                            }
                        }
                    }
                    if participants.count < 20 {
                        Button { participants.append(GParticipant(name: "")) } label: { Label("Add a person", systemImage: "plus") }.accessibilityIdentifier("participant.add")
                    }
                } header: { Text("People · \(participants.count) of 20") } footer: { Text("Use names everyone recognizes. No accounts are needed; people choose their name when voting.") }
                ForEach($candidates) { $candidate in
                    Section {
                        TextField("Place or activity name", text: $candidate.title).accessibilityIdentifier("candidate.title.\(candidates.firstIndex(where: { $0.id == candidate.id }) ?? 0)")
                        TextField("What should people know?", text: $candidate.detail, axis: .vertical).lineLimit(1...3)
                        HStack {
                            Text("Price per person ($)")
                            Spacer()
                            TextField("20", value: $candidate.price, format: .number).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(minWidth: 55)
                        }
                        HStack {
                            Text("Travel time (minutes)")
                            Spacer()
                            TextField("15", value: $candidate.minutes, format: .number).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(minWidth: 55)
                        }
                        TextField("Website link (optional)", text: $candidate.url).textContentType(.URL).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        if candidates.count > 3 {
                            Button("Remove option", role: .destructive) { candidates.removeAll { $0.id == candidate.id } }
                        }
                    } header: { Text("Option \((candidates.firstIndex { $0.id == candidate.id } ?? 0) + 1)") }
                }
                Section {
                    if candidates.count < 12 {
                        Button { candidates.append(GCandidate(title: "")) } label: { Label("Add another option", systemImage: "plus") }.accessibilityIdentifier("candidate.add")
                    }
                    Text("\(candidates.count) of 12 options. A short list makes it easier to finish.").font(.footnote).foregroundStyle(GTheme.muted)
                }
            }
            .scrollContentBackground(.hidden).background(GTheme.background)
            .navigationTitle(original == nil ? "New decision" : "Edit decision").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { attemptSave() }.bold().accessibilityIdentifier("session.save") }
            }
            .alert("Check this decision", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
            .confirmationDialog("Start a fresh vote?", isPresented: $confirmReset, titleVisibility: .visible) {
                Button("Save changes & clear votes", role: .destructive) { save(reset: true) }
            } message: { Text("Editing the decision clears existing votes, the chosen plan, and its reminder. Share a new invitation so everyone votes on the same options.") }
        }
    }
    private func builtSession() -> GSession {
        var session = original ?? GSession(title: "", participants: [], candidates: [])
        session.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        session.context = context.trimmingCharacters(in: .whitespacesAndNewlines)
        session.participants = participants.map { var p = $0; p.name = p.name.trimmingCharacters(in: .whitespacesAndNewlines); return p }
        session.candidates = candidates.map { var c = $0; c.title = c.title.trimmingCharacters(in: .whitespacesAndNewlines); c.url = c.url.trimmingCharacters(in: .whitespacesAndNewlines); return c }
        return session
    }
    private func attemptSave() {
        do {
            let session = builtSession()
            try GValidation.session(session)
            if let original {
                if session == original { dismiss(); return }
                guard let current = store.session(original.id), current.revision == original.revision else {
                    throw GError.invalid("This decision changed or was deleted while the editor was open. Close the editor and reopen the current decision.")
                }
                if !current.ballots.isEmpty || current.chosenCandidateID != nil || current.reminderDate != nil { confirmReset = true }
                else { save(reset: true) }
            } else { save(reset: false) }
        } catch { errorMessage = error.localizedDescription }
    }
    private func save(reset: Bool) {
        do { try store.update(builtSession(), resetVotes: reset); dismiss() }
        catch { errorMessage = error.localizedDescription }
    }
}

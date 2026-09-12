import SwiftUI
import UniformTypeIdentifiers

struct GHomeView: View {
    @EnvironmentObject var store: GStore
    @State private var showingCreate = false
    @State private var showingSettings = false
    @State private var showingImport = false
    @State private var deleteTarget: GSession?
    @State private var path: [UUID] = []
    private var openSessions: [GSession] { store.sessions.filter { $0.chosenCandidateID == nil } }
    private var decidedSessions: [GSession] { store.sessions.filter { $0.chosenCandidateID != nil } }
    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    if store.mode == .demo { GDemoBanner() }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Make room\nfor a plan.").font(.system(size: 36, weight: .bold, design: .rounded))
                        Text("A few options. Everyone’s preference. One decision.").font(.subheadline).foregroundStyle(GTheme.muted)
                    }
                    Button { showingCreate = true } label: { Label("Start a decision", systemImage: "plus") }
                        .buttonStyle(GPrimaryButton()).accessibilityIdentifier("session.create")
                    if store.sessions.isEmpty {
                        GEmpty(symbol: "rectangle.stack", title: "Your next plan starts here", detail: "Add 3–12 places or activities. Friends can vote on your phone or exchange invitation and response files.")
                        Button { showingImport = true } label: { Label("Open a Gather invitation", systemImage: "square.and.arrow.down") }.buttonStyle(GSecondaryButton())
                    }
                    if !openSessions.isEmpty { sessionSection("IN THE WORKS", sessions: openSessions) }
                    if !decidedSessions.isEmpty { sessionSection("DECIDED", sessions: decidedSessions) }
                    if !store.sessions.isEmpty {
                        Text("Stored on this device · share only what you choose")
                            .font(.caption).foregroundStyle(GTheme.muted).frame(maxWidth: .infinity).padding(.top, 10)
                    }
                }.padding(20)
            }
            .background(GTheme.background)
            .navigationTitle("Gather").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showingImport = true } label: { Image(systemName: "square.and.arrow.down") }
                        .accessibilityLabel("Import Gather file").accessibilityIdentifier("session.import")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingSettings = true } label: { Image(systemName: "slider.horizontal.3") }
                        .accessibilityLabel("Settings").accessibilityIdentifier("settings.open")
                }
            }
            .navigationDestination(for: UUID.self) { id in GSessionDetail(sessionID: id) }
            .sheet(isPresented: $showingCreate) { GSessionEditor() }
            .sheet(isPresented: $showingSettings) { GSettingsView() }
            .fileImporter(isPresented: $showingImport, allowedContentTypes: [.gatherDecision, .json, .data]) { result in
                switch result { case .success(let url): store.importURL(url); case .failure(let error): store.failure = error.localizedDescription }
            }
            .alert("File imported", isPresented: Binding(get: { store.message != nil }, set: { if !$0 { store.message = nil } })) {
                Button("OK") { store.message = nil }
            } message: { Text(store.message ?? "") }
            .confirmationDialog("Delete this decision?", isPresented: Binding(get: { deleteTarget != nil }, set: { if !$0 { deleteTarget = nil } }), titleVisibility: .visible) {
                Button("Delete decision", role: .destructive) {
                    if let target = deleteTarget { do { try store.delete(target.id) } catch { store.failure = error.localizedDescription } }
                    deleteTarget = nil
                }
            } message: { Text("This removes the decision, votes, and any reminder from this device.") }
            .onChange(of: store.mode) { _, _ in path = [] }
        }
    }
    private func sessionSection(_ title: String, sessions: [GSession]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.caption.weight(.bold)).tracking(1.5).foregroundStyle(GTheme.muted)
            ForEach(sessions) { session in
                NavigationLink(value: session.id) {
                    GCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .top) {
                                Text(session.title).font(.title3.weight(.semibold)).foregroundStyle(GTheme.ink)
                                Spacer()
                                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(GTheme.muted).padding(.top, 5)
                            }
                            if let chosen = session.chosenCandidate {
                                Label(chosen.title, systemImage: "checkmark.circle.fill").font(.subheadline).foregroundStyle(GTheme.sage)
                            } else {
                                Text("\(session.candidates.count) options · \(session.completeBallots.count) of \(session.participants.count) responded")
                                    .font(.subheadline).foregroundStyle(GTheme.muted)
                                ProgressView(value: Double(session.completeBallots.count), total: Double(session.participants.count)).tint(GTheme.sage)
                            }
                            HStack {
                                GTag(title: session.isOrganizer ? "You organize" : "Invited", symbol: session.isOrganizer ? "person.crop.circle" : "envelope")
                                if session.chosenCandidateID != nil { GTag(title: "Plan chosen", symbol: "checkmark") }
                            }
                        }
                    }
                }.buttonStyle(.plain)
                .contextMenu { Button("Delete decision", role: .destructive) { deleteTarget = session } }
            }
        }
    }
}

import SwiftUI
import UniformTypeIdentifiers

struct GSettingsView: View {
    @EnvironmentObject var store: GStore
    @Environment(\.dismiss) private var dismiss
    @State private var exporting = false
    @State private var importing = false
    @State private var exportDocument: GFileDocument?
    @State private var pendingRestoreData: Data?
    @State private var restoreCount = 0
    @State private var restoreMode: GMode?
    @State private var confirmRestore = false
    @State private var confirmDelete = false
    @State private var confirmReset = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Your decisions.\nYour device.").font(.title.bold())
                        Text("Gather works without accounts or a server. Only files and plans you choose to share leave the app.").font(.subheadline).foregroundStyle(GTheme.muted)
                    }.padding(.vertical, 10)
                }
                Section {
                    HStack {
                        Label(store.mode == .demo ? "Demo library" : "Personal library", systemImage: store.mode == .demo ? "sparkles" : "person.crop.circle")
                        Spacer()
                        Text("\(store.sessions.count) decisions").font(.caption).foregroundStyle(GTheme.muted)
                    }
                    Button(store.mode == .demo ? "Switch to my personal library" : "Explore the demo") {
                        store.switchMode(store.mode == .demo ? .personal : .demo)
                    }.accessibilityIdentifier("settings.switchMode")
                    if store.mode == .demo {
                        Button("Reset sample decisions") { confirmReset = true }.accessibilityIdentifier("demo.reset")
                    }
                } header: { Text("Current library") } footer: {
                    Text("Demo and personal decisions are saved separately. Switching never copies or deletes your personal data. Demo friends, places, and votes are fictional.")
                }
                Section {
                    Button {
                        do { exportDocument = GFileDocument(data: try store.exportLibrary()); exporting = true }
                        catch { errorMessage = error.localizedDescription }
                    } label: { Label("Export library backup", systemImage: "square.and.arrow.up") }.accessibilityIdentifier("library.export")
                    Button { importing = true } label: { Label("Restore from a backup", systemImage: "square.and.arrow.down") }.accessibilityIdentifier("library.restore")
                    Button(role: .destructive) { confirmDelete = true } label: { Label("Delete this library", systemImage: "trash") }.accessibilityIdentifier("library.delete")
                } header: { Text("Your data") } footer: {
                    Text("Backups contain this library’s decisions, names, notes, and votes. Keep them private. Restoring adds new decisions and keeps existing ones; reminders must be set again. Deleting this library cannot remove files you already shared or exported.")
                }
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("How sharing works").font(.headline)
                        Text("1. The organizer sends an invitation file.\n2. Each friend opens it in Gather and chooses their name.\n3. Friends swipe, then send their response file back.\n4. The organizer imports each response and chooses a plan.").font(.subheadline)
                    }.padding(.vertical, 4)
                    Text("Invitations include only the decision, options, and participant names. They never include organizer votes. Response files include one person’s votes and are intended for the organizer.").font(.footnote).foregroundStyle(GTheme.muted)
                    Text("There is no automatic sync or identity verification. Keep files within your group. An edited decision needs a new invitation and fresh votes.").font(.footnote).foregroundStyle(GTheme.muted)
                }
                Section {
                    Label("No analytics or tracking", systemImage: "hand.raised")
                    Label("No location or payment access", systemImage: "location.slash")
                    Label("Notifications only when you ask", systemImage: "bell")
                    Text("Prices and travel times are entered by the organizer. Gather does not check venue availability or make reservations. Website links open only when you tap them.").font(.footnote).foregroundStyle(GTheme.muted)
                } header: { Text("Privacy & boundaries") }
                Section { Text("Gather · Version 1.0").font(.caption).foregroundStyle(GTheme.muted) }
            }
            .scrollContentBackground(.hidden).background(GTheme.background)
            .navigationTitle("Settings").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.accessibilityIdentifier("settings.done") } }
            .fileExporter(isPresented: $exporting, document: exportDocument, contentType: .json,
                          defaultFilename: "Gather-\(store.mode.rawValue)-backup") { result in
                switch result {
                case .success: successMessage = "Your library backup was saved."
                case .failure(let error): errorMessage = error.localizedDescription
                }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                switch result {
                case .success(let url): prepareRestore(url)
                case .failure(let error): errorMessage = error.localizedDescription
                }
            }
            .confirmationDialog("Restore into the \(store.mode == .demo ? "demo" : "personal") library?", isPresented: $confirmRestore, titleVisibility: .visible) {
                Button("Add \(restoreCount) new decisions") {
                    guard let data = pendingRestoreData, restoreMode == store.mode else { errorMessage = "The active library changed. Open the backup again."; return }
                    do {
                        let count = try store.restoreLibrary(data)
                        successMessage = "Restored \(count) decisions. Existing decisions were kept. Set any reminders again on this device."
                    } catch { errorMessage = error.localizedDescription }
                    pendingRestoreData = nil
                }
                Button("Cancel", role: .cancel) { pendingRestoreData = nil }
            } message: { Text("Existing decisions with the same ID are kept. No saved votes will be replaced. Restored reminders are not automatically scheduled.") }
            .confirmationDialog("Delete the \(store.mode == .demo ? "demo" : "personal") library?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete all \(store.mode == .demo ? "demo" : "personal") decisions", role: .destructive) {
                    do { try store.eraseCurrentLibrary() } catch { errorMessage = error.localizedDescription }
                }
            } message: { Text("This removes every decision and vote in this library and cancels its reminders. Export a backup first if you want to keep a copy. Your other library stays separate.") }
            .confirmationDialog("Reset the demo?", isPresented: $confirmReset, titleVisibility: .visible) {
                Button("Reset demo decisions", role: .destructive) {
                    do { try store.resetDemo() } catch { errorMessage = error.localizedDescription }
                }
            } message: { Text("Demo edits and reminders will be removed and the original sample decisions restored. Personal decisions stay in your personal library.") }
            .alert("Something needs attention", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
            .alert("Library updated", isPresented: Binding(get: { successMessage != nil }, set: { if !$0 { successMessage = nil } })) {
                Button("OK") { successMessage = nil }
            } message: { Text(successMessage ?? "") }
        }
    }
    private func prepareRestore(_ url: URL) {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try GStore.readBoundedFile(url, limit: 25_000_000)
            let archive = try GStore.validatedArchive(data)
            let ids = Set(store.sessions.map(\.id))
            restoreCount = archive.sessions.filter { !ids.contains($0.id) }.count
            pendingRestoreData = data; restoreMode = store.mode; confirmRestore = true
        } catch { errorMessage = "Could not read this backup. \(error.localizedDescription)" }
    }
}

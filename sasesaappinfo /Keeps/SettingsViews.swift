import SwiftUI
import UniformTypeIdentifiers

struct KeepsBackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.keepsBackup, .json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws {
        guard let content = configuration.file.regularFileContents else { throw KeepsError.message("Could not read this backup.") }
        _ = try KeepsBackup.decode(content)
        data = content
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
struct PendingKeepsImport: Identifiable {
    var id = UUID()
    let data: Data
    let count: Int
}

struct KeepsSettingsView: View {
    @EnvironmentObject private var store: KeepsStore
    @State private var exportDocument: KeepsBackupDocument?
    @State private var showingExporter = false
    @State private var showingImporter = false
    @State private var pendingImport: PendingKeepsImport?
    @State private var showingDelete = false
    @State private var showingReset = false
    @State private var statusMessage: String?
    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack { Image(systemName: store.isDemo ? "sparkle" : "lock.shield").font(.title2).foregroundStyle(KeepsStyle.sage); Text(store.isDemo ? "Your demo library" : "Your personal library").font(.title2.bold()) }
                        Text(store.isDemo ? "Explore with fictional saves. Your own ideas live in a separate library and stay there when you switch." : "No account, no feed, no cloud service. Save ideas that matter to you.").font(.subheadline).foregroundStyle(.secondary)
                        HStack(spacing: 25) { stat(value: "\(store.items.count)", label: "ideas kept"); stat(value: "\(store.items.filter(\.favorite).count)", label: "favorites"); stat(value: "\(store.decisions.count)", label: "decisions") }
                    }.padding(.vertical, 8)
                }
                Section("Library mode") {
                    Button { store.switchMode(store.isDemo ? .personal : .demo) } label: { Label(store.isDemo ? "Switch to my personal library" : "Try the demo library", systemImage: "arrow.left.arrow.right") }.accessibilityIdentifier("keeps.settings.mode")
                    if store.isDemo { Button("Reset demo ideas") { showingReset = true }.accessibilityIdentifier("keeps.settings.resetDemo") }
                }
                Section {
                    NavigationLink { DecisionHistoryView() } label: { Label("Decision history", systemImage: "clock.arrow.circlepath") }.accessibilityIdentifier("keeps.settings.history")
                }
                Section {
                    Button {
                        do { exportDocument = KeepsBackupDocument(data: try store.backupData()); showingExporter = true }
                        catch { store.error = error.localizedDescription }
                    } label: { Label("Export library backup", systemImage: "square.and.arrow.up") }.accessibilityIdentifier("keeps.settings.export")
                    Button { showingImporter = true } label: { Label("Import a Keeps backup", systemImage: "square.and.arrow.down") }.accessibilityIdentifier("keeps.settings.import")
                    if !store.recoveryFiles.isEmpty {
                        Button {
                            do { exportDocument = KeepsBackupDocument(data: try store.recoveryBackupData()); showingExporter = true }
                            catch { store.error = "Couldn't export the recovery copy: \(error.localizedDescription)" }
                        } label: { Label("Export preserved recovery copy", systemImage: "externaldrive.badge.exclamationmark") }
                        Text("A previously unreadable file was preserved before your library changed. This exports the original bytes for recovery; it may need repair before it can be imported. Deleting this library also removes its recovery copies.").font(.caption).foregroundStyle(.secondary)
                    }
                } header: { Text("Your data") } footer: { Text("Backups include notes, source links, photos, and decision history. Store exported files somewhere you trust. Imports add new ideas and preserve existing ones. Limit: 30 MB per library, 2,000 ideas.") }
                Section {
                    NavigationLink { PrivacyView() } label: { Label("Privacy & how Keeps works", systemImage: "hand.raised") }
                    NavigationLink { KeepsHelpView() } label: { Label("A quick guide", systemImage: "questionmark.circle") }
                    Button("Delete this library's data", role: .destructive) { showingDelete = true }.accessibilityIdentifier("keeps.settings.deleteData")
                }
                Section { Text("Keeps · 1.0\nA small place for your next good idea.").font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity).multilineTextAlignment(.center).listRowBackground(Color.clear) }
            }
            .scrollContentBackground(.hidden).background(KeepsStyle.background)
            .navigationTitle("Your space")
            .fileExporter(isPresented: $showingExporter, document: exportDocument, contentType: .keepsBackup, defaultFilename: "Keeps-\(store.mode.rawValue)-\(Date().formatted(.iso8601.year().month().day().dateSeparator(.dash)))") { result in
                switch result {
                case .success: statusMessage = "Your \(store.isDemo ? "demo" : "personal") library backup was exported."
                case .failure(let error): store.error = "Couldn't export the backup: \(error.localizedDescription)"
                }
            }
            .fileImporter(isPresented: $showingImporter, allowedContentTypes: [.keepsBackup, .json, .data], allowsMultipleSelection: false) { result in
                do {
                    guard let url = try result.get().first else { return }
                    let access = url.startAccessingSecurityScopedResource()
                    defer { if access { url.stopAccessingSecurityScopedResource() } }
                    let data = try KeepsBackup.readFile(url)
                    let backup = try KeepsBackup.decode(data)
                    pendingImport = PendingKeepsImport(data: data, count: backup.items.count)
                } catch { store.error = "Couldn't import the backup: \(error.localizedDescription)" }
            }
            .sheet(item: $pendingImport) { pending in BackupImportView(pending: pending) }
            .confirmationDialog("Reset the demo library?", isPresented: $showingReset, titleVisibility: .visible) { Button("Reset demo", role: .destructive) { store.resetDemo() }; Button("Cancel", role: .cancel) {} } message: { Text("Changes and reminders in demo mode will be removed and sample ideas restored. Your personal library is unaffected.") }
            .confirmationDialog("Delete all \(store.isDemo ? "demo" : "personal") data?", isPresented: $showingDelete, titleVisibility: .visible) { Button("Delete library data", role: .destructive) { store.clearLibrary() }; Button("Cancel", role: .cancel) {} } message: { Text("This permanently removes every idea, photo, and decision in this library and cancels its reminders. Exported files and the other library are unaffected.") }
            .alert("Backup exported", isPresented: Binding(get: { statusMessage != nil }, set: { if !$0 { statusMessage = nil } })) { Button("OK", role: .cancel) { statusMessage = nil } } message: { Text(statusMessage ?? "") }
        }
    }
    private func stat(value: String, label: String) -> some View { VStack(alignment: .leading, spacing: 3) { Text(value).font(.title2.bold()).foregroundStyle(KeepsStyle.sage); Text(label).font(.caption).foregroundStyle(.secondary) } }
}

struct BackupImportView: View {
    @EnvironmentObject private var store: KeepsStore
    @Environment(\.dismiss) private var dismiss
    let pending: PendingKeepsImport
    @State private var addedCount: Int?
    @State private var importError: String?
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                Image(systemName: addedCount == nil ? "square.and.arrow.down" : "checkmark.circle").font(.system(size: 42, weight: .light)).foregroundStyle(KeepsStyle.sage)
                Text(addedCount.map { "\($0) ideas added." } ?? "Bring back your ideas.").font(.largeTitle.bold())
                if addedCount == nil {
                    Text("This backup contains \(pending.count) ideas. Import into your \(store.isDemo ? "demo" : "personal") library?").font(.title3)
                    Text("New ideas and decision history will be added. Ideas already in this library keep their current details. Imported reminders are not scheduled.").foregroundStyle(.secondary)
                    Button {
                        do { addedCount = try store.importBackup(pending.data) }
                        catch { importError = error.localizedDescription }
                    } label: { Text("Import into \(store.isDemo ? "demo" : "personal") library").frame(maxWidth: .infinity) }.buttonStyle(KeepsPrimaryButton()).accessibilityIdentifier("keeps.import.confirm")
                } else {
                    Text("Your library is ready. Any existing ideas were preserved, and imported reminders were left off.").foregroundStyle(.secondary)
                    Button("Done") { dismiss() }.buttonStyle(KeepsPrimaryButton())
                }
                Spacer()
            }.padding(24).frame(maxWidth: .infinity, alignment: .leading).background(KeepsStyle.background)
            .navigationTitle("Import backup").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(addedCount == nil ? "Cancel" : "Close") { dismiss() } } }
            .alert("Import failed", isPresented: Binding(get: { importError != nil }, set: { if !$0 { importError = nil } })) { Button("OK", role: .cancel) {} } message: { Text(importError ?? "") }
        }
    }
}

struct DecisionHistoryView: View {
    @EnvironmentObject private var store: KeepsStore
    var body: some View {
        List {
            if store.decisions.isEmpty {
                ContentUnavailableView("Your first choice is ahead", systemImage: "clock", description: Text("Choose an idea after a swipe session and it will appear here."))
            } else {
                ForEach(store.decisions) { decision in
                    Group {
                        if store.items.contains(where: { $0.id == decision.selectedIdeaID }) {
                            NavigationLink { IdeaDetailView(ideaID: decision.selectedIdeaID) } label: { record(decision) }
                        } else { record(decision) }
                    }
                }
            }
        }.scrollContentBackground(.hidden).background(KeepsStyle.background).navigationTitle("Decision history")
    }
    private func record(_ decision: DecisionRecord) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(decision.selectedTitle).font(.headline)
            Text("Chosen from \(decision.consideredCount) ideas · \(decision.createdAt.formatted(date: .abbreviated, time: .omitted))").font(.caption).foregroundStyle(.secondary)
            if !store.items.contains(where: { $0.id == decision.selectedIdeaID }) { Text("Original idea has been deleted").font(.caption).foregroundStyle(.secondary) }
        }.padding(.vertical, 7)
    }
}

struct PrivacyView: View {
    var body: some View {
        List {
            Section("Your library") { Text("Keeps saves your ideas and photos in the app's private storage on this device. There is no Keeps account, server, analytics service, or advertising SDK. Your device's own backup settings may include app data.") }
            Section("Permissions") { Text("The photo picker lets you choose individual images without granting access to your whole photo library. Keeps reads the clipboard only when you tap Paste. Notification permission is requested only when you set a reminder.") }
            Section("What is inferred") { Text("Link detection and hashtag extraction happen on this device. A link's hostname is a starting title, not a verified place name. Keeps does not scrape videos, read your other apps, track location, store payment details, or make purchases.") }
            Section("Search and swipes") { Text("Search matches the words in your saved titles, notes, tags, source text, and categories. Filters use your estimates. Swipe responses last only for the current decision. Selecting a favorite is an explicit, lasting library change; choosing an idea saves its title to your history.") }
            Section("Export and deletion") { Text("Exported backups contain readable JSON plus embedded photos. You choose where to store or share them. Deleting a library removes its app data and reminders, but cannot delete copies you exported. Demo and personal libraries are separate.") }
            Section("External links") { Text("Opening an original link takes you to its provider. That website or app handles its own privacy, availability, and any booking or purchase.") }
        }.scrollContentBackground(.hidden).background(KeepsStyle.background).navigationTitle("Privacy")
    }
}

struct KeepsHelpView: View {
    var body: some View {
        List {
            Section("1 · Save") { Text("Tap + in Library. Paste a link or some text, write an idea, or choose a photo. Review the title and add useful tags. Prices and walk times are optional estimates you enter yourself.") }
            Section("2 · Retrieve") { Text("Open Decide, search for what you have in mind, and add any limits. Unknown prices and walk times are excluded when the corresponding limit is on. Favorites appear first, then the newest ideas.") }
            Section("3 · Swipe") { Text("Up: strong yes. Right: weak yes. Left: weak no. Down: strong no. Matching buttons do the same thing. Undo revisits your last response. Up to eight ideas keep each session short.") }
            Section("4 · Choose") { Text("Keeps returns up to three yeses, with strong yeses first. Choose one to save the decision, open its original link, or set a reminder. Nothing is booked or purchased automatically.") }
            Section("Try without your own data") { Text("Switch to the demo in Your space. It has fictional dinner, activity, shopping, and trip ideas. You can edit, delete, import, and decide there. Reset demo ideas at any time; your personal library is separate.") }
        }.scrollContentBackground(.hidden).background(KeepsStyle.background).navigationTitle("A quick guide")
    }
}

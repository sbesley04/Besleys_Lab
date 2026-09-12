import SwiftUI
import UserNotifications

final class KeepsAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) { completionHandler([.banner, .sound]) }
}

@main
struct KeepsApp: App {
    @UIApplicationDelegateAdaptor(KeepsAppDelegate.self) var delegate
    @StateObject private var store = KeepsStore()
    var body: some Scene {
        WindowGroup {
            KeepsRootView()
                .environmentObject(store)
                .tint(KeepsStyle.sage)
                .preferredColorScheme(.light)
        }
    }
}

struct KeepsRootView: View {
    @EnvironmentObject private var store: KeepsStore
    @State private var selectedTab = 0
    @State private var incomingDraft: SavedIdea?
    @State private var pendingImport: PendingKeepsImport?
    var body: some View {
        Group {
            if store.isOnboarded {
                TabView(selection: $selectedTab) {
                    LibraryView().tabItem { Label("Library", systemImage: "bookmark") }.tag(0)
                    RetrieveView().tabItem { Label("Decide", systemImage: "square.stack").accessibilityIdentifier("keeps.retrieve") }.tag(1)
                    KeepsSettingsView().tabItem { Label("You", systemImage: "person.crop.circle").accessibilityIdentifier("keeps.settings") }.tag(2)
                }
                .id(store.mode)
            } else { KeepsWelcomeView() }
        }
        .sheet(item: $incomingDraft) { item in IdeaEditorView(item: item, isNew: true) }
        .alert("Keeps", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) { Button("OK", role: .cancel) { store.error = nil } } message: { Text(store.error ?? "") }
        .sheet(item: $pendingImport) { pending in BackupImportView(pending: pending) }
        .onOpenURL { url in
            if !store.isOnboarded { store.switchMode(.personal) }
            if url.isFileURL {
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                do {
                    let data = try KeepsBackup.readFile(url)
                    let backup = try KeepsBackup.decode(data)
                    pendingImport = PendingKeepsImport(data: data, count: backup.items.count)
                    selectedTab = 0
                } catch { store.error = error.localizedDescription }
            } else if url.scheme == "keeps", url.host == "capture", let components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
                let text = components.queryItems?.first(where: { $0.name == "text" })?.value ?? ""
                let source = components.queryItems?.first(where: { $0.name == "url" })?.value ?? ""
                incomingDraft = CaptureParser.draft(from: [text, source].filter { !$0.isEmpty }.joined(separator: "\n"))
            }
        }
    }
}

struct KeepsWelcomeView: View {
    @EnvironmentObject private var store: KeepsStore
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 25) {
                HStack { Image(systemName: "bookmark.fill").font(.title2); Text("keeps").font(.system(size: 28, weight: .bold, design: .rounded)) }.foregroundStyle(KeepsStyle.sage).padding(.top, 36)
                Text("You saved it.\nNow use it.").font(.system(size: 42, weight: .bold, design: .rounded)).fixedSize(horizontal: false, vertical: true)
                Text("A private place for your good ideas, and a small shortlist when you need a plan.").font(.title3).foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 22) {
                    FeatureLine(symbol: "square.and.arrow.down", title: "Keep the original", subtitle: "Save a link, a note, or a photo. Add only the details you know.")
                    FeatureLine(symbol: "square.stack", title: "Find your next yes", subtitle: "Filter your own saves, then swipe a few to choose.")
                    FeatureLine(symbol: "lock", title: "Your library, on this device", subtitle: "No account or cloud service. Export a backup you control.")
                }.padding(22).cardStyle()
                VStack(spacing: 12) {
                    Button { store.switchMode(.demo) } label: { Text("Try the demo").frame(maxWidth: .infinity) }.buttonStyle(KeepsPrimaryButton()).accessibilityIdentifier("keeps.demo")
                    Button { store.switchMode(.personal) } label: { Text("Start my own library").frame(maxWidth: .infinity) }.buttonStyle(KeepsSecondaryButton()).accessibilityIdentifier("keeps.fresh")
                    Text("Demo uses fictional ideas in a separate library.").font(.footnote).foregroundStyle(.secondary)
                }
            }.padding(24)
        }.background(KeepsStyle.background).foregroundStyle(KeepsStyle.ink)
    }
}

import SwiftUI
import UserNotifications

final class OrbitAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) { completionHandler([.banner, .sound]) }
}

@main
struct OrbitApp: App {
    @UIApplicationDelegateAdaptor(OrbitAppDelegate.self) var delegate
    @StateObject private var store = OrbitStore.shared
    var body: some Scene {
        WindowGroup { OrbitRootView().environmentObject(store).tint(OStyle.sage).preferredColorScheme(.light) }
    }
}

struct OrbitRootView: View {
    @EnvironmentObject private var store: OrbitStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var deferredInvite: String?
    var body: some View {
        Group {
            if store.onboarded {
                TabView {
                    ORoomsView().tabItem { Label("Rooms", systemImage: "person.2").accessibilityIdentifier("orbit.tab.rooms") }
                    OPlacesView().tabItem { Label("Places", systemImage: "bookmark").accessibilityIdentifier("orbit.tab.places") }
                    OYouView().tabItem { Label("You", systemImage: "person.crop.circle").accessibilityIdentifier("orbit.tab.you") }
                }.id(store.mode)
            } else { OWelcomeView() }
        }
        .alert(store.error == nil ? "Orbit" : "Couldn't finish that", isPresented: Binding(get: { store.error != nil || store.notice != nil }, set: { if !$0 { store.error = nil; store.notice = nil } })) {
            Button("OK", role: .cancel) { store.error = nil; store.notice = nil }
        } message: { Text(store.error ?? store.notice ?? "") }
        .onOpenURL { url in
            if store.onboarded { store.joinOnline(url.absoluteString) }
            else { deferredInvite = url.absoluteString }
        }
        .onChange(of: store.onboarded) { _, ready in
            if ready, let invite = deferredInvite { deferredInvite = nil; store.joinOnline(invite) }
        }
        .onChange(of: scenePhase) { _, phase in store.setActive(phase == .active) }
        .onAppear { store.setActive(scenePhase == .active) }
    }
}

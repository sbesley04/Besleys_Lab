import SwiftUI
import UserNotifications

final class GNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}

@main
struct GatherApp: App {
    @StateObject private var store: GStore
    private let notificationDelegate = GNotificationDelegate()
    init() {
        let args = ProcessInfo.processInfo.arguments
        _store = StateObject(wrappedValue: GStore(forceDemo: args.contains("--demo"), testing: args.contains("--uitesting")))
        UNUserNotificationCenter.current().delegate = notificationDelegate
    }
    var body: some Scene {
        WindowGroup {
            Group {
                if store.hasStarted { GHomeView() } else { GWelcomeView() }
            }
            .environmentObject(store).tint(GTheme.sage).foregroundStyle(GTheme.ink)
            .preferredColorScheme(.light)
            .onOpenURL { store.importURL($0) }
            .alert("Something needs attention", isPresented: Binding(get: { store.failure != nil }, set: { if !$0 { store.failure = nil } })) {
                Button("OK") { store.failure = nil }
            } message: { Text(store.failure ?? "") }
        }
    }
}

struct GWelcomeView: View {
    @EnvironmentObject var store: GStore
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                HStack { Image(systemName: "circle.grid.2x2.fill").font(.title); Text("GATHER").font(.caption.weight(.bold)).tracking(3) }.foregroundStyle(GTheme.sage)
                Spacer(minLength: 32)
                Text("Less back-and-forth.\nOne good plan.").font(.system(size: 40, weight: .bold, design: .rounded)).fixedSize(horizontal: false, vertical: true)
                Text("Give everyone a say, see where you agree, and choose what happens next.")
                    .font(.title3).foregroundStyle(GTheme.muted)
                GCard {
                    VStack(alignment: .leading, spacing: 17) {
                        Label("Add a few real options", systemImage: "square.stack")
                        Label("Swipe yes or no—with feeling", systemImage: "hand.draw")
                        Label("Choose with the whole picture", systemImage: "checkmark.circle")
                    }.font(.subheadline.weight(.medium))
                }
                VStack(spacing: 12) {
                    Button("Try the demo") { store.start(.demo) }.buttonStyle(GPrimaryButton()).accessibilityIdentifier("demo.start")
                    Button("Start with my own decisions") { store.start(.personal) }.buttonStyle(GSecondaryButton()).accessibilityIdentifier("fresh.start")
                }
                Text("No account. Your library stays on this device. Invite friends with a file, or pass your phone around.")
                    .font(.footnote).foregroundStyle(GTheme.muted)
            }.padding(24)
        }.background(GTheme.background)
    }
}

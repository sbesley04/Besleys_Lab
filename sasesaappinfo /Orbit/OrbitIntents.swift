import AppIntents
import Foundation

struct SaveOrbitIdeaIntent: AppIntent {
    static var title: LocalizedStringResource = "Save an idea to Orbit"
    static var description = IntentDescription("Save a title and note in your private Orbit library. Sharing it with a room is a separate choice.")
    static var openAppWhenRun = true

    @Parameter(title: "Title")
    var title: String

    @Parameter(title: "Note", default: "")
    var note: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let place = OPlace(title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                           note: note.trimmingCharacters(in: .whitespacesAndNewlines))
        try place.validate()
        let saved = await MainActor.run { OrbitStore.shared.savePlace(place) }
        guard saved else { throw OrbitIntentError.saveFailed }
        return .result(dialog: "Saved to your private Orbit library.")
    }
}

private enum OrbitIntentError: LocalizedError {
    case saveFailed
    var errorDescription: String? {
        "Orbit could not save this idea. Open Orbit to see the details and try again."
    }
}

struct OrbitShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: SaveOrbitIdeaIntent(),
                    phrases: ["Save an idea in \(.applicationName)", "Keep an idea in \(.applicationName)"],
                    shortTitle: "Save an idea", systemImageName: "bookmark")
    }
}

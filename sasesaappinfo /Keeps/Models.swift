import Foundation
import UniformTypeIdentifiers

enum KeepsCategory: String, Codable, CaseIterable, Identifiable {
    case food = "Food & drink", activity = "Things to do", trip = "Trips", shopping = "Shopping", other = "Other"
    var id: String { rawValue }
    var symbol: String {
        switch self { case .food: return "fork.knife"; case .activity: return "ticket"; case .trip: return "suitcase.rolling"; case .shopping: return "bag"; case .other: return "bookmark" }
    }
}

struct SavedIdea: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String
    var category: KeepsCategory = .other
    var sourceURL: String = ""
    var originalText: String = ""
    var notes: String = ""
    var tags: [String] = []
    var estimatedPrice: Int?
    var walkMinutes: Int?
    var photoData: Data?
    var favorite = false
    var archived = false
    var createdAt = Date()
    var reminderAt: Date?
    var sourceHost: String? { URL(string: sourceURL)?.host?.replacingOccurrences(of: "www.", with: "") }
    var searchableText: String { ([title, notes, originalText, category.rawValue, sourceURL] + tags).joined(separator: " ") }
    var externalURL: URL? {
        guard let url = URL(string: sourceURL), ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host != nil else { return nil }
        return url
    }
}

enum SwipePreference: Int, Codable, CaseIterable, Identifiable {
    case strongNo = -2, weakNo = -1, weakYes = 1, strongYes = 2
    var id: Int { rawValue }
    var title: String {
        switch self { case .strongYes: return "Strong yes"; case .weakYes: return "Weak yes"; case .weakNo: return "Weak no"; case .strongNo: return "Strong no" }
    }
    var symbol: String {
        switch self { case .strongYes: return "arrow.up"; case .weakYes: return "arrow.right"; case .weakNo: return "arrow.left"; case .strongNo: return "arrow.down" }
    }
    var testID: String {
        switch self { case .strongYes: return "strongYes"; case .weakYes: return "weakYes"; case .weakNo: return "weakNo"; case .strongNo: return "strongNo" }
    }
    static func fromDrag(x: Double, y: Double) -> SwipePreference {
        abs(x) > abs(y) ? (x > 0 ? .weakYes : .weakNo) : (y < 0 ? .strongYes : .strongNo)
    }
}

struct RetrievalFilter: Equatable {
    var query = ""
    var category: KeepsCategory?
    var maxPrice: Int?
    var maxWalk: Int?
    var favoritesOnly = false
    func matches(_ idea: SavedIdea) -> Bool {
        guard !idea.archived else { return false }
        if let category, idea.category != category { return false }
        if favoritesOnly && !idea.favorite { return false }
        if let maxPrice, (idea.estimatedPrice ?? Int.max) > maxPrice { return false }
        if let maxWalk, (idea.walkMinutes ?? Int.max) > maxWalk { return false }
        let terms = query.lowercased().split(whereSeparator: { $0.isWhitespace })
        return terms.allSatisfy { idea.searchableText.localizedCaseInsensitiveContains(String($0)) }
    }
    func reason(for idea: SavedIdea) -> String {
        var reasons: [String] = []
        if let maxPrice { reasons.append("within your $\(maxPrice) limit") }
        if let maxWalk { reasons.append("within \(maxWalk) minutes on foot") }
        if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { reasons.append("matches “\(query)”") }
        if favoritesOnly { reasons.append("one of your favorites") }
        return reasons.isEmpty ? "Saved by you · \(idea.createdAt.formatted(date: .abbreviated, time: .omitted))" : reasons.joined(separator: " · ").prefix(1).uppercased() + reasons.joined(separator: " · ").dropFirst()
    }
}

struct DecisionRecord: Identifiable, Codable, Equatable {
    var id = UUID()
    var createdAt = Date()
    var selectedTitle: String
    var selectedIdeaID: UUID
    var consideredCount: Int
}

struct KeepsBackup: Codable {
    var format = "keeps-library"
    var version = 1
    var exportedAt = Date()
    var items: [SavedIdea]
    var decisions: [DecisionRecord]
    static let maximumBytes = 30_000_000
    static func readFile(_ url: URL) throws -> Data {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        let data = try handle.read(upToCount: maximumBytes + 1) ?? Data()
        guard data.count <= maximumBytes else { throw KeepsError.message("That file is larger than the 30 MB import limit.") }
        return data
    }
    static func decode(_ data: Data) throws -> KeepsBackup {
        guard data.count <= maximumBytes else { throw KeepsError.message("That backup is larger than the 30 MB import limit.") }
        let backup: KeepsBackup
        do { backup = try JSONDecoder().decode(KeepsBackup.self, from: data) }
        catch { throw KeepsError.message("This file is not a valid Keeps backup. Choose a .keepsbackup file exported by Keeps.") }
        guard backup.format == "keeps-library", backup.version == 1 else { throw KeepsError.message("This backup format is not supported by this version of Keeps.") }
        guard backup.items.count <= 2_000, backup.decisions.count <= 10_000 else { throw KeepsError.message("This backup contains too many entries.") }
        guard Set(backup.items.map(\.id)).count == backup.items.count else { throw KeepsError.message("This backup contains duplicate idea identifiers.") }
        guard Set(backup.decisions.map(\.id)).count == backup.decisions.count, backup.decisions.allSatisfy({ !$0.selectedTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.selectedTitle.count <= 300 && (1...2_000).contains($0.consideredCount) }) else { throw KeepsError.message("This backup contains invalid decision history.") }
        guard backup.items.allSatisfy({ !$0.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.title.count <= 300 && $0.notes.count <= 20_000 && $0.originalText.count <= 20_000 && $0.sourceURL.count <= 4_000 && $0.tags.count <= 40 && $0.tags.allSatisfy({ $0.count <= 80 }) && ($0.photoData?.count ?? 0) <= 4_000_000 && ($0.estimatedPrice == nil || (0...100_000).contains($0.estimatedPrice!)) && ($0.walkMinutes == nil || (0...1_440).contains($0.walkMinutes!)) }) else { throw KeepsError.message("This backup has an invalid or oversized idea. Your library was not changed.") }
        return backup
    }
}

enum KeepsError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let message) = self { return message }; return nil }
}

enum CaptureParser {
    static func draft(from text: String) -> SavedIdea {
        let trimmed = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(20_000))
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let match = detector?.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed))
        let url = match?.url.flatMap { ["http", "https"].contains($0.scheme?.lowercased() ?? "") ? $0 : nil }
        let lines = trimmed.components(separatedBy: .newlines).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        let meaningfulLine = lines.first { !$0.hasPrefix("http://") && !$0.hasPrefix("https://") }
        let title = meaningfulLine.map { String($0.prefix(300)) } ?? url?.host?.replacingOccurrences(of: "www.", with: "") ?? ""
        let tags = trimmed.split(whereSeparator: { $0.isWhitespace }).filter { $0.hasPrefix("#") && $0.count > 1 }.map { String($0.dropFirst().prefix(80)) }
        return SavedIdea(title: title, sourceURL: url?.absoluteString ?? "", originalText: trimmed, tags: Array(Set(tags)).sorted())
    }
}

extension UTType {
    static let keepsBackup = UTType(exportedAs: "com.besleyslab.keeps.backup", conformingTo: .json)
}

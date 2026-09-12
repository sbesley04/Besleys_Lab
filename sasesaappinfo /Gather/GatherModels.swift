import Foundation

enum GMode: String, Codable, CaseIterable { case personal, demo }

struct GParticipant: Identifiable, Codable, Equatable {
    var id = UUID()
    var name: String
}

struct GCandidate: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String
    var detail: String = ""
    var price: Int = 20
    var minutes: Int = 15
    var url: String = ""
}

enum GPreference: Int, Codable, CaseIterable {
    case strongNo = -2, weakNo = -1, weakYes = 1, strongYes = 2
    var title: String {
        switch self {
        case .strongNo: return "Strong no"
        case .weakNo: return "Weak no"
        case .weakYes: return "Weak yes"
        case .strongYes: return "Strong yes"
        }
    }
    var symbol: String {
        switch self {
        case .strongNo: return "arrow.down"
        case .weakNo: return "arrow.left"
        case .weakYes: return "arrow.right"
        case .strongYes: return "arrow.up"
        }
    }
}

struct GBallot: Identifiable, Codable, Equatable {
    var id = UUID()
    var sessionID: UUID
    var revision: UUID
    var participantID: UUID
    var ratings: [UUID: Int]
    var submittedAt = Date()
}

struct GSession: Identifiable, Codable, Equatable {
    var id = UUID()
    var revision = UUID()
    var title: String
    var context: String = ""
    var participants: [GParticipant]
    var candidates: [GCandidate]
    var ballots: [GBallot] = []
    var isOrganizer = true
    var chosenCandidateID: UUID?
    var reminderDate: Date?
    var createdAt = Date()
    var updatedAt = Date()

    var chosenCandidate: GCandidate? { candidates.first { $0.id == chosenCandidateID } }
    var completeBallots: [GBallot] {
        var seen = Set<UUID>()
        return ballots.sorted { $0.submittedAt > $1.submittedAt }.filter { ballot in
            guard ballot.sessionID == id, ballot.revision == revision,
                  participants.contains(where: { $0.id == ballot.participantID }),
                  Set(ballot.ratings.keys) == Set(candidates.map(\.id)),
                  ballot.ratings.values.allSatisfy({ GPreference(rawValue: $0) != nil }) else { return false }
            return seen.insert(ballot.participantID).inserted
        }
    }
    var pendingNames: [String] {
        let finished = Set(completeBallots.map(\.participantID))
        return participants.filter { !finished.contains($0.id) }.map(\.name)
    }
    func ballot(for participantID: UUID) -> GBallot? {
        completeBallots.first { $0.participantID == participantID }
    }
    var rankings: [GResult] {
        candidates.map { candidate in
            let ratings = completeBallots.compactMap { $0.ratings[candidate.id] }
            let objectors = completeBallots.filter { $0.ratings[candidate.id] == -2 }.compactMap { ballot in
                participants.first { $0.id == ballot.participantID }?.name
            }
            return GResult(candidate: candidate, support: ratings.filter { $0 > 0 }.count,
                           strongYes: ratings.filter { $0 == 2 }.count, objections: objectors,
                           score: ratings.reduce(0, +), responses: ratings.count)
        }.sorted {
            if $0.objections.count != $1.objections.count { return $0.objections.count < $1.objections.count }
            if $0.support != $1.support { return $0.support > $1.support }
            if $0.score != $1.score { return $0.score > $1.score }
            return $0.candidate.title.localizedStandardCompare($1.candidate.title) == .orderedAscending
        }
    }
}

struct GResult: Identifiable {
    var id: UUID { candidate.id }
    let candidate: GCandidate
    let support: Int
    let strongYes: Int
    let objections: [String]
    let score: Int
    let responses: Int
    var everyoneAccepts: Bool { responses > 0 && support == responses }
}

/// Deliberately excludes ballots, chosen plans and private device state.
struct GInvitation: Codable, Equatable {
    var sessionID: UUID
    var revision: UUID
    var title: String
    var context: String
    var participants: [GParticipant]
    var candidates: [GCandidate]
    init(session: GSession) {
        sessionID = session.id; revision = session.revision; title = session.title
        context = session.context; participants = session.participants; candidates = session.candidates
    }
    func makeSession() -> GSession {
        GSession(id: sessionID, revision: revision, title: title, context: context,
                 participants: participants, candidates: candidates, isOrganizer: false)
    }
}

struct GTransfer: Codable {
    static let currentVersion = 1
    var version = currentVersion
    var kind: Kind
    var invitation: GInvitation?
    var ballot: GBallot?
    enum Kind: String, Codable { case invitation, ballot }
    static func invite(_ session: GSession) -> GTransfer {
        GTransfer(kind: .invitation, invitation: GInvitation(session: session))
    }
    static func response(_ ballot: GBallot) -> GTransfer { GTransfer(kind: .ballot, ballot: ballot) }
    func validated() throws -> GTransfer {
        guard version == Self.currentVersion else { throw GError.invalid("This file uses an unsupported Gather version.") }
        switch kind {
        case .invitation:
            guard let invitation, ballot == nil else { throw GError.invalid("This invitation is incomplete.") }
            try GValidation.session(invitation.makeSession())
        case .ballot:
            guard let ballot, invitation == nil,
                  (3...12).contains(ballot.ratings.count),
                  ballot.ratings.values.allSatisfy({ GPreference(rawValue: $0) != nil })
            else { throw GError.invalid("This response contains incomplete or invalid votes.") }
        }
        return self
    }
    func encoded() throws -> Data { try JSONEncoder().encode(self) }
    static func decode(_ data: Data) throws -> GTransfer {
        guard data.count <= 1_000_000 else { throw GError.invalid("This file is too large to be a Gather decision.") }
        return try JSONDecoder().decode(GTransfer.self, from: data).validated()
    }
}

enum GError: LocalizedError {
    case invalid(String)
    var errorDescription: String? { if case let .invalid(message) = self { return message }; return nil }
}

enum GValidation {
    static func session(_ session: GSession) throws {
        guard !session.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, session.title.count <= 100,
              session.context.count <= 1200 else { throw GError.invalid("Give this decision a title of 1–100 characters and notes under 1,200 characters.") }
        guard (1...20).contains(session.participants.count),
              Set(session.participants.map(\.id)).count == session.participants.count,
              session.participants.allSatisfy({ !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.name.count <= 40 }),
              Set(session.participants.map { $0.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }).count == session.participants.count
        else { throw GError.invalid("Add 1–20 people with distinct names, each under 40 characters.") }
        guard (3...12).contains(session.candidates.count), Set(session.candidates.map(\.id)).count == session.candidates.count
        else { throw GError.invalid("Add between 3 and 12 different options.") }
        for candidate in session.candidates {
            guard !candidate.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  candidate.title.count <= 100, candidate.detail.count <= 500,
                  (0...10000).contains(candidate.price), (0...1440).contains(candidate.minutes)
            else { throw GError.invalid("Each option needs a name; price must be $0–10,000 and travel 0–1,440 minutes.") }
            if !candidate.url.isEmpty {
                guard let url = URL(string: candidate.url), ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
                      let host = url.host, !host.isEmpty, candidate.url.count <= 2000
                else { throw GError.invalid("Optional links must be complete http:// or https:// addresses.") }
            }
        }
    }
    static func ballot(_ ballot: GBallot, for session: GSession) throws {
        guard ballot.sessionID == session.id else { throw GError.invalid("This response belongs to another decision.") }
        guard ballot.revision == session.revision else { throw GError.invalid("This response is from an older version. Share the latest invitation and ask them to vote again.") }
        guard session.participants.contains(where: { $0.id == ballot.participantID })
        else { throw GError.invalid("This person is not on this decision’s participant list.") }
        guard Set(ballot.ratings.keys) == Set(session.candidates.map(\.id)),
              ballot.ratings.values.allSatisfy({ GPreference(rawValue: $0) != nil })
        else { throw GError.invalid("The response must rate every current option exactly once.") }
    }
}

enum GDemo {
    static func sessions() -> [GSession] {
        let people = ["You", "Maya", "Jordan", "Alex", "Sam"].map { GParticipant(name: $0) }
        let places = [
            GCandidate(title: "Little Olive", detail: "Mediterranean bowls · vegetarian choices", price: 18, minutes: 8),
            GCandidate(title: "Noodle House", detail: "Ramen & rice bowls · lively dining room", price: 22, minutes: 12),
            GCandidate(title: "Corner Slice", detail: "Pizza to share · walk-ins welcome", price: 14, minutes: 5),
            GCandidate(title: "Garden Table", detail: "Seasonal plates · quieter space", price: 28, minutes: 18)
        ]
        var dinner = GSession(title: "Friday dinner", context: "Around 7 pm · keep it under $30 per person. Sample places for exploring Gather.", participants: people, candidates: places)
        let votes = [[2, 1, 1, -1], [1, -2, 2, 1], [2, 1, 1, -1]]
        for (offset, ratings) in votes.enumerated() {
            dinner.ballots.append(GBallot(sessionID: dinner.id, revision: dinner.revision, participantID: people[offset + 1].id,
                                          ratings: Dictionary(uniqueKeysWithValues: zip(places.map(\.id), ratings))))
        }
        let activities = [GCandidate(title: "Campus film night", detail: "Student cinema · 8 pm", price: 6, minutes: 5),
                          GCandidate(title: "Board game café", detail: "Games and snacks · 7 pm", price: 15, minutes: 12),
                          GCandidate(title: "Evening picnic", detail: "Bring a blanket · 6 pm", price: 8, minutes: 10)]
        var weekend = GSession(title: "Saturday with the flat", context: "A low-key evening. This is sample data, not a live event.", participants: Array(people.prefix(3)), candidates: activities)
        for person in weekend.participants {
            weekend.ballots.append(GBallot(sessionID: weekend.id, revision: weekend.revision, participantID: person.id,
                                          ratings: [activities[0].id: 1, activities[1].id: 2, activities[2].id: -1]))
        }
        weekend.chosenCandidateID = activities[1].id
        return [dinner, weekend]
    }
}

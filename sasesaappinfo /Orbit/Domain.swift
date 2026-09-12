import Foundation

struct OPlace: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String
    var note = ""
    var category = "Place"
    var address = ""
    var latitude: Double?
    var longitude: Double?
    var url = ""
    var price: Int?
    var photoData: Data?
    var shared: OPlace { var copy = self; copy.photoData = nil; return copy }
    var webURL: URL? {
        guard let value = URL(string: url), ["http", "https"].contains(value.scheme?.lowercased() ?? ""), value.host != nil else { return nil }; return value
    }
    func validate() throws {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, title.count <= 120, note.count <= 1000,
              category.count <= 80, address.count <= 500, url.count <= 2000,
              price == nil || (0...100_000).contains(price!), (photoData?.count ?? 0) <= 3_000_000,
              latitude == nil || (-90...90).contains(latitude!), longitude == nil || (-180...180).contains(longitude!),
              (latitude == nil) == (longitude == nil), url.isEmpty || webURL != nil else {
            throw OError.message("Check the place name, link, coordinates, and estimates. Some details are missing or too long.")
        }
    }
}
struct OPerson: Identifiable, Codable, Equatable { var id: UUID; var name: String }
struct OMessage: Identifiable, Codable, Equatable {
    var id = UUID(); var personID: UUID; var name: String; var text: String; var createdAt = Date()
}
struct OBallot: Codable, Equatable {
    var personID: UUID; var optionRevision: UUID; var ratings: [String: Int]
}
struct OCommand: Codable {
    var id = UUID(); var kind: String
    var text: String?; var place: OPlace?; var ballot: OBallot?; var placeID: UUID?; var memberID: UUID?
}
struct OWire: Codable {
    var version = 1; var kind: String; var room: ORoom?; var command: OCommand?; var message: String?
}
struct ORanking: Identifiable {
    var id: UUID { place.id }; var place: OPlace; var yes: Int; var strongYes: Int; var strongNo: Int; var score: Int; var responses: Int
}
struct ORoom: Identifiable, Codable, Equatable {
    var id = UUID(); var title: String; var hostID: UUID; var revision = 1; var optionRevision = UUID()
    var phase = "collecting"; var members: [OPerson]; var places: [OPlace] = []
    var ballots: [OBallot] = []; var messages: [OMessage] = []; var selectedPlaceID: UUID?
    var eventDate = Date().addingTimeInterval(7200); var createdAt = Date(); var appliedIDs: [UUID] = []
    var selectedPlace: OPlace? { places.first { $0.id == selectedPlaceID } }
    var pending: [OPerson] { members.filter { person in !ballots.contains { $0.personID == person.id } } }
    var rankings: [ORanking] {
        places.map { place in
            let votes = ballots.compactMap { $0.ratings[place.id.uuidString.lowercased()] }
            return ORanking(place: place, yes: votes.filter { $0 > 0 }.count, strongYes: votes.filter { $0 == 2 }.count,
                            strongNo: votes.filter { $0 == -2 }.count, score: votes.reduce(0,+), responses: votes.count)
        }.sorted { a,b in
            if a.strongNo != b.strongNo { return a.strongNo < b.strongNo }
            if a.yes != b.yes { return a.yes > b.yes }
            if a.score != b.score { return a.score > b.score }
            return a.place.title.localizedStandardCompare(b.place.title) == .orderedAscending
        }
    }
    func validate() throws {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, title.count <= 80,
              revision >= 1, ["collecting","voting","decided"].contains(phase), (1...8).contains(members.count),
              Set(members.map(\.id)).count == members.count, members.contains(where: { $0.id == hostID }),
              members.allSatisfy({ !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.name.count <= 20 }),
              places.count <= 12, Set(places.map(\.id)).count == places.count,
              messages.count <= 200, appliedIDs.count <= 200,
              messages.allSatisfy({ $0.text.count <= 1000 && $0.name.count <= 20 }),
              Set(ballots.map(\.personID)).count == ballots.count,
              selectedPlaceID == nil || selectedPlace != nil,
              phase != "decided" || selectedPlaceID != nil else { throw OError.message("This room contains invalid or unsupported data.") }
        for place in places { try place.validate() }
        for ballot in ballots { try validate(ballot) }
    }
    func validate(_ ballot: OBallot) throws {
        guard members.contains(where: { $0.id == ballot.personID }), ballot.optionRevision == optionRevision,
              Set(ballot.ratings.keys) == Set(places.map { $0.id.uuidString.lowercased() }),
              ballot.ratings.values.allSatisfy({ [-2,-1,1,2].contains($0) }) else {
            throw OError.message("The options changed, or the response is incomplete. Start a fresh swipe session.")
        }
    }
    mutating func apply(_ command: OCommand, from personID: UUID) throws {
        guard let person = members.first(where: { $0.id == personID }) else { throw OError.message("Join the room before sending a response.") }
        if appliedIDs.contains(command.id) { return }
        switch command.kind {
        case "chat":
            let text = command.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !text.isEmpty, text.count <= 1000 else { throw OError.message("Write a message of up to 1,000 characters.") }
            messages.append(OMessage(personID: person.id, name: person.name, text: text)); messages = Array(messages.suffix(200))
        case "suggest":
            guard phase == "collecting", places.count < 12, let place = command.place,
                  !places.contains(where: { $0.id == place.id }) else { throw OError.message("Options are closed for this round. The host can reopen suggestions.") }
            try place.validate(); places.append(place.shared)
        case "vote":
            guard phase == "voting", let ballot = command.ballot, ballot.personID == personID else { throw OError.message("Voting is not open for this response.") }
            try validate(ballot); ballots.removeAll { $0.personID == personID }; ballots.append(ballot)
        case "start":
            guard personID == hostID, phase == "collecting", places.count >= 2 else { throw OError.message("The host can start voting after at least two options are added.") }
            phase = "voting"
        case "choose":
            guard personID == hostID, phase == "voting", !ballots.isEmpty, let id = command.placeID,
                  places.contains(where: { $0.id == id }) else { throw OError.message("Only the host can confirm a plan after voting has started.") }
            selectedPlaceID = id; phase = "decided"
        case "reopen":
            guard personID == hostID else { throw OError.message("Only the host can reopen suggestions.") }
            phase = "collecting"; ballots = []; selectedPlaceID = nil; optionRevision = UUID()
        case "remove":
            guard personID == hostID, phase == "collecting", let id = command.placeID else { throw OError.message("Only the host can remove an option before voting.") }
            places.removeAll { $0.id == id }
        default: throw OError.message("This action is not supported. Update Orbit and try again.")
        }
        appliedIDs.append(command.id); appliedIDs = Array(appliedIDs.suffix(200)); revision += 1
        // Keep complete snapshots below the nearby transport's 256 KB packet limit.
        while messages.count > 1, (try OJSON.encoder().encode(self)).count > 220_000 { messages.removeFirst() }
        try validate()
    }
}
enum OError: LocalizedError { case message(String); var errorDescription: String? { if case let .message(text) = self { return text }; return nil } }
enum OJSON {
    static func encoder() -> JSONEncoder { let value = JSONEncoder(); value.dateEncodingStrategy = .millisecondsSince1970; return value }
    static func decoder() -> JSONDecoder { let value = JSONDecoder(); value.dateDecodingStrategy = .millisecondsSince1970; return value }
}
enum ODemo {
    static func places() -> [OPlace] {
        [OPlace(title:"Little Olive",note:"Mediterranean bowls. A fictional option for testing.",category:"Dinner",address:"Sample campus place",price:18),
         OPlace(title:"Campus film night",note:"A low-key evening after class. Fictional demo event.",category:"Activities",price:8),
         OPlace(title:"Noodle House",note:"Shared tables and vegetarian choices. Fictional demo place.",category:"Dinner",price:22),
         OPlace(title:"Riverside picnic",note:"Bring a blanket and something to share. Fictional demo plan.",category:"Outdoors",price:10)]
    }
    static func room(person: OPerson) -> ORoom {
        let maya = OPerson(id:UUID(),name:"Maya"), lee = OPerson(id:UUID(),name:"Lee")
        var room = ORoom(title:"Friday, together",hostID:person.id,members:[person,maya,lee],places:Array(places().prefix(3)))
        room.phase = "voting"
        for member in [maya,lee] { room.ballots.append(OBallot(personID:member.id,optionRevision:room.optionRevision,ratings:Dictionary(uniqueKeysWithValues:room.places.enumerated().map { ($0.element.id.uuidString.lowercased(),$0.offset == 0 ? 2 : 1) }))) }
        room.messages = [OMessage(personID:maya.id,name:maya.name,text:"Sample conversation: somewhere easy after class?"),OMessage(personID:lee.id,name:lee.name,text:"I’m happy with any of these. Your turn to swipe.")]
        return room
    }
}

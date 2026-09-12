import SwiftUI

struct RetrievalBatch: Identifiable {
    var id = UUID()
    var items: [SavedIdea]
    var filter: RetrievalFilter
}

struct RetrieveView: View {
    @EnvironmentObject private var store: KeepsStore
    @State private var filter = RetrievalFilter()
    @State private var budgetEnabled = false
    @State private var walkEnabled = false
    @State private var budget = 30
    @State private var walk = 20
    @State private var session: RetrievalBatch?
    private var matches: [SavedIdea] {
        store.items.filter { effectiveFilter.matches($0) }.sorted {
            if $0.favorite != $1.favorite { return $0.favorite }
            return $0.createdAt > $1.createdAt
        }
    }
    private var effectiveFilter: RetrievalFilter {
        var result = filter
        result.maxPrice = budgetEnabled ? budget : nil
        result.maxWalk = walkEnabled ? walk : nil
        return result
    }
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                DemoBanner()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 7) {
                            Text("What sounds good?").font(.largeTitle.bold())
                            Text("Start with your own saves. A few swipes can turn “maybe someday” into a choice.").foregroundStyle(.secondary)
                        }
                        VStack(alignment: .leading, spacing: 16) {
                            HStack { Image(systemName: "magnifyingglass").foregroundStyle(.secondary); TextField("Try quiet, noodles, or weekend", text: $filter.query).autocorrectionDisabled().accessibilityIdentifier("keeps.retrieve.query") }.padding(13).background(KeepsStyle.background, in: RoundedRectangle(cornerRadius: 12))
                            Picker("Category", selection: $filter.category) {
                                Text("Everything").tag(Optional<KeepsCategory>.none)
                                ForEach(KeepsCategory.allCases) { category in Text(category.rawValue).tag(Optional(category)) }
                            }.pickerStyle(.menu)
                            Toggle("Set a price limit", isOn: $budgetEnabled)
                            if budgetEnabled {
                                Stepper("Up to $\(budget)", value: $budget, in: 0...1_000, step: 5).font(.subheadline)
                            }
                            Toggle("Set a walking limit", isOn: $walkEnabled)
                            if walkEnabled {
                                Stepper("Up to \(walk) minutes", value: $walk, in: 0...180, step: 5).font(.subheadline)
                            }
                            Toggle("Favorites only", isOn: $filter.favoritesOnly)
                            if budgetEnabled || walkEnabled { Text("Ideas with unknown price or walking time are excluded when that limit is on. Walking estimates use your saved campus reference.").font(.caption).foregroundStyle(.secondary) }
                        }.padding(18).cardStyle()
                        HStack { Text("\(matches.count) matching \(matches.count == 1 ? "idea" : "ideas")").font(.headline); Spacer(); Button("Clear filters") { filter = RetrievalFilter(); budgetEnabled = false; walkEnabled = false }.font(.subheadline) }
                        if matches.isEmpty {
                            ContentUnavailableView("Nothing fits yet", systemImage: "line.3.horizontal.decrease.circle", description: Text(store.activeItems.isEmpty ? "Save a few ideas in your Library, then come back to find a favorite." : "Widen your limits or try another word. Keeps only uses ideas you have saved."))
                        } else {
                            Button {
                                session = RetrievalBatch(items: Array(matches.prefix(8)), filter: effectiveFilter)
                            } label: { HStack { Text("Swipe \(min(matches.count, 8)) ideas"); Spacer(); Image(systemName: "arrow.right") }.frame(maxWidth: .infinity) }.buttonStyle(KeepsPrimaryButton()).accessibilityIdentifier("keeps.startSession")
                            Text("A short session for you. Responses apply only to this decision. Favorites appear first, then your newest saves.\(matches.count > 8 ? " Showing the first 8 to keep this manageable." : "")").font(.footnote).foregroundStyle(.secondary)
                            ForEach(matches.prefix(12)) { item in
                                NavigationLink { IdeaDetailView(ideaID: item.id) } label: {
                                    VStack(alignment: .leading, spacing: 7) { IdeaRow(item: item); Text(effectiveFilter.reason(for: item)).font(.caption).foregroundStyle(.secondary).padding(.horizontal, 6) }
                                }.buttonStyle(.plain)
                            }
                            if matches.count > 12 { Text("Narrow your filters to browse the remaining \(matches.count - 12) ideas, or see every save in Library.").font(.footnote).foregroundStyle(.secondary) }
                        }
                    }.padding(22)
                }
            }.background(KeepsStyle.background)
            .navigationTitle("Decide").navigationBarTitleDisplayMode(.inline)
            .sheet(item: $session) { batch in SwipeSessionView(batch: batch) }
        }
    }
}

struct SwipeSessionView: View {
    @EnvironmentObject private var store: KeepsStore
    @Environment(\.dismiss) private var dismiss
    let batch: RetrievalBatch
    @State private var index = 0
    @State private var votes: [UUID: SwipePreference] = [:]
    @State private var drag = CGSize.zero
    @State private var chosen: SavedIdea?
    @State private var showReminder = false
    @State private var showExit = false
    private var results: [SavedIdea] {
        batch.items.enumerated().filter { (votes[$0.element.id]?.rawValue ?? 0) > 0 }.sorted {
            let left = votes[$0.element.id]?.rawValue ?? 0
            let right = votes[$1.element.id]?.rawValue ?? 0
            return left == right ? $0.offset < $1.offset : left > right
        }.prefix(3).map(\.element)
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    DemoBanner()
                    if let chosen { resolution(chosen) }
                    else if index < batch.items.count { voting(batch.items[index]) }
                    else { outcome }
                }.padding(22)
            }.background(KeepsStyle.background)
            .navigationTitle(chosen == nil ? "Your shortlist" : "One idea, chosen").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(chosen == nil && index < batch.items.count ? "Close" : "Done") { if index > 0 && index < batch.items.count { showExit = true } else { dismiss() } }.accessibilityIdentifier("keeps.session.close") }
                if index > 0 && chosen == nil { ToolbarItem(placement: .topBarTrailing) { Button("Undo") { index -= 1; votes.removeValue(forKey: batch.items[index].id) }.accessibilityIdentifier("keeps.session.undo") } }
            }
            .interactiveDismissDisabled(index > 0 && index < batch.items.count)
            .confirmationDialog("Leave this swipe session?", isPresented: $showExit, titleVisibility: .visible) { Button("Leave session", role: .destructive) { dismiss() }; Button("Keep swiping", role: .cancel) {} } message: { Text("Your current responses will be discarded. Saved ideas stay in your library.") }
            .sheet(isPresented: $showReminder) { if let chosen, let current = store.items.first(where: { $0.id == chosen.id }) { ReminderView(item: current) } }
        }
    }
    @ViewBuilder private func voting(_ item: SavedIdea) -> some View {
        HStack { Text("\(index + 1) OF \(batch.items.count)").font(.caption.weight(.semibold)).foregroundStyle(KeepsStyle.sage); Spacer(); Text("Just for this decision").font(.caption).foregroundStyle(.secondary) }
        ProgressView(value: Double(index), total: Double(max(1, batch.items.count)))
        VStack(alignment: .leading, spacing: 16) {
            IdeaThumbnail(item: item, large: true)
            Text(item.title).font(.title.bold()).accessibilityIdentifier("keeps.retrieve.card")
            Text([item.category.rawValue, item.estimatedPrice.map { "$\($0) estimated" }, item.walkMinutes.map { "\($0) min walk" }].compactMap { $0 }.joined(separator: " · ")).font(.subheadline).foregroundStyle(.secondary)
            if !item.notes.isEmpty { Text(item.notes).font(.body).lineLimit(4) }
            if !item.tags.isEmpty { TagPills(tags: item.tags) }
            Text(batch.filter.reason(for: item)).font(.footnote).foregroundStyle(KeepsStyle.sage)
        }.padding(18).cardStyle()
        .offset(x: drag.width * 0.25, y: drag.height * 0.15)
        .rotationEffect(.degrees(Double(drag.width / 40)))
        .highPriorityGesture(DragGesture(minimumDistance: 10).onChanged { drag = $0.translation }.onEnded { gesture in
            let translation = gesture.translation
            drag = .zero
            guard max(abs(translation.width), abs(translation.height)) > 65 else { return }
            vote(SwipePreference.fromDrag(x: translation.width, y: translation.height))
        })
        VStack(spacing: 10) {
            voteButton(.strongYes)
            HStack(spacing: 12) { voteButton(.weakNo); voteButton(.weakYes) }
            voteButton(.strongNo)
        }
        Text("Swipe in a direction, or tap a button. Strong no removes an idea from this decision; your library stays the same.").font(.footnote).foregroundStyle(.secondary)
    }
    private func voteButton(_ preference: SwipePreference) -> some View {
        Button { vote(preference) } label: { Label(preference.title, systemImage: preference.symbol).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, 14).foregroundStyle(KeepsStyle.sage).background(preference == .strongYes ? KeepsStyle.paleSage : Color.white, in: RoundedRectangle(cornerRadius: 12)) }.accessibilityIdentifier("keeps.vote.\(preference.testID)")
    }
    private func vote(_ preference: SwipePreference) {
        guard index < batch.items.count else { return }
        votes[batch.items[index].id] = preference
        withAnimation(.easeOut(duration: 0.18)) { index += 1; drag = .zero }
    }
    @ViewBuilder private var outcome: some View {
        if results.isEmpty {
            Image(systemName: "square.stack").font(.system(size: 42, weight: .light)).foregroundStyle(KeepsStyle.sage).padding(.top, 20)
            Text("No yeses this time.").font(.largeTitle.bold())
            Text("Nothing you saw felt right. Your saved ideas are unchanged. Try different filters, or revisit a response with Undo.").foregroundStyle(.secondary)
            Button("Change my filters") { dismiss() }.buttonStyle(KeepsPrimaryButton())
            Button("Start these swipes again") { votes = [:]; index = 0 }.buttonStyle(KeepsSecondaryButton())
        } else {
            Text(results.count == 1 ? "Your next yes." : "A few good yeses.").font(.largeTitle.bold())
            Text("\(results.count) of your top choices from \(batch.items.count) ideas. Strong yeses come first. Ties keep the original order.").foregroundStyle(.secondary)
            ForEach(results) { item in
                VStack(alignment: .leading, spacing: 13) {
                    HStack { Text(item.title).font(.title3.bold()); Spacer(); Image(systemName: item.category.symbol).foregroundStyle(KeepsStyle.sage) }
                    Label(votes[item.id]?.title ?? "Yes", systemImage: votes[item.id]?.symbol ?? "checkmark").font(.subheadline).foregroundStyle(KeepsStyle.sage)
                    if !item.notes.isEmpty { Text(item.notes).font(.subheadline).foregroundStyle(.secondary).lineLimit(3) }
                    Button("Choose this") { if store.choose(item, considered: batch.items.count) { chosen = item } }.buttonStyle(KeepsPrimaryButton()).accessibilityIdentifier("keeps.retrieve.choose")
                    Button {
                        if let current = store.items.first(where: { $0.id == item.id }) { store.toggleFavorite(current) }
                    } label: { Label(store.items.first(where: { $0.id == item.id })?.favorite == true ? "Saved as a favorite" : "Remember as a favorite", systemImage: store.items.first(where: { $0.id == item.id })?.favorite == true ? "star.fill" : "star") }.font(.subheadline).accessibilityIdentifier("keeps.retrieve.favorite")
                }.padding(18).cardStyle()
            }
            Text("Only an explicit favorite changes your library preferences. These swipe responses are not kept after the session.").font(.footnote).foregroundStyle(.secondary)
        }
    }
    @ViewBuilder private func resolution(_ item: SavedIdea) -> some View {
        Image(systemName: "checkmark.circle").font(.system(size: 48, weight: .light)).foregroundStyle(KeepsStyle.sage).padding(.top, 20)
        Text("Make it happen.").font(.largeTitle.bold())
        Text(item.title).font(.title2.bold())
        Text("Saved to your decision history. Your choice is ready for the next step.").foregroundStyle(.secondary)
        if let current = store.items.first(where: { $0.id == item.id }) {
            if let url = current.externalURL { Link(destination: url) { Label("Open original link", systemImage: "arrow.up.right.square").frame(maxWidth: .infinity) }.buttonStyle(KeepsPrimaryButton()) }
            Button { showReminder = true } label: { Label("Remind me later", systemImage: "bell").frame(maxWidth: .infinity) }.buttonStyle(KeepsSecondaryButton())
            NavigationLink { IdeaDetailView(ideaID: item.id) } label: { Label("View saved idea", systemImage: "bookmark").frame(maxWidth: .infinity) }.buttonStyle(KeepsSecondaryButton())
        } else {
            Text("This idea was deleted from your library. Your decision remains in history.").foregroundStyle(.secondary)
        }
        Button("Done") { dismiss() }.buttonStyle(KeepsPrimaryButton()).accessibilityIdentifier("keeps.session.done")
        Text("Keeps does not make reservations or purchases. Use the original source to check availability and complete any booking.").font(.footnote).foregroundStyle(.secondary)
    }
}

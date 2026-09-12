import SwiftUI
import PhotosUI

struct LibraryView: View {
    @EnvironmentObject private var store: KeepsStore
    @State private var query = ""
    @State private var scope = "All"
    @State private var sortNewest = true
    @State private var showingCapture = false
    private var shownItems: [SavedIdea] {
        store.items.filter { item in
            (scope == "Archived" ? item.archived : !item.archived) && (scope != "Favorites" || item.favorite) && (query.isEmpty || item.searchableText.localizedCaseInsensitiveContains(query))
        }.sorted { sortNewest ? $0.createdAt > $1.createdAt : $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                DemoBanner()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 5) { Text("Good ideas, kept.").font(.title2.bold()); Text("\(store.activeItems.count) ideas to come back to").font(.subheadline).foregroundStyle(.secondary) }
                            Spacer()
                            Menu { Button("Newest first") { sortNewest = true }; Button("Title A–Z") { sortNewest = false } } label: { Image(systemName: "arrow.up.arrow.down").padding(10).background(.white, in: Circle()) }.accessibilityLabel("Sort library")
                        }
                        Picker("Library filter", selection: $scope) { Text("All").tag("All"); Text("Favorites").tag("Favorites"); Text("Archived").tag("Archived") }.pickerStyle(.segmented)
                        if shownItems.isEmpty {
                            ContentUnavailableView {
                                Label(query.isEmpty ? (scope == "Archived" ? "Nothing archived" : "Room for a good idea") : "No matching ideas", systemImage: "bookmark")
                            } description: {
                                Text(query.isEmpty ? "Keep a link, a note, or a photo. You can find it again when you need it." : "Try another word or clear the search.")
                            } actions: {
                                if query.isEmpty && scope == "All" { Button("Save your first idea") { showingCapture = true }.buttonStyle(KeepsSecondaryButton()) }
                                else if !query.isEmpty { Button("Clear search") { query = "" } }
                            }
                        } else {
                            LazyVStack(spacing: 12) {
                                ForEach(shownItems) { item in
                                    NavigationLink { IdeaDetailView(ideaID: item.id) } label: { IdeaRow(item: item) }.buttonStyle(.plain).accessibilityIdentifier("keeps.idea.\(item.title)")
                                        .contextMenu {
                                            Button(item.favorite ? "Remove favorite" : "Favorite", systemImage: item.favorite ? "star.slash" : "star") { store.toggleFavorite(item) }
                                            Button(item.archived ? "Restore to library" : "Archive", systemImage: item.archived ? "tray.and.arrow.up" : "archivebox") { store.toggleArchive(item) }
                                        }
                                }
                            }
                        }
                    }.padding(20)
                }
            }
            .background(KeepsStyle.background)
            .navigationTitle("keeps")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search titles, notes, or tags")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { showingCapture = true } label: { Image(systemName: "plus") }.accessibilityLabel("Save an idea").accessibilityIdentifier("keeps.add") } }
            .sheet(isPresented: $showingCapture) { CaptureView() }
        }
    }
}

struct CaptureView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: KeepsStore
    @State private var text = ""
    @State private var photo: PhotosPickerItem?
    @State private var draft: SavedIdea?
    @State private var photoLoading = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Keep something good.").font(.title.bold())
                    Text("Paste a link or text from anywhere, or choose a photo. Everything stays on this device.").foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("LINK OR TEXT").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        TextEditor(text: $text).frame(minHeight: 150).padding(8).scrollContentBackground(.hidden).background(KeepsStyle.background, in: RoundedRectangle(cornerRadius: 12)).accessibilityLabel("Link or text to save").accessibilityIdentifier("keeps.capture.text")
                        PasteButton(payloadType: String.self) { values in text = String(values.joined(separator: "\n").prefix(20_000)) }.labelStyle(.titleAndIcon)
                    }.padding(18).cardStyle()
                    Button {
                        draft = CaptureParser.draft(from: text)
                    } label: { Text(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Write an idea" : "Review this save").frame(maxWidth: .infinity) }.buttonStyle(KeepsPrimaryButton()).accessibilityIdentifier("keeps.capture.review")
                    PhotosPicker(selection: $photo, matching: .images) { Label(photoLoading ? "Preparing photo…" : "Choose a photo", systemImage: "photo").frame(maxWidth: .infinity) }.buttonStyle(KeepsSecondaryButton()).disabled(photoLoading).accessibilityIdentifier("keeps.capture.photo")
                    Text("Keeps extracts links and hashtags from the text you provide. It does not read private accounts or automatically understand a video. Review details before saving.").font(.footnote).foregroundStyle(.secondary)
                }.padding(22)
            }.background(KeepsStyle.background)
            .navigationTitle("Save an idea").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .sheet(item: $draft) { item in IdeaEditorView(item: item, isNew: true, didSave: { dismiss() }) }
            .onChange(of: photo) { _, newValue in
                guard let newValue else { return }
                photoLoading = true
                Task {
                    defer { photoLoading = false; photo = nil }
                    do {
                        guard let data = try await newValue.loadTransferable(type: Data.self), data.count <= 40_000_000, let image = UIImage(data: data) else { throw KeepsError.message("This photo could not be opened or is larger than 40 MB. Choose another image.") }
                        let prepared = resizePhoto(image)
                        guard let compressed = prepared.jpegData(compressionQuality: 0.78), compressed.count <= 4_000_000 else { throw KeepsError.message("This photo is too large. Choose a smaller image.") }
                        var idea = CaptureParser.draft(from: text)
                        idea.photoData = compressed
                        draft = idea
                    } catch { store.error = error.localizedDescription }
                }
            }
        }
    }
    private func resizePhoto(_ image: UIImage) -> UIImage {
        let maxDimension: CGFloat = 1_600
        let ratio = min(1, maxDimension / max(image.size.width, image.size.height))
        let size = CGSize(width: max(1, image.size.width * ratio), height: max(1, image.size.height * ratio))
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }
}

struct IdeaEditorView: View {
    @EnvironmentObject private var store: KeepsStore
    @Environment(\.dismiss) private var dismiss
    @State var item: SavedIdea
    let isNew: Bool
    var didSave: (() -> Void)? = nil
    @State private var price = ""
    @State private var walk = ""
    @State private var tags = ""
    @State private var editorError: String?
    @State private var loaded = false
    var body: some View {
        NavigationStack {
            Form {
                if store.isDemo { Section { Label("Saving in the separate demo library", systemImage: "sparkle").font(.subheadline) } }
                Section {
                    TextField("Give it a title", text: $item.title, axis: .vertical).accessibilityIdentifier("keeps.editor.title")
                    Picker("Category", selection: $item.category) { ForEach(KeepsCategory.allCases) { category in Label(category.rawValue, systemImage: category.symbol).tag(category) } }
                    TextField("https://…", text: $item.sourceURL).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityLabel("Original link")
                } header: { Text("The idea") } footer: { Text("A pasted link starts with its website name. Edit the title to make it useful; page content is not automatically fetched.") }
                if item.photoData != nil {
                    Section("Photo") { IdeaThumbnail(item: item, large: true); Button("Remove photo", role: .destructive) { item.photoData = nil } }
                }
                Section {
                    TextField("e.g. quiet, weekend, vegetarian", text: $tags, axis: .vertical).accessibilityLabel("Tags separated by commas")
                    HStack { Text("Estimated price ($)"); Spacer(); TextField("Unknown", text: $price).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(width: 105).accessibilityIdentifier("keeps.editor.price") }
                    HStack { Text("Walk from campus (min)"); Spacer(); TextField("Unknown", text: $walk).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(width: 105) }
                    TextField("What made you save it?", text: $item.notes, axis: .vertical).lineLimit(3...8).accessibilityLabel("Notes")
                } header: { Text("Details you know") } footer: { Text("Estimates are yours, not verified prices or live directions. Leave unknown values blank. Hard filters exclude ideas with unknown values.") }
                if !item.originalText.isEmpty { Section("Original text · preserved") { Text(item.originalText).font(.subheadline).foregroundStyle(.secondary).textSelection(.enabled) } }
                Section { Toggle("Favorite", isOn: $item.favorite) }
            }
            .scrollContentBackground(.hidden).background(KeepsStyle.background)
            .navigationTitle(isNew ? "Review your save" : "Edit idea").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.fontWeight(.semibold).accessibilityIdentifier("keeps.save") }
            }
            .onAppear { guard !loaded else { return }; price = item.estimatedPrice.map(String.init) ?? ""; walk = item.walkMinutes.map(String.init) ?? ""; tags = item.tags.joined(separator: ", "); loaded = true }
            .alert("Check your idea", isPresented: Binding(get: { editorError != nil }, set: { if !$0 { editorError = nil } })) { Button("OK", role: .cancel) {} } message: { Text(editorError ?? "") }
        }
    }
    private func save() {
        item.title = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
        item.sourceURL = item.sourceURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !item.title.isEmpty, item.title.count <= 300 else { editorError = "Add a title of 1–300 characters."; return }
        if !item.sourceURL.isEmpty {
            if !item.sourceURL.contains("://") { item.sourceURL = "https://" + item.sourceURL }
            guard item.externalURL != nil else { editorError = "Use a valid http or https link, or leave it blank."; return }
        }
        let priceValue = price.trimmingCharacters(in: .whitespacesAndNewlines)
        let walkValue = walk.trimmingCharacters(in: .whitespacesAndNewlines)
        guard priceValue.isEmpty || (Int(priceValue).map { (0...100_000).contains($0) } ?? false) else { editorError = "Enter a whole-dollar price from 0 to 100,000, or leave it blank."; return }
        guard walkValue.isEmpty || (Int(walkValue).map { (0...1_440).contains($0) } ?? false) else { editorError = "Enter a walking time from 0 to 1,440 minutes, or leave it blank."; return }
        item.estimatedPrice = Int(priceValue); item.walkMinutes = Int(walkValue)
        item.tags = Array(Set(tags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }.filter { !$0.isEmpty })).sorted()
        do { _ = try KeepsBackup.decode(JSONEncoder().encode(KeepsBackup(items: [item], decisions: []))) }
        catch { editorError = "Some text is too long. Use up to 40 tags of 80 characters each, 20,000 characters of notes, and a 4,000-character link."; return }
        if store.save(item) { dismiss(); didSave?() }
    }
}

struct IdeaDetailView: View {
    @EnvironmentObject private var store: KeepsStore
    @Environment(\.dismiss) private var dismiss
    let ideaID: UUID
    @State private var editing: SavedIdea?
    @State private var showDelete = false
    @State private var showReminder = false
    private var item: SavedIdea? { store.items.first { $0.id == ideaID } }
    var body: some View {
        Group {
            if let item {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        DemoBanner()
                        IdeaThumbnail(item: item, large: true)
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 8) { Text(item.category.rawValue.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(KeepsStyle.sage); Text(item.title).font(.largeTitle.bold()) }
                            Spacer()
                            Button { store.toggleFavorite(item) } label: { Image(systemName: item.favorite ? "star.fill" : "star").font(.title2).padding(10) }.accessibilityLabel(item.favorite ? "Remove favorite" : "Favorite idea").accessibilityIdentifier("keeps.detail.favorite")
                        }
                        if !item.tags.isEmpty { TagPills(tags: item.tags) }
                        HStack(spacing: 20) {
                            Label(item.estimatedPrice.map { "$\($0) estimated" } ?? "Price unknown", systemImage: "dollarsign.circle")
                            if item.category != .trip { Label(item.walkMinutes.map { "\($0) min walk" } ?? "Walk unknown", systemImage: "figure.walk") }
                        }.font(.subheadline).foregroundStyle(.secondary)
                        if !item.notes.isEmpty { Text(item.notes).textSelection(.enabled) }
                        if let url = item.externalURL { Link(destination: url) { Label("Open original · \(item.sourceHost ?? "link")", systemImage: "arrow.up.right.square").frame(maxWidth: .infinity) }.buttonStyle(KeepsPrimaryButton()).accessibilityIdentifier("keeps.detail.open") }
                        Button { showReminder = true } label: { Label(item.reminderAt.map { $0 > Date() ? "Reminder: \($0.formatted(date: .abbreviated, time: .shortened))" : "Set another reminder" } ?? "Remind me later", systemImage: "bell").frame(maxWidth: .infinity) }.buttonStyle(KeepsSecondaryButton()).accessibilityIdentifier("keeps.detail.reminder")
                        if let reminder = item.reminderAt, reminder > Date() { Button("Cancel reminder", role: .destructive) { store.cancelReminder(item) }.font(.subheadline) }
                        if !item.originalText.isEmpty { VStack(alignment: .leading, spacing: 10) { Label("Original text", systemImage: "text.quote").font(.headline); Text(item.originalText).font(.subheadline).foregroundStyle(.secondary).textSelection(.enabled) }.padding(18).cardStyle() }
                        Text("Saved \(item.createdAt.formatted(date: .long, time: .omitted)). Only in your \(store.isDemo ? "demo" : "personal") library.").font(.footnote).foregroundStyle(.secondary)
                        Button(item.archived ? "Restore to library" : "Archive idea") { store.toggleArchive(item) }.accessibilityIdentifier("keeps.detail.archive")
                        Button("Delete idea", role: .destructive) { showDelete = true }.accessibilityIdentifier("keeps.detail.delete")
                    }.padding(22)
                }.background(KeepsStyle.background)
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Edit") { editing = item }.accessibilityIdentifier("keeps.detail.edit") } }
                .confirmationDialog("Delete “\(item.title)” permanently?", isPresented: $showDelete, titleVisibility: .visible) { Button("Delete idea", role: .destructive) { store.delete(item); dismiss() }; Button("Cancel", role: .cancel) {} } message: { Text("This removes the idea and its photo from this library. Exported backups are unaffected.") }
                .sheet(isPresented: $showReminder) { ReminderView(item: item) }
            } else { ContentUnavailableView("Idea no longer available", systemImage: "bookmark.slash", description: Text("It may have been removed from this library.")) }
        }.navigationTitle("Your idea").navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) { item in IdeaEditorView(item: item, isNew: false) }
    }
}

struct ReminderView: View {
    @EnvironmentObject private var store: KeepsStore
    @Environment(\.dismiss) private var dismiss
    let item: SavedIdea
    @State private var date = Date().addingTimeInterval(3_600)
    @State private var saving = false
    var body: some View {
        NavigationStack {
            Form {
                Section { Text(item.title).font(.headline); DatePicker("Remind me", selection: $date, in: Date()...) }
                Section { Text("Keeps asks for notification permission when you save. The reminder appears on this device; your library is never uploaded.").font(.subheadline).foregroundStyle(.secondary) }
                Button(saving ? "Scheduling…" : "Set reminder") {
                    saving = true
                    Task { if await store.scheduleReminder(for: item, at: date) { dismiss() }; saving = false }
                }.disabled(saving).accessibilityIdentifier("keeps.reminder.save")
            }.scrollContentBackground(.hidden).background(KeepsStyle.background)
            .navigationTitle("Remember this").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }.presentationDetents([.medium, .large])
    }
}

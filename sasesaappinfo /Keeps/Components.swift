import SwiftUI

enum KeepsStyle {
    static let background = Color(red: 247/255, green: 245/255, blue: 240/255)
    static let ink = Color(red: 32/255, green: 37/255, blue: 31/255)
    static let sage = Color(red: 77/255, green: 102/255, blue: 88/255)
    static let paleSage = Color(red: 230/255, green: 236/255, blue: 228/255)
}

extension View {
    func cardStyle() -> some View { background(.white, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(KeepsStyle.ink.opacity(0.07), lineWidth: 1)) }
}
struct KeepsPrimaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.headline).padding(.vertical, 16).padding(.horizontal, 18).foregroundStyle(.white).background(KeepsStyle.sage.opacity(configuration.isPressed ? 0.8 : 1), in: RoundedRectangle(cornerRadius: 14))
    }
}
struct KeepsSecondaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.headline).padding(.vertical, 15).padding(.horizontal, 18).foregroundStyle(KeepsStyle.sage).background(KeepsStyle.paleSage.opacity(configuration.isPressed ? 0.6 : 1), in: RoundedRectangle(cornerRadius: 14))
    }
}
struct FeatureLine: View {
    let symbol: String
    let title: String
    let subtitle: String
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol).font(.title3).foregroundStyle(KeepsStyle.sage).frame(width: 24)
            VStack(alignment: .leading, spacing: 5) { Text(title).font(.headline); Text(subtitle).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true) }
        }
    }
}
struct DemoBanner: View {
    @EnvironmentObject private var store: KeepsStore
    var body: some View {
        if store.isDemo {
            Label("DEMO · Fictional sample ideas", systemImage: "sparkle").font(.caption.weight(.semibold)).foregroundStyle(KeepsStyle.sage).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 18).padding(.vertical, 10).background(KeepsStyle.paleSage)
        }
    }
}
struct TagPills: View {
    let tags: [String]
    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) { ForEach(Array(tags.prefix(3).enumerated()), id: \.offset) { _, tag in Text(tag).font(.caption).padding(.horizontal, 9).padding(.vertical, 5).background(KeepsStyle.background, in: Capsule()).lineLimit(1) } }
            Text(tags.prefix(3).joined(separator: " · ")).font(.caption).foregroundStyle(.secondary).lineLimit(2)
        }
    }
}
struct IdeaThumbnail: View {
    let item: SavedIdea
    var large = false
    var body: some View {
        Group {
            if let data = item.photoData, let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                ZStack {
                    KeepsStyle.paleSage
                    Image(systemName: item.category.symbol).font(.system(size: large ? 42 : 24, weight: .light)).foregroundStyle(KeepsStyle.sage)
                }
            }
        }.frame(width: large ? nil : 62, height: large ? 170 : 62).clipped().clipShape(RoundedRectangle(cornerRadius: large ? 16 : 12))
        .accessibilityHidden(true)
    }
}
struct IdeaRow: View {
    let item: SavedIdea
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            IdeaThumbnail(item: item)
            VStack(alignment: .leading, spacing: 6) {
                HStack { Text(item.title).font(.headline).foregroundStyle(KeepsStyle.ink).lineLimit(2); if item.favorite { Image(systemName: "star.fill").font(.caption).foregroundStyle(KeepsStyle.sage) } }
                Text([item.category.rawValue, item.estimatedPrice.map { "$\($0)" }, item.walkMinutes.map { "\($0) min walk" }].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
                if !item.tags.isEmpty { TagPills(tags: item.tags) }
            }.frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary).padding(.top, 4)
        }.padding(16).cardStyle()
        .contentShape(Rectangle())
    }
}

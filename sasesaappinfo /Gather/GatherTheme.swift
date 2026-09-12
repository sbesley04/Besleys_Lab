import SwiftUI

enum GTheme {
    static let background = Color(red: 247/255, green: 245/255, blue: 240/255)
    static let ink = Color(red: 32/255, green: 37/255, blue: 31/255)
    static let sage = Color(red: 77/255, green: 102/255, blue: 88/255)
    static let muted = Color(red: 104/255, green: 110/255, blue: 102/255)
    static let line = Color(red: 222/255, green: 225/255, blue: 215/255)
}

struct GPrimaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.headline).frame(maxWidth: .infinity).padding(.vertical, 15)
            .foregroundStyle(.white).background(GTheme.sage.opacity(configuration.isPressed ? 0.7 : 1), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct GSecondaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, 13)
            .foregroundStyle(GTheme.ink).background(configuration.isPressed ? GTheme.line : .white, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(GTheme.line, lineWidth: 1))
    }
}

struct GCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content.padding(18).frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(GTheme.line.opacity(0.7), lineWidth: 1))
    }
}

struct GTag: View {
    let title: String
    var symbol: String? = nil
    var body: some View {
        HStack(spacing: 5) {
            if let symbol { Image(systemName: symbol) }
            Text(title)
        }.font(.caption.weight(.semibold)).foregroundStyle(GTheme.sage)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(GTheme.sage.opacity(0.08), in: Capsule())
    }
}

struct GDemoBanner: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "sparkles")
            Text("Demo · sample friends, places & votes").font(.caption.weight(.medium))
            Spacer(minLength: 0)
        }.foregroundStyle(GTheme.sage).padding(12)
            .background(GTheme.sage.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            .accessibilityIdentifier("demo.banner")
    }
}

struct GEmpty: View {
    var symbol: String
    var title: String
    var detail: String
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: symbol).font(.system(size: 35, weight: .light)).foregroundStyle(GTheme.sage)
            Text(title).font(.title2.bold())
            Text(detail).font(.subheadline).foregroundStyle(GTheme.muted).fixedSize(horizontal: false, vertical: true)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 25)
    }
}

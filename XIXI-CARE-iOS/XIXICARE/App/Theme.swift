import SwiftUI

enum CareTheme {
    static let sage = Color(red: 0.50, green: 0.63, blue: 0.55)
    static let sageSoft = Color(red: 0.93, green: 0.96, blue: 0.94)
    static let peach = Color(red: 0.87, green: 0.62, blue: 0.46)
    static let peachSoft = Color(red: 0.99, green: 0.91, blue: 0.85)
    static let ink = Color(red: 0.14, green: 0.13, blue: 0.12)
    static let secondary = Color(red: 0.52, green: 0.49, blue: 0.45)
    static let line = Color(red: 0.91, green: 0.89, blue: 0.86)
    static let canvas = Color(red: 0.985, green: 0.98, blue: 0.97)
    static let card = Color(uiColor: .systemBackground)
    static let control = Color(red: 0.975, green: 0.965, blue: 0.95)
}

struct CareCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .background(CareTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(CareTheme.line, lineWidth: 1)
            }
    }
}

extension View {
    func careCard() -> some View { modifier(CareCardModifier()) }
}

struct CarePill: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(selected ? Color.white : Color.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(selected ? CareTheme.sage : Color(uiColor: .tertiarySystemFill))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

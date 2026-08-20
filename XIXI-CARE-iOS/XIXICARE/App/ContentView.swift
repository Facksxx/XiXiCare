import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selection = 0
    @State private var showSettings = false
    @State private var showSounds = false

    init() {
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        _selection = State(initialValue: arguments.contains("--stats") ? 3 : arguments.contains("--timeline") ? 1 : 0)
        _showSounds = State(initialValue: arguments.contains("--sounds"))
        #endif
    }

    var body: some View {
        VStack(spacing: 0) {
            ProfileHeader(showSettings: $showSettings, showSounds: $showSounds)
            TabView(selection: $selection) {
                DashboardView().tag(0)
                TimelineView().tag(1)
                GuideView().tag(2)
                StatsView().tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            HStack {
                BottomItem(title: "记录大盘", symbol: "calendar", selectedSymbol: "calendar", selected: selection == 0) { selection = 0 }
                BottomItem(title: "时间轴", symbol: "sparkles", selectedSymbol: "sparkles", selected: selection == 1) { selection = 1 }
                BottomItem(title: "喂养指南", symbol: "book", selectedSymbol: "book.fill", selected: selection == 2) { selection = 2 }
                BottomItem(title: "成长统计", symbol: "chart.bar", selectedSymbol: "chart.bar.fill", selected: selection == 3) { selection = 3 }
            }
            .frame(height: 62)
            .padding(.horizontal, 6)
            .background(CareTheme.card)
            .overlay(alignment: .top) { Divider() }
        }
        .background(CareTheme.canvas)
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(isPresented: $showSounds) { SoundPlayerView() }
    }
}

private struct ProfileHeader: View {
    @EnvironmentObject private var store: AppStore
    @Binding var showSettings: Bool
    @Binding var showSounds: Bool

    var body: some View {
        HStack(spacing: 10) {
            Text(String(store.baby.name.prefix(1)))
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 43, height: 43)
                .background(Color(red: 0.68, green: 0.57, blue: 0.43))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(store.baby.name).font(.system(size: 16, weight: .bold))
                Text("\(store.baby.birthday.formatted(date: .numeric, time: .omitted))（\(store.baby.ageText)）")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            HeaderButton(symbol: "gearshape") { showSettings = true }
            HeaderButton(symbol: "music.note") { showSounds = true }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 8)
        .frame(height: 73)
        .background(CareTheme.card)
        .overlay(alignment: .bottom) { Divider() }
    }
}

private struct HeaderButton: View {
    let symbol: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .regular))
                .frame(width: 36, height: 36)
                .background(CareTheme.card)
                .clipShape(Circle())
                .overlay { Circle().stroke(CareTheme.line) }
        }
        .buttonStyle(.plain)
    }
}

private struct BottomItem: View {
    let title: String
    let symbol: String
    let selectedSymbol: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: selected ? selectedSymbol : symbol)
                    .font(.system(size: 19, weight: .medium))
                    .scaleEffect(selected ? 1.05 : 1)
                    .animation(.easeOut(duration: 0.18), value: selected)
                Text(title).font(.system(size: 10, weight: selected ? .semibold : .regular))
            }
            .foregroundStyle(selected ? CareTheme.sage : Color.secondary)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

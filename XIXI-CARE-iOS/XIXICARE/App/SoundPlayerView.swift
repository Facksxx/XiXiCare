import SwiftUI
import AVFoundation

@MainActor
final class SoundPlayer: NSObject, ObservableObject, AVAudioPlayerDelegate {
    enum LoopMode: String, CaseIterable, Identifiable {
        case single = "单曲循环"
        case list = "列表循环"
        case once = "播放一次"
        var id: String { rawValue }
    }

    @Published var current: SoundTrack?
    @Published var playing = false
    @Published var loopMode: LoopMode = .single
    @Published var category = "环境音"
    @Published var remaining: TimeInterval?
    @Published var currentTime: TimeInterval = 0
    @Published var duration: TimeInterval = 0
    @Published var volume: Float = 0.8 { didSet { player?.volume = volume } }

    let tracks = [
        SoundTrack(id: "rain", title: "轻柔雨声", category: "环境音", resource: "gentle-rain", fileExtension: "mp3", symbol: "cloud.rain"),
        SoundTrack(id: "waves", title: "舒缓海浪", category: "环境音", resource: "sea-waves", fileExtension: "mp3", symbol: "water.waves"),
        SoundTrack(id: "stream", title: "森林溪流", category: "环境音", resource: "forest-stream", fileExtension: "mp3", symbol: "leaf"),
        SoundTrack(id: "wind", title: "温柔晚风", category: "环境音", resource: "gentle-wind", fileExtension: "mp3", symbol: "wind"),
        SoundTrack(id: "birds", title: "林间鸟鸣", category: "环境音", resource: "forest-birds", fileExtension: "mp3", symbol: "bird"),
        SoundTrack(id: "lullaby", title: "宝宝摇篮曲", category: "纯音乐", resource: "baby-lullaby", fileExtension: "mp3", symbol: "moon.stars"),
        SoundTrack(id: "love", title: "永恒的爱", category: "纯音乐", resource: "forever-love", fileExtension: "mp3", symbol: "heart"),
        SoundTrack(id: "christmas", title: "冬夜摇篮曲", category: "纯音乐", resource: "christmas-lullaby", fileExtension: "mp3", symbol: "snowflake"),
        SoundTrack(id: "moon", title: "月光轻梦", category: "纯音乐", resource: "moon-lullaby", fileExtension: "mp3", symbol: "moon"),
        SoundTrack(id: "eyes", title: "闭上眼睛", category: "纯音乐", resource: "close-your-eyes", fileExtension: "mp3", symbol: "sparkles")
    ]

    private var player: AVAudioPlayer?
    private var timer: Timer?
    private var progressTimer: Timer?

    override init() {
        super.init()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    func play(_ track: SoundTrack) {
        guard let url = Bundle.main.url(forResource: track.resource, withExtension: track.fileExtension) else { return }
        do {
            player = try AVAudioPlayer(contentsOf: url)
            player?.delegate = self
            current = track
            player?.numberOfLoops = loopMode == .single ? -1 : 0
            player?.volume = volume
            player?.play()
            playing = true
            duration = player?.duration ?? 0
            currentTime = 0
            startProgressTimer()
        } catch {
            playing = false
        }
    }

    func toggle() {
        guard let player else { return }
        if player.isPlaying { player.pause(); playing = false } else { player.play(); playing = true }
        startProgressTimer()
    }

    func stop() {
        player?.stop()
        playing = false
        current = nil
        remaining = nil
        timer?.invalidate()
        progressTimer?.invalidate()
        currentTime = 0
        duration = 0
    }

    func setSleepTimer(minutes: Int?) {
        timer?.invalidate()
        guard let minutes else { remaining = nil; return }
        remaining = TimeInterval(minutes * 60)
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
            Task { @MainActor in
                guard let self, let remaining = self.remaining else { timer.invalidate(); return }
                if remaining <= 1 { self.stop() } else { self.remaining = remaining - 1 }
            }
        }
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        guard loopMode == .list, let current, let index = filtered.firstIndex(of: current), !filtered.isEmpty else {
            playing = false
            return
        }
        play(filtered[(index + 1) % filtered.count])
    }

    func adjacent(_ direction: Int) {
        guard !filtered.isEmpty else { return }
        let index = current.flatMap { filtered.firstIndex(of: $0) } ?? 0
        play(filtered[(index + direction + filtered.count) % filtered.count])
    }

    func seek(to value: TimeInterval) {
        player?.currentTime = value
        currentTime = value
    }

    func applyLoopMode() {
        player?.numberOfLoops = loopMode == .single ? -1 : 0
    }

    private func startProgressTimer() {
        progressTimer?.invalidate()
        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let player = self.player else { return }
                self.currentTime = player.currentTime
                self.duration = player.duration
                self.playing = player.isPlaying
            }
        }
    }

    var filtered: [SoundTrack] { tracks.filter { $0.category == category } }
}

struct SoundPlayerView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var player = SoundPlayer()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                HStack(spacing: 8) {
                    CarePill(title: "环境音", selected: player.category == "环境音") { player.category = "环境音" }
                    CarePill(title: "纯音乐", selected: player.category == "纯音乐") { player.category = "纯音乐" }
                }
                .padding(.horizontal, 14)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(player.filtered) { track in
                    Button { player.play(track) } label: {
                        HStack(spacing: 9) {
                            Image(systemName: track.symbol)
                                .font(.system(size: 17))
                                .foregroundStyle(CareTheme.sage)
                                .frame(width: 30, height: 30)
                            Text(track.title).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                            Spacer()
                            if player.current == track && player.playing {
                                Image(systemName: "speaker.wave.2.fill").font(.system(size: 10)).foregroundStyle(CareTheme.sage)
                            }
                        }
                        .padding(9).background(player.current == track ? CareTheme.sageSoft : CareTheme.card)
                        .clipShape(RoundedRectangle(cornerRadius: 10)).overlay { RoundedRectangle(cornerRadius: 10).stroke(player.current == track ? CareTheme.sage : CareTheme.line) }
                    }
                    .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)

                if let current = player.current {
                    VStack(spacing: 12) {
                        HStack(spacing: 10) {
                            Image(systemName: current.symbol).font(.system(size: 20)).foregroundStyle(CareTheme.sage).frame(width: 42, height: 42).background(CareTheme.sageSoft).clipShape(RoundedRectangle(cornerRadius: 10))
                            VStack(alignment: .leading, spacing: 2) { Text("正在播放").font(.system(size: 9)).foregroundStyle(.secondary); Text(current.title).font(.system(size: 14, weight: .bold)) }
                            Spacer()
                            Label(player.loopMode.rawValue, systemImage: "repeat").font(.system(size: 9)).foregroundStyle(.secondary)
                        }
                        HStack(spacing: 8) {
                            Text(clock(player.currentTime)).font(.system(size: 9)).monospacedDigit()
                            Slider(value: Binding(get: { player.currentTime }, set: { player.seek(to: $0) }), in: 0...max(1, player.duration)).tint(CareTheme.sage)
                            Text(clock(player.duration)).font(.system(size: 9)).monospacedDigit()
                        }
                        HStack(spacing: 28) {
                            Button { player.adjacent(-1) } label: { Image(systemName: "backward.end.fill").font(.title3) }
                            Button { player.toggle() } label: {
                                Image(systemName: player.playing ? "pause.fill" : "play.fill")
                                    .font(.title2).foregroundStyle(.white).frame(width: 58, height: 58)
                                    .background(CareTheme.sage).clipShape(Circle())
                            }
                            Button { player.adjacent(1) } label: { Image(systemName: "forward.end.fill").font(.title3) }
                        }
                        HStack(spacing: 8) {
                            Image(systemName: "speaker.wave.2").foregroundStyle(.secondary)
                            Slider(value: $player.volume, in: 0...1).tint(CareTheme.sage)
                            Text("\(Int(player.volume * 100))%").font(.system(size: 10)).frame(width: 34)
                        }
                        VStack(alignment: .leading, spacing: 7) {
                            Label("循环模式", systemImage: "repeat").font(.system(size: 11, weight: .semibold))
                            Picker("循环模式", selection: $player.loopMode) {
                            ForEach(SoundPlayer.LoopMode.allCases) { mode in Text(mode.rawValue).tag(mode) }
                            }
                            .pickerStyle(.segmented).onChange(of: player.loopMode) { _ in player.applyLoopMode() }
                        }
                        VStack(alignment: .leading, spacing: 7) {
                            Label(player.remaining.map { "\(clock($0)) 后停止" } ?? "睡眠定时", systemImage: "timer").font(.system(size: 11, weight: .semibold))
                            HStack(spacing: 6) {
                                TimerButton(title: "关闭") { player.setSleepTimer(minutes: nil) }
                                ForEach([15, 30, 60], id: \.self) { value in TimerButton(title: "\(value)分") { player.setSleepTimer(minutes: value) } }
                            }
                        }
                    }
                    .padding(14).background(CareTheme.card).clipShape(RoundedRectangle(cornerRadius: 12)).overlay { RoundedRectangle(cornerRadius: 12).stroke(CareTheme.line) }
                    .padding(.horizontal, 14)
                }
                }
                .padding(.vertical, 10)
            }
            .background(CareTheme.canvas)
            .navigationTitle("睡眠声音")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                }
            }
        }
    }

    private func clock(_ value: TimeInterval) -> String {
        let seconds = Int(value.isFinite ? value : 0)
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

private struct TimerButton: View {
    let title: String
    let action: () -> Void
    var body: some View { Button(title, action: action).font(.system(size: 10, weight: .semibold)).frame(maxWidth: .infinity).frame(height: 30).background(CareTheme.control).clipShape(RoundedRectangle(cornerRadius: 8)).buttonStyle(.plain) }
}

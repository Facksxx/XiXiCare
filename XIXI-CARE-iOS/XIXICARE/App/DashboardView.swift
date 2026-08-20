import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var store: AppStore
    @State private var type: CareRecordType = .feeding
    @State private var date = Date()
    @State private var showDatePicker = false
    @State private var message: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                HStack(spacing: 7) {
                    ForEach(CareRecordType.allCases) { item in
                        RecordTab(item: item, selected: item == type) { type = item }
                    }
                }
                Divider().padding(.vertical, 10)
                Button { showDatePicker = true } label: {
                    Text(date.formatted(.dateTime.year().month(.twoDigits).day(.twoDigits).hour(.twoDigits(amPM: .omitted)).minute(.twoDigits)))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(CareTheme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .frame(height: 43)
                        .background(CareTheme.control)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay { RoundedRectangle(cornerRadius: 10).stroke(CareTheme.line) }
                }
                .buttonStyle(.plain)

                Group {
                    switch type {
                    case .feeding: FeedingForm(date: date, onSave: save)
                    case .sleep: SleepForm(date: date, onSave: save)
                    case .diaper: DiaperForm(date: date, onSave: save)
                    case .body: BodyForm(date: date, onSave: save)
                    }
                }
                .padding(.top, 10)
            }
            .padding(12)
            .background(CareTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay { RoundedRectangle(cornerRadius: 12).stroke(CareTheme.line) }
            .padding(.horizontal, 14)
            .padding(.top, 12)
            .padding(.bottom, 18)
        }
        .background(CareTheme.canvas)
        .sheet(isPresented: $showDatePicker) {
            NavigationStack {
                DatePicker("开始时间", selection: $date, displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.graphical)
                    .padding()
                    .navigationTitle("选择开始时间")
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { showDatePicker = false } } }
            }
            .presentationDetents([.medium])
        }
        .overlay(alignment: .top) {
            if let message {
                Text(message).font(.caption.weight(.semibold)).padding(.horizontal, 13).padding(.vertical, 7)
                    .background(.thinMaterial).clipShape(Capsule()).padding(.top, 6)
            }
        }
    }

    private func save(_ record: CareRecord) {
        store.add(record)
        withAnimation { message = "记录已保存" }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.3) { withAnimation { message = nil } }
    }
}

private struct RecordTab: View {
    let item: CareRecordType
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(item.rawValue, systemImage: item.symbol)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(selected ? CareTheme.peach : CareTheme.secondary)
                .frame(maxWidth: .infinity).frame(height: 37)
                .background(selected ? CareTheme.peachSoft : CareTheme.control)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay { RoundedRectangle(cornerRadius: 10).stroke(selected ? CareTheme.peach : CareTheme.line) }
        }
        .buttonStyle(.plain)
    }
}

private struct FeedingForm: View {
    let date: Date
    let onSave: (CareRecord) -> Void
    @AppStorage("xixi.feeding.mode") private var mode = "奶瓶喂养"
    @AppStorage("xixi.feeding.milk") private var milk = "配方奶"
    @AppStorage("xixi.feeding.amount") private var amount = 150
    @State private var left = 10
    @State private var right = 10
    @State private var foodName = ""
    @State private var foodAmount = ""
    @State private var reaction = "无过敏"
    private let presets = [60, 90, 120, 150, 180, 210, 240]

    var body: some View {
        VStack(spacing: 9) {
            HStack(spacing: 7) {
                ModeButton("母乳亲喂", selected: mode == "母乳亲喂") { mode = "母乳亲喂" }
                ModeButton("奶瓶喂养", selected: mode == "奶瓶喂养") { mode = "奶瓶喂养" }
                ModeButton("添加辅食", selected: mode == "添加辅食") { mode = "添加辅食" }
            }
            if mode == "奶瓶喂养" {
                HStack(spacing: 7) {
                    ModeButton("配方奶", selected: milk == "配方奶") { milk = "配方奶" }
                    ModeButton("母乳", selected: milk == "母乳") { milk = "母乳" }
                }
                VStack(alignment: .leading, spacing: 7) {
                    Text("喂奶量").font(.system(size: 12, weight: .bold))
                    HStack {
                        SmallCircle(symbol: "minus") { amount = max(10, amount - 10) }
                        Spacer()
                        HStack(alignment: .firstTextBaseline, spacing: 3) {
                            Text("\(amount)").font(.system(size: 24, weight: .bold))
                            Text("ml").font(.system(size: 12, weight: .semibold)).foregroundStyle(.secondary)
                        }
                        Spacer()
                        SmallCircle(symbol: "plus") { amount = min(400, amount + 10) }
                    }
                    .padding(.horizontal, 10).frame(height: 53).background(CareTheme.control)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 6), spacing: 5) {
                    ForEach(presets, id: \.self) { value in
                        Button { amount = value } label: {
                            Text("\(value) ml").font(.system(size: 9, weight: .bold))
                                .foregroundStyle(amount == value ? .white : CareTheme.ink)
                                .frame(maxWidth: .infinity).frame(height: 23)
                                .background(amount == value ? CareTheme.sage : CareTheme.card)
                                .clipShape(Capsule()).overlay { Capsule().stroke(amount == value ? CareTheme.sage : CareTheme.line) }
                        }.buttonStyle(.plain)
                    }
                }
            } else if mode == "母乳亲喂" {
                HStack(spacing: 8) {
                    MinuteControl(title: "左侧", value: $left)
                    MinuteControl(title: "右侧", value: $right)
                }
            } else {
                VStack(spacing: 9) {
                    LabeledField(title: "食物名称", placeholder: "如：胡萝卜泥", text: $foodName)
                    HStack(spacing: 8) {
                        LabeledField(title: "摄入量", placeholder: "如：50g", text: $foodAmount)
                        VStack(alignment: .leading, spacing: 5) {
                            Text("过敏反应").font(.system(size: 11, weight: .bold))
                            Picker("过敏反应", selection: $reaction) {
                                ForEach(["无过敏", "轻度", "严重"], id: \.self) { Text($0).tag($0) }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity).frame(height: 42)
                            .background(CareTheme.control).clipShape(RoundedRectangle(cornerRadius: 9))
                        }
                    }
                }
            }
            SaveButton {
                let record: CareRecord
                if mode == "奶瓶喂养" {
                    record = CareRecord(type: .feeding, date: date, title: "瓶喂奶量：\(amount) ml", detail: "奶瓶 · \(milk)", value: Double(amount), unit: "ml", subtype: "奶瓶")
                } else if mode == "母乳亲喂" {
                    record = CareRecord(type: .feeding, date: date, title: "母乳吸吮：左侧 \(left) 分钟 / 右侧 \(right) 分钟", detail: "母乳亲喂", value: Double(left + right), unit: "分钟", subtype: "母乳")
                } else {
                    guard !foodName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                    record = CareRecord(type: .feeding, date: date, title: "辅食：\(foodName)（\(foodAmount.isEmpty ? "未填写摄入量" : foodAmount)）", detail: "过敏反应：\(reaction)", subtype: "辅食")
                }
                onSave(record)
            }
        }
    }
}

private struct ModeButton: View {
    let title: String
    let selected: Bool
    let action: () -> Void
    init(_ title: String, selected: Bool, action: @escaping () -> Void) { self.title = title; self.selected = selected; self.action = action }

    var body: some View {
        Button(action: action) {
            Text(title).font(.system(size: 12, weight: .semibold))
                .foregroundStyle(selected ? CareTheme.peach : CareTheme.secondary)
                .frame(maxWidth: .infinity).frame(height: 36)
                .background(selected ? CareTheme.peachSoft : CareTheme.control)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay { RoundedRectangle(cornerRadius: 10).stroke(selected ? CareTheme.peach : CareTheme.line) }
        }.buttonStyle(.plain)
    }
}

private struct MinuteControl: View {
    let title: String
    @Binding var value: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(title)（分钟）").font(.system(size: 11, weight: .bold))
            HStack {
                SmallCircle(symbol: "minus") { value = max(0, value - 1) }
                Spacer(); Text("\(value)").font(.system(size: 24, weight: .bold)); Spacer()
                SmallCircle(symbol: "plus") { value += 1 }
            }
            .padding(.horizontal, 8).frame(height: 55).background(CareTheme.control).clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }
}

private struct SleepForm: View {
    let date: Date
    let onSave: (CareRecord) -> Void
    @State private var minutes = 30
    @State private var elapsed = 0
    @State private var running = false
    @State private var timer: Timer?

    var body: some View {
        VStack(spacing: 12) {
            Text(String(format: "%02d:%02d:%02d", elapsed / 3600, (elapsed / 60) % 60, elapsed % 60))
                .font(.system(size: 30, weight: .bold, design: .rounded)).monospacedDigit()
            HStack(spacing: 12) {
                SmallCircle(symbol: running ? "pause.fill" : "play.fill") { running ? pause() : start() }
                SmallCircle(symbol: "xmark") { cancel() }
            }
            HStack(spacing: 6) {
                ForEach([5, 30, 60, 120], id: \.self) { value in
                    CarePill(title: "\(value)分钟", selected: minutes == value) { minutes = value }
                }
            }
            SaveButton {
                let final = max(minutes, elapsed / 60)
                guard final >= 5 else { return }
                onSave(CareRecord(type: .sleep, date: date, title: "睡眠时间：\(final) 分钟", detail: "睡眠记录", value: Double(final), unit: "分钟"))
                cancel()
            }
        }
        .onDisappear { timer?.invalidate() }
    }
    private func start() { running = true; timer?.invalidate(); timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in Task { @MainActor in elapsed += 1 } } }
    private func pause() { running = false; timer?.invalidate() }
    private func cancel() { running = false; timer?.invalidate(); elapsed = 0 }
}

private struct DiaperForm: View {
    let date: Date
    let onSave: (CareRecord) -> Void
    @State private var pee = true
    @State private var poop = false
    @State private var color = "黄色"
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 8) {
                CarePill(title: "嘘嘘", selected: pee) { pee.toggle() }
                CarePill(title: "便便", selected: poop) { poop.toggle() }
            }
            if poop {
                VStack(alignment: .leading, spacing: 8) {
                    Text("便便颜色").font(.system(size: 11, weight: .bold))
                    HStack(spacing: 16) {
                        PoopColor(name: "黄色", color: .yellow, selected: color == "黄色") { color = "黄色" }
                        PoopColor(name: "绿色", color: .green, selected: color == "绿色") { color = "绿色" }
                        PoopColor(name: "褐色", color: .brown, selected: color == "褐色") { color = "褐色" }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(11).background(CareTheme.control).clipShape(RoundedRectangle(cornerRadius: 10))
            }
            SaveButton {
                let text = [pee ? "嘘嘘" : nil, poop ? "便便" : nil].compactMap { $0 }.joined(separator: " & ")
                guard !text.isEmpty else { return }
                onSave(CareRecord(type: .diaper, date: date, title: "换尿布：\(text)", detail: poop ? "便便颜色：\(color)" : "尿布记录", subtype: text))
            }
        }
    }
}

private struct LabeledField: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.system(size: 11, weight: .bold))
            TextField(placeholder, text: $text).font(.system(size: 13)).padding(.horizontal, 10).frame(height: 42)
                .background(CareTheme.control).clipShape(RoundedRectangle(cornerRadius: 9))
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct PoopColor: View {
    let name: String
    let color: Color
    let selected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Circle().fill(color).frame(width: 25, height: 25).overlay { if selected { Circle().stroke(CareTheme.ink, lineWidth: 2).padding(-3) } }
                Text(name).font(.system(size: 9)).foregroundStyle(.secondary)
            }
        }.buttonStyle(.plain)
    }
}

private struct BodyForm: View {
    let date: Date
    let onSave: (CareRecord) -> Void
    @State private var metric = "体重"
    @State private var value = 3.6
    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 7) {
                ForEach(["体重", "身高", "体温"], id: \.self) { item in
                    CarePill(title: item, selected: metric == item) {
                        metric = item; value = item == "体重" ? 3.6 : item == "身高" ? 52 : 36.7
                    }
                }
            }
            HStack {
                Text(metric).font(.headline); Spacer()
                TextField("数值", value: $value, format: .number.precision(.fractionLength(1)))
                    .keyboardType(.decimalPad).multilineTextAlignment(.trailing).font(.title3.bold())
                Text(unit).foregroundStyle(.secondary)
            }
            .padding(12).background(CareTheme.control).clipShape(RoundedRectangle(cornerRadius: 10))
            SaveButton {
                onSave(CareRecord(type: .body, date: date, title: "\(metric)：\(value.formatted(.number.precision(.fractionLength(1)))) \(unit)", detail: "体征记录", value: value, unit: unit, subtype: metric))
            }
        }
    }
    private var unit: String { metric == "体重" ? "kg" : metric == "身高" ? "cm" : "°C" }
}

private struct SaveButton: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Label("保存记录", systemImage: "checkmark").font(.system(size: 14, weight: .bold))
                .frame(maxWidth: .infinity).frame(height: 51).foregroundStyle(.white)
                .background(CareTheme.sage).clipShape(RoundedRectangle(cornerRadius: 11))
        }.buttonStyle(.plain)
    }
}

private struct SmallCircle: View {
    let symbol: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 13, weight: .medium))
                .frame(width: 35, height: 35).background(CareTheme.card).clipShape(Circle())
                .overlay { Circle().stroke(CareTheme.line) }
        }.buttonStyle(.plain)
    }
}

import SwiftUI
import Charts

struct StatsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var days = 7

    private var startDate: Date {
        Calendar.current.date(byAdding: .day, value: -(days - 1), to: Calendar.current.startOfDay(for: Date())) ?? Date()
    }
    private var recent: [CareRecord] { store.records.filter { $0.date >= startDate }.sorted { $0.date < $1.date } }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                HStack(spacing: 6) {
                    SummaryCell(title: "今日瓶喂", value: "\(Int(todayValue(.feeding, "奶瓶")))", unit: "ml")
                    SummaryCell(title: "今日睡眠", value: String(format: "%.1f", todayValue(.sleep) / 60), unit: "小时")
                    SummaryCell(title: "今日嘘嘘", value: "\(todayDiaperCount("嘘嘘"))", unit: "次")
                    SummaryCell(title: "今日便便", value: "\(todayDiaperCount("便便"))", unit: "次")
                }
                RangePanel(days: $days, startDate: startDate)

                ChartCard(title: "体重增长", subtitle: "仅显示实际体重记录", symbol: "scalemass", tone: .pink, empty: weightSeries.isEmpty) {
                    Chart(weightSeries) { point in
                        LineMark(x: .value("日期", point.date), y: .value("体重", point.value)).foregroundStyle(.pink).lineStyle(.init(lineWidth: 2.5))
                        PointMark(x: .value("日期", point.date), y: .value("体重", point.value)).foregroundStyle(.white).symbolSize(55)
                        PointMark(x: .value("日期", point.date), y: .value("体重", point.value)).foregroundStyle(.pink).symbolSize(24)
                    }
                    .chartYScale(domain: paddedDomain(weightSeries.map(\.value), minimumSpan: 0.4))
                    .chartYAxis { compactYAxis(unit: "kg", decimals: 1) }
                    .chartXAxis { compactXAxis }
                }

                ChartCard(title: "瓶喂奶量", subtitle: grainText("单位 ml/天"), symbol: "drop.circle", tone: CareTheme.peach, empty: feedingSeries.isEmpty) {
                    Chart(feedingSeries) { point in
                        BarMark(x: .value("日期", point.date, unit: .day), y: .value("奶量", point.value))
                            .foregroundStyle(CareTheme.peach).cornerRadius(5).annotation(position: .top) {
                                Text("\(Int(point.value))").font(.system(size: 9, weight: .bold))
                            }
                    }
                    .chartYScale(domain: 0...max(300, (feedingSeries.map(\.value).max() ?? 0) * 1.25))
                    .chartYAxis { compactYAxis(unit: "ml") }.chartXAxis { compactXAxis }
                }

                ChartCard(title: "睡眠时长", subtitle: grainText("单位 小时/天"), symbol: "waveform.path.ecg", tone: .indigo, empty: sleepSeries.isEmpty) {
                    Chart(sleepSeries) { point in
                        LineMark(x: .value("日期", point.date, unit: .day), y: .value("睡眠", point.value)).foregroundStyle(.indigo).lineStyle(.init(lineWidth: 2.5))
                        PointMark(x: .value("日期", point.date, unit: .day), y: .value("睡眠", point.value)).foregroundStyle(.indigo)
                    }
                    .chartYScale(domain: 0...max(4, (sleepSeries.map(\.value).max() ?? 0) * 1.25))
                    .chartYAxis { compactYAxis(unit: "h", decimals: 1) }.chartXAxis { compactXAxis }
                }

                ChartCard(title: "喂养间隔", subtitle: grainText("单位 小时"), symbol: "clock", tone: CareTheme.sage, empty: intervalSeries.isEmpty) {
                    Chart(intervalSeries) { point in
                        LineMark(x: .value("日期", point.date, unit: .day), y: .value("间隔", point.value)).foregroundStyle(CareTheme.sage).lineStyle(.init(lineWidth: 2.5))
                        PointMark(x: .value("日期", point.date, unit: .day), y: .value("间隔", point.value)).foregroundStyle(CareTheme.sage)
                    }
                    .chartYScale(domain: 0...max(4, (intervalSeries.map(\.value).max() ?? 0) * 1.25))
                    .chartYAxis { compactYAxis(unit: "h", decimals: 1) }.chartXAxis { compactXAxis }
                }

                ChartCard(title: "排泄统计", subtitle: grainText("单位 次/天"), symbol: "heart", tone: CareTheme.peach, empty: diaperSeries.isEmpty) {
                    Chart(diaperSeries) { point in
                        BarMark(x: .value("日期", point.date, unit: .day), y: .value("嘘嘘", point.pee))
                            .foregroundStyle(by: .value("类型", "嘘嘘"))
                        BarMark(x: .value("日期", point.date, unit: .day), y: .value("便便", point.poop))
                            .foregroundStyle(by: .value("类型", "便便"))
                    }
                    .chartForegroundStyleScale(["嘘嘘": CareTheme.sage, "便便": CareTheme.peach])
                    .chartYAxis { compactYAxis(unit: "次") }.chartXAxis { compactXAxis }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
        }
        .background(CareTheme.canvas)
    }

    private var weightSeries: [DailyPoint] {
        recent.filter { $0.type == .body && $0.subtype == "体重" }.compactMap { record in record.value.map { DailyPoint(date: record.date, value: $0) } }
    }
    private var feedingSeries: [DailyPoint] { groupedValues(type: .feeding, subtype: "奶瓶", divisor: 1) }
    private var sleepSeries: [DailyPoint] { groupedValues(type: .sleep, subtype: nil, divisor: 60) }
    private var intervalSeries: [DailyPoint] {
        let feeds = recent.filter { $0.type == .feeding }.sorted { $0.date < $1.date }
        var gaps: [(Date, Double)] = []
        var previous: Date?
        for record in feeds {
            if let previous {
                let minutes = record.date.timeIntervalSince(previous) / 60
                if minutes >= 30 { gaps.append((record.date, minutes / 60)) }
            }
            previous = record.date
        }
        let grouped = Dictionary(grouping: gaps) { Calendar.current.startOfDay(for: $0.0) }
        return grouped.map { DailyPoint(date: $0.key, value: $0.value.map(\.1).reduce(0, +) / Double($0.value.count)) }.sorted { $0.date < $1.date }
    }
    private var diaperSeries: [DiaperPoint] {
        let grouped = Dictionary(grouping: recent.filter { $0.type == .diaper }) { Calendar.current.startOfDay(for: $0.date) }
        return grouped.map { date, items in
            DiaperPoint(date: date, pee: items.filter { $0.subtype?.contains("嘘嘘") == true }.count, poop: items.filter { $0.subtype?.contains("便便") == true }.count)
        }.sorted { $0.date < $1.date }
    }
    private func groupedValues(type: CareRecordType, subtype: String?, divisor: Double) -> [DailyPoint] {
        let grouped = Dictionary(grouping: recent.filter { $0.type == type && (subtype == nil || $0.subtype == subtype) }) { Calendar.current.startOfDay(for: $0.date) }
        return grouped.map { DailyPoint(date: $0.key, value: $0.value.compactMap(\.value).reduce(0, +) / divisor) }.sorted { $0.date < $1.date }
    }
    private func todayValue(_ type: CareRecordType, _ subtype: String? = nil) -> Double {
        store.records.filter { Calendar.current.isDateInToday($0.date) && $0.type == type && (subtype == nil || $0.subtype == subtype) }.compactMap(\.value).reduce(0, +)
    }
    private func todayDiaperCount(_ value: String) -> Int {
        store.records.filter { Calendar.current.isDateInToday($0.date) && $0.type == .diaper && $0.subtype?.contains(value) == true }.count
    }
    private func grainText(_ unit: String) -> String { days == 7 ? "每日，\(unit)" : days == 30 ? "每日，\(unit)" : "按月汇总，\(unit)" }
    private func paddedDomain(_ values: [Double], minimumSpan: Double) -> ClosedRange<Double> {
        guard let low = values.min(), let high = values.max() else { return 0...minimumSpan }
        let span = max(minimumSpan, high - low)
        return max(0, low - span * 0.35)...(high + span * 0.45)
    }
    private var compactXAxis: some AxisContent {
        AxisMarks(values: .automatic(desiredCount: days == 365 ? 5 : 4)) { _ in AxisGridLine().foregroundStyle(.clear); AxisTick().foregroundStyle(.clear); AxisValueLabel(format: .dateTime.month().day()) }
    }
    private func compactYAxis(unit: String, decimals: Int = 0) -> some AxisContent {
        AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
            AxisGridLine(stroke: .init(lineWidth: 0.7, dash: [3, 3])).foregroundStyle(CareTheme.line)
            AxisValueLabel {
                if let number = value.as(Double.self) { Text("\(number.formatted(.number.precision(.fractionLength(decimals))))\(unit)").font(.system(size: 9)) }
            }
        }
    }
}

private struct DailyPoint: Identifiable { let date: Date; let value: Double; var id: Date { date } }
private struct DiaperPoint: Identifiable { let date: Date; let pee: Int; let poop: Int; var id: Date { date } }

private struct SummaryCell: View {
    let title: String; let value: String; let unit: String
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.system(size: 9)).foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 2) { Text(value).font(.system(size: 17, weight: .bold)); Text(unit).font(.system(size: 8)).foregroundStyle(.secondary) }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(8).background(CareTheme.card).clipShape(RoundedRectangle(cornerRadius: 9)).overlay { RoundedRectangle(cornerRadius: 9).stroke(CareTheme.line) }
    }
}

private struct RangePanel: View {
    @Binding var days: Int
    let startDate: Date
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("图表范围").font(.system(size: 11, weight: .bold)).foregroundStyle(.secondary)
            HStack(spacing: 6) {
                ForEach([7, 30, 365], id: \.self) { value in CarePill(title: value == 365 ? "1年" : "\(value)天", selected: days == value) { days = value } }
            }
            Text("\(startDate.formatted(date: .numeric, time: .omitted)) - \(Date().formatted(date: .numeric, time: .omitted)) · 自动\(days == 365 ? "按月" : "每日")汇总")
                .font(.system(size: 9)).foregroundStyle(.secondary)
        }.careCard()
    }
}

private struct ChartCard<Content: View>: View {
    let title: String; let subtitle: String; let symbol: String; let tone: Color; let empty: Bool; let content: Content
    init(title: String, subtitle: String, symbol: String, tone: Color, empty: Bool, @ViewBuilder content: () -> Content) {
        self.title = title; self.subtitle = subtitle; self.symbol = symbol; self.tone = tone; self.empty = empty; self.content = content()
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 9) {
                Image(systemName: symbol).font(.system(size: 15)).foregroundStyle(tone).frame(width: 34, height: 34).background(tone.opacity(0.12)).clipShape(RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) { Text(title).font(.system(size: 14, weight: .bold)); Text(subtitle).font(.system(size: 10)).foregroundStyle(.secondary) }
            }
            if empty {
                Text("当前范围暂无数据").font(.system(size: 12)).foregroundStyle(.secondary).frame(maxWidth: .infinity).frame(height: 170).background(CareTheme.control).clipShape(RoundedRectangle(cornerRadius: 9))
            } else {
                content.frame(height: 200).padding(.top, 5)
            }
        }.careCard()
    }
}

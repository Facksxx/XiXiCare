import SwiftUI

struct TimelineView: View {
    @EnvironmentObject private var store: AppStore
    @State private var filter: CareRecordType?
    @State private var feedingFilter = "全部喂养"
    @State private var useDateRange = false
    @State private var startDate = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
    @State private var endDate = Date()
    @State private var deleteRecord: CareRecord?

    private var records: [CareRecord] {
        store.records.filter { record in
            if let filter, record.type != filter { return false }
            if filter == .feeding && feedingFilter != "全部喂养" && record.subtype != feedingFilter { return false }
            if useDateRange {
                let start = Calendar.current.startOfDay(for: startDate)
                let end = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: endDate)) ?? endDate
                if record.date < start || record.date >= end { return false }
            }
            return true
        }.sorted { $0.date > $1.date }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Button { useDateRange.toggle() } label: {
                    Label("日期", systemImage: "calendar").font(.system(size: 10, weight: .semibold)).frame(height: 31).padding(.horizontal, 8)
                        .foregroundStyle(useDateRange ? .white : CareTheme.secondary).background(useDateRange ? CareTheme.sage : CareTheme.control).clipShape(RoundedRectangle(cornerRadius: 8))
                }.buttonStyle(.plain)
                if useDateRange {
                    DatePicker("开始", selection: $startDate, displayedComponents: .date).labelsHidden().font(.system(size: 10)).scaleEffect(0.82)
                    Text("~").font(.system(size: 10)).foregroundStyle(.secondary)
                    DatePicker("结束", selection: $endDate, displayedComponents: .date).labelsHidden().font(.system(size: 10)).scaleEffect(0.82)
                }
                Spacer()
            }.padding(.horizontal, 14).padding(.top, 9)
            HStack(spacing: 6) {
                TimelineFilter(title: "全部", selected: filter == nil) { filter = nil }
                ForEach(CareRecordType.allCases) { type in
                    TimelineFilter(title: type.rawValue, selected: filter == type) { filter = type }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)

            if filter == .feeding {
                HStack(spacing: 6) {
                    ForEach(["全部喂养", "母乳", "奶瓶", "辅食"], id: \.self) { value in
                        TimelineFilter(title: value, selected: feedingFilter == value) { feedingFilter = value }
                    }
                }.padding(.horizontal, 14).padding(.bottom, 9)
            }

            if records.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.plus").font(.system(size: 28)).foregroundStyle(CareTheme.sage)
                    Text("暂无记录").font(.system(size: 14, weight: .bold))
                    Text("在记录大盘保存内容后，会显示在这里").font(.system(size: 11)).foregroundStyle(.secondary)
                }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        HStack {
                            Text("共 \(records.count) 条记录").font(.system(size: 12, weight: .semibold)).foregroundStyle(.secondary)
                            Spacer()
                        }
                        .padding(.horizontal, 2)
                        ForEach(records) { record in
                            RecordRow(record: record, interval: feedingInterval(for: record)) { deleteRecord = record }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.bottom, 16)
                }
            }
        }
        .background(CareTheme.canvas)
        .confirmationDialog("确认删除这条记录？", isPresented: Binding(get: { deleteRecord != nil }, set: { if !$0 { deleteRecord = nil } }), titleVisibility: .visible) {
            Button("确认删除", role: .destructive) { if let deleteRecord { store.delete(deleteRecord) }; deleteRecord = nil }
            Button("取消", role: .cancel) { deleteRecord = nil }
        }
    }

    private func feedingInterval(for record: CareRecord) -> String? {
        guard record.type == .feeding else { return nil }
        let previous = store.records.filter { $0.type == .feeding && $0.date < record.date }.max { $0.date < $1.date }
        guard let previous else { return nil }
        let minutes = Int(record.date.timeIntervalSince(previous.date) / 60)
        guard minutes >= 30 else { return nil }
        if minutes < 60 { return "距上次喂养 \(minutes)分钟" }
        return "距上次喂养 \(minutes / 60)小时\(minutes % 60 == 0 ? "" : "\(minutes % 60)分钟")"
    }
}

private struct TimelineFilter: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(selected ? .white : CareTheme.secondary)
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .background(selected ? CareTheme.sage : CareTheme.control)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay { RoundedRectangle(cornerRadius: 10).stroke(selected ? CareTheme.sage : CareTheme.line) }
        }
        .buttonStyle(.plain)
    }
}

private struct RecordRow: View {
    let record: CareRecord
    let interval: String?
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: record.type.symbol)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(color)
                .frame(width: 37, height: 37)
                .background(color.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 3) {
                Text(record.title).font(.system(size: 13, weight: .bold))
                if !record.detail.isEmpty { Text(record.detail).font(.system(size: 11)).foregroundStyle(.secondary) }
                if let interval { Text(interval).font(.system(size: 10, weight: .semibold)).foregroundStyle(CareTheme.sage) }
                Text(record.date.formatted(date: .abbreviated, time: .shortened)).font(.system(size: 10)).foregroundStyle(.tertiary)
            }
            Spacer()
            Button(action: onDelete) { Image(systemName: "trash").font(.system(size: 12)).foregroundStyle(.red.opacity(0.72)).frame(width: 28, height: 28) }.buttonStyle(.plain)
        }
        .padding(11)
        .background(CareTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 11))
        .overlay { RoundedRectangle(cornerRadius: 11).stroke(CareTheme.line) }
    }

    private var color: Color {
        switch record.type { case .feeding: CareTheme.peach; case .sleep: .indigo; case .diaper: CareTheme.sage; case .body: .pink }
    }
}

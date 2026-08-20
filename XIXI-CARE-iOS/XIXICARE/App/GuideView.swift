import SwiftUI

struct GuideView: View {
    @EnvironmentObject private var store: AppStore
    @State private var age = 0
    private let ages = ["0-1个月", "1-3个月", "3-6个月", "6-8个月"]

    var body: some View {
        ScrollView {
            VStack(spacing: 13) {
                HStack(spacing: 7) {
                    ForEach(ages.indices, id: \.self) { index in
                        CarePill(title: ages[index], selected: age == index) { age = index }
                    }
                }
                .padding(.horizontal, 2)

                VStack(alignment: .leading, spacing: 12) {
                    Label("喂养建议（乳类）", systemImage: "fork.knife")
                        .font(.headline)
                    HStack(spacing: 10) {
                        AdviceBox(title: "推荐奶量", value: adviceAmount)
                        AdviceBox(title: "喂养频次", value: adviceFrequency)
                    }
                    Text("观察宝宝饥饿和饱足信号，按需喂养；每次喂养后注意拍嗝。")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                .careCard()

                VStack(alignment: .leading, spacing: 9) {
                    Label("疫苗接种", systemImage: "syringe")
                        .font(.headline)
                    ForEach($store.vaccines) { $item in
                        Button { item.completed.toggle() } label: {
                            HStack {
                                Image(systemName: item.completed ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(item.completed ? CareTheme.sage : Color.secondary)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.name).font(.subheadline.weight(.semibold))
                                    Text(item.timing).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(item.completed ? "已接种" : "未接种")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(item.completed ? CareTheme.sage : Color.secondary)
                            }
                            .padding(12)
                            .background(Color(uiColor: .tertiarySystemFill))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .careCard()

                VStack(alignment: .leading, spacing: 10) {
                    Label("发育里程碑", systemImage: "medal")
                        .font(.headline)
                    Milestone(text: "趴卧时能尝试抬头片刻")
                    Milestone(text: "对熟悉的声音和面孔有反应")
                    Milestone(text: "双手会短暂握拳或张开")
                }
                .careCard()
            }
            .padding(14)
        }
    }

    private var adviceAmount: String {
        ["每次 30-90 ml（按需喂养）", "每次 90-150 ml", "每次 150-210 ml", "奶量随辅食调整"][age]
    }
    private var adviceFrequency: String {
        ["每2-3小时一次", "每日6-8次", "每日5-6次", "每日4-5次"][age]
    }
}
private struct AdviceBox: View {
    let title: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.subheadline.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(uiColor: .tertiarySystemFill))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

private struct Milestone: View {
    let text: String
    var body: some View {
        HStack(spacing: 9) {
            Circle().fill(CareTheme.sage).frame(width: 6, height: 6)
            Text(text).font(.subheadline)
        }
    }
}

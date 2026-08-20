import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var birthday = Date()
    @State private var confirmClear = false

    var body: some View {
        NavigationStack {
            Form {
                Section("宝宝信息") {
                    TextField("宝宝名字", text: $name)
                    DatePicker("出生日期", selection: $birthday, in: ...Date(), displayedComponents: .date)
                    Button("保存宝宝信息") {
                        store.baby = BabyProfile(name: name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "宝宝" : name, birthday: birthday)
                    }
                }
                Section("数据") {
                    LabeledContent("记录数量", value: "\(store.records.count)")
                    Button("清空护理记录", role: .destructive) { confirmClear = true }
                }
                Section {
                    LabeledContent("应用", value: "XIXI CARE")
                    LabeledContent("版本", value: "1.0.0")
                    LabeledContent("联系作者", value: "微信 Facksxx")
                }
            }
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "chevron.left") }
                }
            }
            .onAppear {
                name = store.baby.name
                birthday = store.baby.birthday
            }
            .confirmationDialog("确定清空全部护理记录？", isPresented: $confirmClear, titleVisibility: .visible) {
                Button("清空记录", role: .destructive) { store.clearRecords() }
                Button("取消", role: .cancel) {}
            }
        }
    }
}

import Foundation

@MainActor
final class AppStore: ObservableObject {
    @Published var baby: BabyProfile { didSet { persist() } }
    @Published var records: [CareRecord] { didSet { persist() } }
    @Published var vaccines: [VaccineItem] { didSet { persist() } }

    private let defaults = UserDefaults.standard
    private var restoring = true

    init() {
        baby = BabyProfile()
        records = []
        vaccines = [
            VaccineItem(id: "hepb1", name: "乙肝疫苗（第1剂）", timing: "出生时", completed: false),
            VaccineItem(id: "bcg", name: "卡介苗（BCG）", timing: "出生时", completed: false),
            VaccineItem(id: "hepb2", name: "乙肝疫苗（第2剂）", timing: "1月龄", completed: false),
            VaccineItem(id: "polio1", name: "脊灰疫苗（第1剂）", timing: "2月龄", completed: false)
        ]
        restore()
        restoring = false
    }

    func add(_ record: CareRecord) {
        records.insert(record, at: 0)
    }

    func delete(_ record: CareRecord) {
        records.removeAll { $0.id == record.id }
    }

    func clearRecords() {
        records = []
    }

    private func persist() {
        guard !restoring else { return }
        let encoder = JSONEncoder()
        if let value = try? encoder.encode(baby) { defaults.set(value, forKey: "xixi.baby") }
        if let value = try? encoder.encode(records) { defaults.set(value, forKey: "xixi.records") }
        if let value = try? encoder.encode(vaccines) { defaults.set(value, forKey: "xixi.vaccines") }
    }

    private func restore() {
        let decoder = JSONDecoder()
        if let data = defaults.data(forKey: "xixi.baby"), let value = try? decoder.decode(BabyProfile.self, from: data) { baby = value }
        if let data = defaults.data(forKey: "xixi.records"), let value = try? decoder.decode([CareRecord].self, from: data) { records = value }
        if let data = defaults.data(forKey: "xixi.vaccines"), let value = try? decoder.decode([VaccineItem].self, from: data) { vaccines = value }
    }
}

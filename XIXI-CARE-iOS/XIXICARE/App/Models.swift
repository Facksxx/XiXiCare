import Foundation

struct BabyProfile: Codable, Equatable {
    var name = "宝宝"
    var birthday = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()

    var ageText: String {
        let days = max(0, Calendar.current.dateComponents([.day], from: birthday, to: Date()).day ?? 0)
        if days < 30 { return "\(days)天" }
        let months = max(1, days / 30)
        return "\(months)个月"
    }
}

enum CareRecordType: String, Codable, CaseIterable, Identifiable {
    case feeding = "喂养"
    case sleep = "睡眠"
    case diaper = "尿布"
    case body = "体征"

    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .feeding: return "drop.circle"
        case .sleep: return "moon.zzz"
        case .diaper: return "drop"
        case .body: return "scalemass"
        }
    }
}

struct CareRecord: Identifiable, Codable, Equatable {
    var id = UUID()
    var babyID = "default"
    var type: CareRecordType
    var date: Date
    var title: String
    var detail: String
    var value: Double?
    var unit: String?
    var subtype: String?
}

struct VaccineItem: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let timing: String
    var completed: Bool
}

struct SoundTrack: Identifiable, Hashable {
    let id: String
    let title: String
    let category: String
    let resource: String
    let fileExtension: String
    let symbol: String
}

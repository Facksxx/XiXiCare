import SwiftUI

@main
struct XIXICAREApp: App {
    @StateObject private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .tint(CareTheme.sage)
        }
    }
}

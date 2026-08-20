import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let audioSession = AVAudioSession.sharedInstance()
        try? audioSession.setCategory(.playback, mode: .default)
        try? audioSession.setActive(true)
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
}

class ViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SoundDownloadPlugin())
    }
}

@objc(SoundDownloadPlugin)
class SoundDownloadPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDownloadDelegate {
    let identifier = "SoundDownloadPlugin"
    let jsName = "SoundDownload"
    let pluginMethods: [CAPPluginMethod] = [
        .init(selector: #selector(download), returnType: CAPPluginReturnPromise),
        .init(selector: #selector(cancel), returnType: CAPPluginReturnPromise)
    ]

    private struct Transfer {
        let id: String
        let path: URL
        let call: CAPPluginCall
    }

    private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
    private var transfers: [Int: Transfer] = [:]
    private var taskIds: [String: Int] = [:]
    private let lock = NSLock()

    @objc func download(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let source = call.getString("url"),
              let url = URL(string: source),
              let rawPath = call.getString("path"),
              let path = URL(string: rawPath) else {
            call.reject("下载参数无效", "INVALID_OPTIONS")
            return
        }
        try? FileManager.default.createDirectory(at: path.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? FileManager.default.removeItem(at: path)
        let task = session.downloadTask(with: url)
        lock.lock()
        transfers[task.taskIdentifier] = Transfer(id: id, path: path, call: call)
        taskIds[id] = task.taskIdentifier
        lock.unlock()
        task.resume()
    }

    @objc func cancel(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.resolve(); return }
        lock.lock()
        let taskIdentifier = taskIds[id]
        lock.unlock()
        if let taskIdentifier {
            session.getAllTasks { tasks in
                tasks.first(where: { $0.taskIdentifier == taskIdentifier })?.cancel()
            }
        }
        call.resolve()
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        lock.lock()
        let transfer = transfers[downloadTask.taskIdentifier]
        lock.unlock()
        guard let transfer else { return }
        let total = max(0, totalBytesExpectedToWrite)
        let percent = total > 0 ? min(100, Double(totalBytesWritten) * 100 / Double(total)) : 0
        notifyListeners("downloadProgress", data: ["id": transfer.id, "bytes": totalBytesWritten, "total": total, "percent": percent])
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        lock.lock()
        let transfer = transfers[downloadTask.taskIdentifier]
        lock.unlock()
        guard let transfer else { return }
        do {
            try? FileManager.default.removeItem(at: transfer.path)
            try FileManager.default.moveItem(at: location, to: transfer.path)
        } catch {
            transfer.call.reject("声音下载失败", "DOWNLOAD_FAILED", error)
            finish(downloadTask.taskIdentifier)
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        lock.lock()
        let transfer = transfers[task.taskIdentifier]
        lock.unlock()
        guard let transfer else { return }
        if let error {
            try? FileManager.default.removeItem(at: transfer.path)
            let cancelled = (error as NSError).code == NSURLErrorCancelled
            transfer.call.reject(cancelled ? "下载已取消" : "声音下载失败", cancelled ? "CANCELLED" : "DOWNLOAD_FAILED", error)
        } else {
            transfer.call.resolve()
        }
        finish(task.taskIdentifier)
    }

    private func finish(_ taskIdentifier: Int) {
        lock.lock()
        if let transfer = transfers.removeValue(forKey: taskIdentifier) { taskIds.removeValue(forKey: transfer.id) }
        lock.unlock()
    }
}

import AppKit
import Foundation

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var handled = false

    private func log(_ message: String) {
        let line = "\(Date()) \(message)\n"
        if let data = line.data(using: .utf8) {
            if FileManager.default.fileExists(atPath: "/tmp/max-live-photo-handler.log") {
                if let handle = try? FileHandle(forWritingTo: URL(fileURLWithPath: "/tmp/max-live-photo-handler.log")) {
                    handle.seekToEndOfFile(); handle.write(data); try? handle.close()
                }
            } else { FileManager.default.createFile(atPath: "/tmp/max-live-photo-handler.log", contents: data) }
        }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let arguments = CommandLine.arguments.dropFirst()
        log("didFinish args=\(Array(arguments))")
        if !arguments.isEmpty {
            for path in arguments { launchHandler(path) }
            handled = true
            NSApp.terminate(nil)
        }
    }

    func application(_ application: NSApplication, openFiles filenames: [String]) {
        log("openFiles=\(filenames)")
        for path in filenames { launchHandler(path) }
        handled = true
        NSApp.reply(toOpenOrPrint: .success)
        NSApp.terminate(nil)
    }

    func application(_ sender: NSApplication, openFile filename: String) -> Bool {
        log("openFile=\(filename)")
        launchHandler(filename)
        handled = true
        NSApp.terminate(nil)
        return true
    }

    private func launchHandler(_ packagePath: String) {
        let bundle = Bundle.main.bundlePath
        let script = URL(fileURLWithPath: bundle)
            .appendingPathComponent("Contents/Resources/open-handler.js").path
        let nodeCandidates = [
            ProcessInfo.processInfo.environment["MAX_LIVE_NODE"],
            "/Users/max/.local/bin/node",
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
        ].compactMap { $0 }
        guard let node = nodeCandidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else { return }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: node)
        process.arguments = [script, packagePath]
        process.environment = ProcessInfo.processInfo.environment
        try? process.run()
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.accessory)
application.run()


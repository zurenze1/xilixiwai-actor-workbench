import Cocoa
import WebKit
import Darwin

final class IPWorkbench: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var message: NSTextField!
    var child: Process?
    var serviceLog: FileHandle?
    var starting = false
    var stopping = false
    var downloads: [ObjectIdentifier: WKDownload] = [:]
    var downloadFiles: [ObjectIdentifier: (temporary: URL, destination: URL)] = [:]
    let bundle = Bundle.main
    var isQA: Bool { (bundle.bundleIdentifier ?? "").hasSuffix(".qa") }
    var port: Int { isQA ? (bundle.object(forInfoDictionaryKey: "IPServicePort") as? Int ?? 5936) : 4936 }
    var address: URL { URL(string: "http://127.0.0.1:\(port)/practical/ip/")! }
    var dataDirectory: URL {
        if isQA, let path = bundle.object(forInfoDictionaryKey: "IPDataDirectory") as? String { return URL(fileURLWithPath: path, isDirectory: true) }
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("IP工作台", isDirectory: true)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        if let existing = NSRunningApplication.runningApplications(withBundleIdentifier: bundle.bundleIdentifier ?? "").first(where: { $0.processIdentifier != getpid() }) {
            existing.activate(options: [.activateAllWindows]); NSApp.terminate(nil); return
        }
        makeMenu()
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1220, height: 820), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = bundle.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "IP工作台"
        window.minSize = NSSize(width: 820, height: 580)
        window.isReleasedWhenClosed = false
        window.setFrameAutosaveName("IPWorkbenchMain")
        web = WKWebView(frame: window.contentView!.bounds, configuration: WKWebViewConfiguration())
        web.autoresizingMask = [.width, .height]
        web.navigationDelegate = self; web.uiDelegate = self
        window.contentView!.addSubview(web)
        message = NSTextField(labelWithString: "正在打开 IP 工作台…")
        message.frame = NSRect(x: 28, y: 28, width: 1120, height: 44)
        message.autoresizingMask = [.width, .minYMargin]
        message.textColor = .secondaryLabelColor
        window.contentView!.addSubview(message)
        window.center(); show(); start()
    }

    func makeMenu() {
        let bar = NSMenu()
        let appItem = NSMenuItem(); let appMenu = NSMenu(); appItem.submenu = appMenu; bar.addItem(appItem)
        appMenu.addItem(withTitle: "关于 IP 工作台", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出 IP 工作台", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(title: "编辑", action: nil, keyEquivalent: ""); let edit = NSMenu(title: "编辑"); editItem.submenu = edit; bar.addItem(editItem)
        for (title, selector, key) in [("撤销", "undo:", "z"),("剪切", "cut:", "x"),("复制", "copy:", "c"),("粘贴", "paste:", "v"),("全选", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        let viewItem = NSMenuItem(title: "查看", action: nil, keyEquivalent: ""); let view = NSMenu(title: "查看"); viewItem.submenu = view; bar.addItem(viewItem)
        view.addItem(withTitle: "重新载入", action: #selector(reload), keyEquivalent: "r").target = self
        view.addItem(withTitle: "打开资料文件夹", action: #selector(openData), keyEquivalent: "").target = self
        NSApp.mainMenu = bar
    }
    func show() { window?.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { show(); return true }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    @objc func openData() { NSWorkspace.shared.open(dataDirectory) }
    @objc func reload() { start() }

    func healthy() -> Bool {
        let semaphore = DispatchSemaphore(value: 0)
        var valid = false
        var request = URLRequest(url: URL(string: "http://127.0.0.1:\(port)/api/health")!)
        request.timeoutInterval = 1; request.cachePolicy = .reloadIgnoringLocalCacheData
        URLSession.shared.dataTask(with: request) { data, _, _ in
            defer { semaphore.signal() }
            guard let data = data, let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            valid = result["ok"] as? Bool == true && result["profile"] as? String == "ip" && result["ipVersion"] is String
        }.resume()
        _ = semaphore.wait(timeout: .now() + 2)
        return valid
    }

    func start() {
        guard !starting else { return }; starting = true
        message.isHidden = false; message.stringValue = "正在打开 IP 工作台…"
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                if !self.healthy() {
                    let fm = FileManager.default
                    try fm.createDirectory(at: self.dataDirectory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
                    let logs = fm.urls(for: .libraryDirectory, in: .userDomainMask)[0].appendingPathComponent("Logs/IP工作台", isDirectory: true)
                    try fm.createDirectory(at: logs, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
                    let logURL = logs.appendingPathComponent(self.isQA ? "qa-service.log" : "service.log")
                    if !fm.fileExists(atPath: logURL.path) { fm.createFile(atPath: logURL.path, contents: nil, attributes: [.posixPermissions: 0o600]) }
                    let log = try FileHandle(forWritingTo: logURL); try log.seekToEnd(); self.serviceLog = log
                    let serviceRoot = self.bundle.resourceURL!.appendingPathComponent("service", isDirectory: true)
                    let process = Process()
                    process.executableURL = self.bundle.resourceURL!.appendingPathComponent("node/bin/node")
                    process.arguments = [serviceRoot.appendingPathComponent("practical/server/ip-start.mjs").path]
                    process.currentDirectoryURL = serviceRoot
                    var environment = ProcessInfo.processInfo.environment
                    environment["DATA_DIR"] = self.dataDirectory.path
                    environment["PORT"] = String(self.port)
                    process.environment = environment
                    process.standardInput = FileHandle.nullDevice; process.standardOutput = log; process.standardError = log
                    var launched = false
                    try DispatchQueue.main.sync {
                        guard !self.stopping else { return }
                        self.child = process; try process.run(); launched = true
                    }
                    guard launched else { return }
                    var ready = false
                    for _ in 0..<80 {
                        if self.healthy() { ready = true; break }
                        if !process.isRunning { break }
                        Thread.sleep(forTimeInterval: 0.2)
                    }
                    guard ready else { throw NSError(domain: "IPWorkbench", code: 1, userInfo: [NSLocalizedDescriptionKey: "本机服务未能启动。请检查端口是否被占用；按 ⌘R 重试。原有资料不会被清空。"] ) }
                }
                DispatchQueue.main.async {
                    guard !self.stopping else { return }
                    self.starting = false; self.web.load(URLRequest(url: self.address)); self.show()
                }
            } catch {
                if self.child?.isRunning == true { self.child?.terminate() }
                DispatchQueue.main.async {
                    guard !self.stopping else { return }
                    self.starting = false; self.message.stringValue = error.localizedDescription; self.show()
                }
            }
        }
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if stopping { return .terminateLater }
        stopping = true
        guard let process = child, process.isRunning else { return .terminateNow }
        process.terminate()
        DispatchQueue.global().async {
            for _ in 0..<120 { if !process.isRunning { break }; Thread.sleep(forTimeInterval: 0.1) }
            if process.isRunning { kill(process.processIdentifier, SIGKILL) }
            process.waitUntilExit()
            DispatchQueue.main.async { NSApp.reply(toApplicationShouldTerminate: true) }
        }
        return .terminateLater
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { message.isHidden = true }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code == NSURLErrorCancelled || !downloads.isEmpty { return }
        message.isHidden = false; message.stringValue = "连接暂时中断，按 ⌘R 重试。"
    }
    func localURL(_ url: URL) -> Bool { url.scheme == "http" && url.host == "127.0.0.1" && url.port == port }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload { decisionHandler(.download); return }
        if localURL(url) || url.scheme == "blob" || url.absoluteString == "about:blank" { decisionHandler(.allow); return }
        if action.navigationType == .linkActivated && ["https","http","mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { if localURL(url) { webView.load(action.request) } else if ["http","https","mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) } }; return nil
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let picker = NSOpenPanel(); picker.allowsMultipleSelection = parameters.allowsMultipleSelection; picker.canChooseDirectories = parameters.allowsDirectories
        picker.beginSheetModal(for: window) { completionHandler($0 == .OK ? picker.urls : nil) }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage text: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert(); alert.messageText = text; alert.beginSheetModal(for: window) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage text: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = text; alert.addButton(withTitle: "确定"); alert.addButton(withTitle: "取消")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let disposition = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
        decisionHandler(!response.canShowMIMEType || disposition.lowercased().contains("attachment") ? .download : .allow)
    }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { track(download) }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { track(download) }
    func track(_ download: WKDownload) { downloads[ObjectIdentifier(download)] = download; download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = (suggestedFilename as NSString).lastPathComponent
        panel.canCreateDirectories = true; panel.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
        panel.title = "保存工作台文件"; panel.prompt = "保存"
        panel.beginSheetModal(for: window) { result in
            guard result == .OK, let destination = panel.url else { completionHandler(nil); return }
            let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("ip-workbench-download-" + UUID().uuidString)
            self.downloadFiles[ObjectIdentifier(download)] = (temporary,destination)
            DispatchQueue.main.async { completionHandler(temporary) }
        }
    }
    func downloadDidFinish(_ download: WKDownload) {
        let key = ObjectIdentifier(download)
        defer { downloads.removeValue(forKey: key); downloadFiles.removeValue(forKey: key) }
        guard let files = downloadFiles[key] else { return }
        do {
            if FileManager.default.fileExists(atPath: files.destination.path) { _ = try FileManager.default.replaceItemAt(files.destination, withItemAt: files.temporary) }
            else { try FileManager.default.moveItem(at: files.temporary, to: files.destination) }
            message.stringValue = "已保存：" + files.destination.lastPathComponent; message.isHidden = false
        } catch { message.stringValue = "保存失败：" + error.localizedDescription; message.isHidden = false }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        let key = ObjectIdentifier(download)
        if let files = downloadFiles.removeValue(forKey: key) { try? FileManager.default.removeItem(at: files.temporary) }
        downloads.removeValue(forKey: key)
        if (error as NSError).code != NSURLErrorCancelled { message.stringValue = "文件保存失败，请重试。"; message.isHidden = false }
    }
}

let application = NSApplication.shared
let delegate = IPWorkbench()
application.delegate = delegate
application.run()

import Cocoa
import WebKit

// A normal, visible Douyin session. No client cookies, hidden APIs or background
// input automation are used. The person sends the reply in the official page.
final class CommentReplyWindow: NSObject, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    let window: NSWindow
    let browser: WKWebView
    let base: URL
    let draftID: String
    let projectID: String
    var csrf = ""
    var row: [String: Any] = [:]
    var session = ""
    var settled = false
    var updating = false
    var onClose: (() -> Void)?
    let status = NSTextField(wrappingLabelWithString: "正在读取审核稿…")
    let details = NSTextView()
    let copyButton = NSButton(title: "复制已审核回复", target: nil, action: nil)
    let doneButton = NSButton(title: "我已在抖音回复 · 交回核对", target: nil, action: nil)
    let cancelButton = NSButton(title: "尚未发送 · 退回草稿", target: nil, action: nil)

    init(port: Int, project: String, draft: String) {
        projectID = project; draftID = draft
        base = URL(string: "http://127.0.0.1:\(port)/api/p/projects/\(project)/creator/app/api/")!
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        browser = WKWebView(frame: .zero, configuration: config)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1380, height: 880), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        super.init()
        window.title = "评论回复 · IP工作台"
        window.minSize = NSSize(width: 1080, height: 650)
        window.isReleasedWhenClosed = false; window.delegate = self
        let split = NSSplitView(frame: window.contentView!.bounds)
        split.isVertical = true; split.dividerStyle = .thin
        split.autoresizingMask = [.width, .height]
        let side = NSView(frame: NSRect(x: 0, y: 0, width: 340, height: 880))
        let stack = NSStackView()
        stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        side.addSubview(stack)
        let title = NSTextField(labelWithString: "审核稿与原评论")
        title.font = .boldSystemFont(ofSize: 23)
        let instruction = NSTextField(wrappingLabelWithString: "右侧是抖音官方页面。首次请正常登录，再核对本人账号、原评论作者和全文。复制左侧审核稿，在该评论的“回复”框中发送。")
        instruction.textColor = .secondaryLabelColor
        status.font = .systemFont(ofSize: 13); status.textColor = .secondaryLabelColor
        details.isEditable = false; details.isSelectable = true
        details.font = .systemFont(ofSize: 15); details.textContainerInset = NSSize(width: 8, height: 12)
        details.drawsBackground = false
        let scroll = NSScrollView(); scroll.documentView = details; scroll.hasVerticalScroller = true
        scroll.translatesAutoresizingMaskIntoConstraints = false
        for b in [copyButton, doneButton, cancelButton] { b.target = self; b.bezelStyle = .rounded; b.isEnabled = false }
        copyButton.action = #selector(copyReply); doneButton.action = #selector(done); cancelButton.action = #selector(cancel)
        let profile = NSButton(title: "核对当前登录账号", target: self, action: #selector(openProfile))
        profile.bezelStyle = .rounded
        let video = NSButton(title: "返回这条作品", target: self, action: #selector(openVideo))
        video.bezelStyle = .rounded
        let note = NSTextField(wrappingLabelWithString: "请勿重复发送。点“交回核对”只记录你的操作，尚未回读平台结果时不会显示“已发送”。关闭窗口也会暂停自动发送，保留待核对记录。")
        note.font = .systemFont(ofSize: 12); note.textColor = .secondaryLabelColor
        for v in [title, instruction, status, scroll, copyButton, profile, video, doneButton, cancelButton, note] { stack.addArrangedSubview(v) }
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: side.leadingAnchor, constant: 20), stack.trailingAnchor.constraint(equalTo: side.trailingAnchor, constant: -20),
            stack.topAnchor.constraint(equalTo: side.topAnchor, constant: 22), stack.bottomAnchor.constraint(equalTo: side.bottomAnchor, constant: -20),
            scroll.widthAnchor.constraint(equalTo: stack.widthAnchor), scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 210)
        ])
        browser.frame = NSRect(x: 341, y: 0, width: 1039, height: 880)
        browser.navigationDelegate = self; browser.uiDelegate = self
        split.addArrangedSubview(side); split.addArrangedSubview(browser)
        split.setPosition(340, ofDividerAt: 0)
        window.contentView!.addSubview(split)
        window.center(); show()
        Task { await prepare() }
    }

    func show() { window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }

    func request(_ path: String, body: [String: Any]? = nil) async throws -> [String: Any] {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.timeoutInterval = 30
        if let body = body {
            req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("http://127.0.0.1:\(base.port!)", forHTTPHeaderField: "Origin")
            req.setValue(csrf, forHTTPHeaderField: "x-workbench-csrf")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NSError(domain: "CommentReply", code: 1, userInfo: [NSLocalizedDescriptionKey: result["error"] as? String ?? "回复箱连接失败，请返回工作台刷新。"])
        }
        return result
    }

    @MainActor func prepare() async {
        do {
            csrf = try await request("bootstrap")["csrf"] as? String ?? ""
            let result = try await request("discovery/replies/\(draftID)/manual", body: ["action": "start"])
            row = result["reply"] as? [String: Any] ?? [:]
            session = result["session"] as? String ?? ""
            guard !session.isEmpty, let target = result["target"] as? [String: Any] else { throw NSError(domain: "CommentReply", code: 2) }
            let name = target["name"] as? String ?? ""
            let number = target["douyinId"] as? String ?? ""
            details.string = "回复账号\n\(name) · \(number)\n\n作品\n\(row["video_title"] as? String ?? "")\n\n原评论 · \(row["author"] as? String ?? "")\n\(row["comment_text"] as? String ?? "")\n\n已审核回复\n\(row["approved_body"] as? String ?? "")"
            status.stringValue = result["resumed"] as? Bool == true ? "恢复查看：请先检查是否已回复，避免重复。" : "已进入本人回复窗口，自动发送暂不领取这条。"
            for b in [copyButton, doneButton, cancelButton] { b.isEnabled = true }
            openVideo()
        } catch { status.stringValue = error.localizedDescription }
    }

    @objc func copyReply() {
        guard let body = row["approved_body"] as? String, !body.isEmpty else { return }
        NSPasteboard.general.clearContents(); NSPasteboard.general.setString(body, forType: .string)
        status.stringValue = "已复制审核稿。请确认右侧输入框是在回复这位观众，再粘贴发送。"
    }
    @objc func openProfile() { browser.load(URLRequest(url: URL(string: "https://www.douyin.com/user/self")!)) }
    @objc func openVideo() {
        guard let raw = row["video_url"] as? String, let url = URL(string: raw), url.scheme == "https", url.host == "www.douyin.com", url.path.range(of: "^/video/[0-9]+$", options: .regularExpression) != nil else { return }
        browser.load(URLRequest(url: url))
    }
    @objc func done() { finish("reported") }
    @objc func cancel() { finish("cancel") }
    func finish(_ action: String) {
        guard !updating, !session.isEmpty else { return }; updating = true
        Task { @MainActor in
            do {
                _ = try await request("discovery/replies/\(draftID)/manual", body: ["action": action, "session": session])
                settled = true; updating = false
                status.stringValue = action == "cancel" ? "已退回待审核草稿，没有记作发送。" : "已记录你的回复操作，等待回读抖音结果；不会自动重发。"
                for b in [copyButton, doneButton, cancelButton] { b.isEnabled = false }
            } catch { updating = false; status.stringValue = error.localizedDescription }
        }
    }
    func windowWillClose(_ notification: Notification) {
        if !settled && !session.isEmpty { finish("closed") }
        onClose?()
    }
    func allowed(_ url: URL) -> Bool {
        guard url.scheme == "https", let host = url.host?.lowercased() else { return url.absoluteString == "about:blank" }
        return host == "douyin.com" || host.hasSuffix(".douyin.com")
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, allowed(url), !action.shouldPerformDownload else { decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, allowed(url) { browser.load(action.request) }; return nil
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { status.stringValue = "抖音页面加载失败，可点“返回这条作品”重试；没有记作已发送。" }
    }
}

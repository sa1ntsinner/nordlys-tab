//  The window of the Mac app that carries the Safari extension. Safari gives an
//  extension no way to turn itself on or to take over new tabs, so the app shows
//  the two places where the person does it, and steps aside.

import Cocoa
import SafariServices
import WebKit

let extensionBundleIdentifier = (Bundle.main.bundleIdentifier ?? "io.github.sa1ntsinner.nordlys") + ".Extension"

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!
    private var timer: Timer?
    private var ready = false

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.navigationDelegate = self
        webView.configuration.userContentController.add(self, name: "controller")
        webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        guard let window = view.window else { return }
        window.styleMask.insert(.fullSizeContentView)
        window.styleMask.remove(.resizable)
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.backgroundColor = NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
                ? NSColor(srgbRed: 0.106, green: 0.110, blue: 0.118, alpha: 1)
                : NSColor(srgbRed: 0.965, green: 0.965, blue: 0.961, alpha: 1)
        }
        window.setContentSize(NSSize(width: 480, height: 624))
        window.center()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let language = (Locale.preferredLanguages.first ?? "en").replacingOccurrences(of: "'", with: "")
        webView.evaluateJavaScript("start('\(language)')")
        ready = true
        look()
        // The person turns the extension on in Safari while this window waits behind it.
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.look() }
    }

    private func look() {
        guard ready else { return }
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { [weak self] state, error in
            guard let state = state, error == nil else { return }
            DispatchQueue.main.async { self?.webView.evaluateJavaScript("show(\(state.isEnabled))") }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.body as? String {
        case "extensions":
            SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in }
        case "safari":
            guard let safari = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") else { return }
            NSWorkspace.shared.openApplication(at: safari, configuration: NSWorkspace.OpenConfiguration()) { _, _ in
                DispatchQueue.main.async { NSApplication.shared.terminate(nil) }
            }
        default:
            return
        }
    }

}

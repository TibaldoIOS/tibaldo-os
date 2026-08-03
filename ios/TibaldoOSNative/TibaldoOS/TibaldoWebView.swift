import Combine
import SwiftUI
import UIKit
import WebKit

final class TibaldoWebViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var errorMessage: String?

    fileprivate weak var webView: WKWebView?

    fileprivate func loadHome(in webView: WKWebView) {
        guard let url = URL(string: "https://app.tibaldo.fr/") else { return }

        var request = URLRequest(url: url)
        request.cachePolicy = .useProtocolCachePolicy
        request.timeoutInterval = 30
        webView.load(request)
    }

    func reload() {
        errorMessage = nil
        isLoading = true

        guard let webView else { return }
        loadHome(in: webView)
    }
}

struct TibaldoWebView: UIViewRepresentable {
    @ObservedObject var model: TibaldoWebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.applicationNameForUserAgent = "TibaldoOS/1.0"
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 247.0 / 255.0, green: 244.0 / 255.0, blue: 239.0 / 255.0, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.keyboardDismissMode = .interactive

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl

        model.webView = webView
        model.loadHome(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let model: TibaldoWebViewModel
        private let allowedHost = "app.tibaldo.fr"

        init(model: TibaldoWebViewModel) {
            self.model = model
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            guard let webView = model.webView else {
                sender.endRefreshing()
                return
            }

            webView.reload()
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation?) {
            model.isLoading = true
            model.errorMessage = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
            model.isLoading = false
            model.errorMessage = nil
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation?,
            withError error: Error
        ) {
            handle(error: error, in: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: Error) {
            handle(error: error, in: webView)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if url.host == allowedHost || url.scheme == "about" {
                decisionHandler(.allow)
                return
            }

            if ["http", "https", "mailto", "tel", "sms"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            guard navigationAction.targetFrame == nil, let url = navigationAction.request.url else { return nil }

            if url.host == allowedHost {
                webView.load(navigationAction.request)
            } else {
                UIApplication.shared.open(url)
            }

            return nil
        }

        private func handle(error: Error, in webView: WKWebView) {
            if (error as NSError).code == NSURLErrorCancelled { return }

            model.isLoading = false
            model.errorMessage = "Tibaldo OS ne peut pas se synchroniser. Vérifie la connexion Internet puis réessaie."
            webView.scrollView.refreshControl?.endRefreshing()
        }
    }
}

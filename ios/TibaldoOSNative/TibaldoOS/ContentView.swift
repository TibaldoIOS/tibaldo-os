import SwiftUI

struct ContentView: View {
    @StateObject private var webViewModel = TibaldoWebViewModel()

    var body: some View {
        ZStack {
            Color(red: 31.0 / 255.0, green: 77.0 / 255.0, blue: 58.0 / 255.0)
                .ignoresSafeArea()

            TibaldoWebView(model: webViewModel)

            if webViewModel.isLoading {
                ProgressView("Ouverture de Tibaldo OS…")
                    .tint(.white)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 16)
                    .background(.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 18))
            }

            if let errorMessage = webViewModel.errorMessage {
                VStack(spacing: 16) {
                    Text("T")
                        .font(.system(size: 34, weight: .black))
                        .foregroundStyle(Color(red: 31.0 / 255.0, green: 77.0 / 255.0, blue: 58.0 / 255.0))
                        .frame(width: 72, height: 72)
                        .background(Color(red: 216.0 / 255.0, green: 199.0 / 255.0, blue: 170.0 / 255.0))
                        .clipShape(RoundedRectangle(cornerRadius: 24))

                    Text("Connexion nécessaire")
                        .font(.title2.bold())

                    Text(errorMessage)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)

                    Button("Réessayer") {
                        webViewModel.reload()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 31.0 / 255.0, green: 77.0 / 255.0, blue: 58.0 / 255.0))
                }
                .padding(28)
                .frame(maxWidth: 340)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28))
                .padding(20)
            }
        }
    }
}

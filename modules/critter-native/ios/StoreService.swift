import StoreKit
import UIKit

/// StoreKit 2 purchases. Product IDs must match App Store Connect exactly.
///   Consumable:     com.critterstack.skips5 / skips15 / skips40, com.critterstack.undos5 / undos15 / undos40,
///                   com.critterstack.lives5 (refill), com.critterstack.lives1h (1 hour unlimited)
///   Non-consumable: com.critterstack.noads, com.critterstack.zoo, com.critterstack.bundle
@MainActor
final class StoreService {
    static let consumables: Set<String> = ["com.critterstack.skips5", "com.critterstack.skips15", "com.critterstack.skips40",
                                           "com.critterstack.undos5", "com.critterstack.undos15", "com.critterstack.undos40",
                                           "com.critterstack.lives5", "com.critterstack.lives1h"]
    static let unlocks: Set<String> = ["com.critterstack.noads", "com.critterstack.zoo", "com.critterstack.bundle"]
    static var all: Set<String> { consumables.union(unlocks) }

    private unowned let bridge: GameBridge
    private var products: [String: Product] = [:]
    private var updates: Task<Void, Never>?

    init(bridge: GameBridge) { self.bridge = bridge }

    func start() {
        // Purchases that finish outside the app (Ask to Buy, interrupted purchases, other devices)
        updates = Task { [weak self] in
            for await result in Transaction.updates { await self?.deliver(result) }
        }
        Task { await loadProducts() }
    }

    private func loadProducts() async {
        guard let list = try? await Product.products(for: Self.all) else { return }
        products = Dictionary(uniqueKeysWithValues: list.map { ($0.id, $0) })
        sendPrices()
    }

    /// Localized prices ("$0.99", "0,99 €", "¥160") replace the page's placeholder prices.
    func sendPrices() {
        guard !products.isEmpty else { return }
        bridge.call("critterPrices", products.mapValues { $0.displayPrice })
    }

    func handle(type: String, body: [String: Any]) {
        switch type {
        case "purchase":
            guard let id = body["productID"] as? String else { return }
            Task { await purchase(id) }
        case "restore":
            Task { await restore() }
        case "requestReview":
            // The page only asks at happy moments; iOS decides whether to actually show the prompt (max 3 a year).
            if let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                AppStore.requestReview(in: scene)
            }
        default: break
        }
    }

    private func purchase(_ id: String) async {
        if products[id] == nil { await loadProducts() }
        guard let product = products[id] else { bridge.call("critterPurchaseFailed", "That item isn't available right now"); return }
        do {
            switch try await product.purchase() {
            case .success(let result): await deliver(result)
            case .pending: bridge.call("critterPurchaseFailed", "Waiting for approval")
            case .userCancelled: break
            @unknown default: break
            }
        } catch {
            bridge.call("critterPurchaseFailed", "The purchase didn't go through")
        }
    }

    private func deliver(_ result: VerificationResult<Transaction>) async {
        guard case .verified(let tx) = result else { return }        // ignore anything that fails Apple's signature check
        if tx.revocationDate == nil {
            bridge.call("critterPurchased", tx.productID)
        }
        await tx.finish()
    }

    /// Restore Purchases: sync with the App Store, then report every unlock this Apple ID owns.
    private func restore() async {
        try? await AppStore.sync()
        var owned: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, Self.unlocks.contains(tx.productID), tx.revocationDate == nil {
                owned.append(tx.productID)
            }
        }
        bridge.call("critterRestored", owned)
    }
}

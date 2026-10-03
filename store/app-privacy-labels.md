# App Store Connect › App Privacy: suggested answers

These answers match the privacy policy and the current setup: Game Center, StoreKit, iCloud key-value backup, and **Google AdMob** interstitials. Check them against Google's current AdMob disclosure guide ("Prepare for Apple's App Store data disclosure requirements" in the AdMob help center) before you submit, because Google updates what its SDK collects.

## Do you or your third-party partners collect data from this app?
**Yes**, because the AdMob SDK collects data. Without ads, the answer would be "No": Apple doesn't count Game Center, iCloud or purchase data that Apple itself processes, and the rest stays on the device.

## Data types to declare

| Category › Type | Collected by | Linked to the user? | Used for tracking? | Purposes |
|---|---|---|---|---|
| Identifiers › **Device ID** (IDFA) | AdMob | No | **Yes**, only when the player allows tracking | Third-Party Advertising, Analytics |
| Location › **Coarse Location** (from IP) | AdMob | No | No | Third-Party Advertising, Analytics |
| Usage Data › **Advertising Data** | AdMob | No | Yes | Third-Party Advertising, Analytics |
| Usage Data › **Product Interaction** | AdMob | No | No | Third-Party Advertising, Analytics |
| Diagnostics › **Crash Data** / **Performance Data** | AdMob | No | No | App Functionality, Analytics |
| Purchases › **Purchase History** | the app (receives it from StoreKit) | No | No | App Functionality |

Leave everything else unchecked: contact info, health, financial info (Apple handles payments), precise location, contacts, user content, browsing and search history, sensitive info, and other identifiers.

- **Game Center:** Apple's own service, so there's nothing to declare for it.
- **Player name:** stays on the device and in the player's own iCloud, and is never sent to you, so it isn't "collected".

## Other App Store Connect fields
- **Privacy Policy URL:** wherever you host `privacy-policy.html`.
- **Tracking:** yes, because of the IDFA with AdMob. That means `NSUserTrackingUsageDescription` in Info.plist and the tracking prompt before the first ad (already noted in the app README).
- **Age rating:** answer "Infrequent/Mild Cartoon or Fantasy Violence: None", "Unrestricted Web Access: No", "Gambling: No", "Contests: No". In-app purchases and ads are declared separately. Expect **4+**.
- **Kids category:** No.

## If you ship without ads at first
Delete section 5 of the policy, and in the summary replace the ads bullet with "No ads". Change "Do you collect data?" to **No**. Remove `NSUserTrackingUsageDescription` and the tracking prompt.

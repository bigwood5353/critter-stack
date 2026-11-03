// Android-only settings Expo has no app.json field for:
//  • the AdMob app ID (AdMob crashes the app at launch without it)
//  • portrait on phones (Android ignores this on tablets and foldables, where the game's landscape layout takes over)
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withCritterAndroid(config, props = {}) {
  const admobAppId = props.admobAppId || 'ca-app-pub-3940256099942544~3347511713';   // Google's sample app ID until the real one is set
  return withAndroidManifest(config, cfg => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'com.google.android.gms.ads.APPLICATION_ID', admobAppId);
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    main.$['android:screenOrientation'] = 'portrait';
    return cfg;
  });
};

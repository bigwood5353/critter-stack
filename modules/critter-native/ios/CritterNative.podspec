Pod::Spec.new do |s|
  s.name           = 'CritterNative'
  s.version        = '1.0.0'
  s.summary        = 'Native services for Critter Stack: Game Center, App Store purchases, iCloud backup, ads, haptics and reminders.'
  s.description    = s.summary
  s.author         = 'Critter Stack'
  s.homepage       = 'https://critterstack.app'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '17.0' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  # Google AdMob (SDK 12) and Google's consent form for EU/UK players
  s.dependency 'Google-Mobile-Ads-SDK', '~> 12.0'
  s.dependency 'GoogleUserMessagingPlatform', '~> 3.0'

  s.frameworks = 'GameKit', 'StoreKit', 'UserNotifications', 'WidgetKit', 'AVFoundation', 'AppTrackingTransparency'
  s.source_files = '**/*.{h,m,swift}'
end

// targets/watch/expo-target.config.js
// Apple Watch companion app, generated into the iOS project by
// @bacons/apple-targets at prebuild (EAS Build runs prebuild for us).
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'watch',
  name: 'CamelRanchWatch',
  displayName: 'Camel Ranch',
  // watchOS 10 runs on Apple Watch Series 4 and newer.
  deploymentTarget: '10.0',
  icon: '../../assets/images/icon.png',
  colors: { $accent: '#E8622C' },
  frameworks: ['SwiftUI', 'WatchConnectivity', 'WidgetKit'],
  // Shared with the watch-face complication on the same watch.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.camelranchbooking.app'],
  },
});

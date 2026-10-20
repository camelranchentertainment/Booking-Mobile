// targets/watch-complication/expo-target.config.js
// Watch-face complication ("Next show"), embedded in the watch app.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'watch-widget',
  name: 'CamelRanchComplication',
  displayName: 'Next Show',
  // Apple requires a watch extension's ID to sit under its watch app's ID.
  bundleIdentifier: '.watch.complication',
  deploymentTarget: '10.0',
  colors: { $accent: '#E8622C' },
  frameworks: ['WidgetKit', 'SwiftUI'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.camelranchbooking.app'],
  },
});

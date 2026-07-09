/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'kibo_widget',
  displayName: 'Kibo 今日',
  entitlements: {
    'com.apple.security.application-groups': ['group.app.kibo.fitness'],
  },
});

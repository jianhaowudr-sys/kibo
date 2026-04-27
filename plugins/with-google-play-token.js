/**
 * Expo config plugin: write Google Play Console package-name verification token
 * to android/app/src/main/assets/adi-registration.properties
 *
 * Required by Google Play 套件名稱擁有權驗證流程（2024+）
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TOKEN = 'CEUAD6UKPYG4GAAAAAAAAAAA';

const withGooglePlayToken = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const assetsDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'assets',
      );
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      const target = path.join(assetsDir, 'adi-registration.properties');
      fs.writeFileSync(target, TOKEN, 'utf8');
      console.log(`[with-google-play-token] wrote ${target}`);
      return config;
    },
  ]);
};

module.exports = withGooglePlayToken;

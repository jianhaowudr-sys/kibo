const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

// Workaround: expo-file-system v19 has no `exports` field, so /legacy subpath
// fails under unstable_enablePackageExports. Resolve it manually.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-file-system/legacy') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/expo-file-system/legacy.ts'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'expo-file-system/next') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/expo-file-system/next.ts'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });

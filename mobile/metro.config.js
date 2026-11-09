// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 웹 미리보기용: zustand 의 ESM 빌드에 있는 import.meta 가 웹 번들을 깨뜨리므로 웹에서는 CommonJS 빌드를 쓴다.
// (iOS 번들은 원래 CommonJS 빌드를 쓰므로 영향 없음)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (moduleName === 'zustand' || moduleName.startsWith('zustand/'))) {
    return { type: 'sourceFile', filePath: require.resolve(moduleName) };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

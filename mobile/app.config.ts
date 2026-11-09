import type { ExpoConfig } from 'expo/config';

/**
 * EAS Update(OTA) 프로젝트 id — `npx eas-cli init` 이 알려 주는 값을 넣는다.
 * 비워 두면 OTA 없이 앱에 들어 있는 번들만 쓴다.
 */
const EAS_PROJECT_ID = '';

/** TestFlight 빌드 번호 — GitHub Actions 가 run_number 로 넣는다 */
const BUILD_NUMBER = process.env.BUILD_NUMBER ?? '1';

/** 네이티브 패키지를 바꾸면 올린다 (runtimeVersion 이 바뀌어 이전 앱에는 OTA 가 가지 않는다) */
const VERSION = '1.0.0';

const config: ExpoConfig = {
  name: '단어장',
  slug: 'quiz-word',
  owner: 'swpark3179',
  version: VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'quizword',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    icon: { light: './assets/icon.png', dark: './assets/icon-dark.png', tinted: './assets/icon-tinted.png' },
    supportsTablet: false,
    bundleIdentifier: 'com.swpark3179.quizword2',
    buildNumber: BUILD_NUMBER,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      CFBundleDevelopmentRegion: 'ko',
    },
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-font',
    // expo-audio 는 발음 재생용 오디오 세션 설정에만 쓰지만, 네이티브 코드에 녹음 API 가 들어 있어
    // 마이크 사용 설명이 없으면 App Store Connect 가 빌드를 반려한다(ITMS-90683). 앱은 마이크 권한을 요청하지 않는다.
    ['expo-audio', { microphonePermission: '이 앱은 마이크를 사용하지 않습니다. (발음 재생용 오디오 모듈에 포함된 권한 문구)' }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 120,
        resizeMode: 'contain',
        backgroundColor: '#4F46E5',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#1E1B4B' },
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  runtimeVersion: { policy: 'appVersion' },
  ...(EAS_PROJECT_ID
    ? {
        updates: {
          url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
          requestHeaders: { 'expo-channel-name': 'production' },
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        },
        extra: { eas: { projectId: EAS_PROJECT_ID } },
      }
    : {}),
};

export default config;

import type { ExpoConfig } from 'expo/config';
import androidVersion from './android-version.json';

/**
 * EAS Update(OTA) 프로젝트 id — 지금은 OTA 를 쓰지 않아 비워 둔다(앱에 들어 있는 번들만 씀).
 * 단어는 단어 세트 파일로 갱신한다(설정 → 단어 세트). 나중에 OTA 를 쓰려면 `npx eas-cli init` 이 알려 주는 값을 넣는다.
 * expo-updates 패키지는 단어 세트를 바꾼 뒤 앱을 다시 시작하는 데(reloadAsync) 쓰므로 남겨 둔다.
 */
const EAS_PROJECT_ID = '';

/** TestFlight 빌드 번호 — GitHub Actions 가 run_number 로 넣는다 */
const BUILD_NUMBER = process.env.BUILD_NUMBER ?? '1';

/** 앱 버전 (iOS) — 네이티브 패키지를 바꾸면 올린다 */
const VERSION = '1.0.0';

/**
 * 안드로이드 버전은 android-version.json 에 따로 둔다 — GitHub Actions 의 Release 워크플로가 실행할 때마다
 * 버전 이름(version)을 올리고 versionCode 를 1 늘려 커밋한다. iOS 버전(VERSION · BUILD_NUMBER)과는 상관없다.
 * (파일의 versionCode 0 은 아직 한 번도 릴리즈하지 않았다는 뜻 — 로컬·미리보기 빌드는 1 로 만든다)
 */
const ANDROID_VERSION = androidVersion.version;
const ANDROID_VERSION_CODE = Math.max(1, androidVersion.versionCode);

/**
 * 미리보기 빌드 (안드로이드 전용, android-check.yml 이 APP_VARIANT=preview 로 만든다).
 * 패키지 이름과 앱 이름을 달리해, 정식 앱(Release · Play)과 나란히 설치할 수 있고 서명이 달라도 충돌하지 않는다.
 * iOS 워크플로는 이 변수를 주지 않으므로 iOS 빌드에는 영향이 없다.
 */
const PREVIEW = process.env.APP_VARIANT === 'preview';

const config: ExpoConfig = {
  name: PREVIEW ? '단어장 (미리보기)' : '단어장',
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
  android: {
    package: PREVIEW ? 'com.swpark3179.quizword2.preview' : 'com.swpark3179.quizword2',
    version: ANDROID_VERSION,
    versionCode: ANDROID_VERSION_CODE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-mono.png',
      backgroundColor: '#4F46E5',
    },
    // 쓰지 않는 권한을 뺀다 — 녹음(expo-audio 는 발음 재생용 오디오 설정에만 쓴다), 외부 저장소(파일은 앱 폴더와 시스템 파일 선택기로만 다룬다),
    // 다른 앱 위에 그리기(개발 빌드의 오류 화면용)
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
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

import type { ExpoConfig } from 'expo/config';
import appVersion from './app-version.json';

/**
 * EAS Update(OTA) 프로젝트 id — 지금은 OTA 를 쓰지 않아 비워 둔다(앱에 들어 있는 번들만 씀).
 * 단어는 단어 세트 파일로 갱신한다(설정 → 단어 세트). 나중에 OTA 를 쓰려면 `npx eas-cli init` 이 알려 주는 값을 넣는다.
 * expo-updates 패키지는 단어 세트를 바꾼 뒤 앱을 다시 시작하는 데(reloadAsync) 쓰므로 남겨 둔다.
 */
const EAS_PROJECT_ID = '';

/**
 * 앱 버전 (iOS · 안드로이드 공통) — app-version.json 의 version.
 * GitHub Actions 의 Release 워크플로가 실행할 때마다 올려 커밋하고, iOS TestFlight 워크플로는 올리지 않고 그대로 읽는다.
 * 그래서 Release 다음에 iOS TestFlight 를 돌리면 두 플랫폼이 같은 버전이 된다.
 */
const VERSION = appVersion.version;

/** iOS 빌드 번호 — iOS TestFlight 워크플로가 run_number 로 넣는다 (안드로이드 versionCode 와는 따로) */
const BUILD_NUMBER = process.env.BUILD_NUMBER ?? '1';

/**
 * 안드로이드 versionCode — app-version.json 의 versionCode. Release 워크플로가 릴리즈마다 1 씩 늘린다.
 * (파일의 versionCode 0 은 아직 한 번도 릴리즈하지 않았다는 뜻 — 로컬·미리보기 빌드는 1 로 만든다)
 */
const ANDROID_VERSION_CODE = Math.max(1, appVersion.versionCode);

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
    // 문제은행 앱과 단어 목록을 나누는 공유 폴더 (src/lib/sharedLexicon.ts). App ID 와 프로비저닝 프로파일에도
    // 같은 App Group 이 있어야 빌드된다 — README 의 '문제은행 연동' 참고
    entitlements: {
      'com.apple.security.application-groups': ['group.com.swpark3179.shared'],
    },
  },
  android: {
    package: PREVIEW ? 'com.swpark3179.quizword2.preview' : 'com.swpark3179.quizword2',
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
    // 안드로이드 릴리즈 빌드(Release 의 apk·aab, Android Check 의 미리보기 APK)를 R8 로 줄이고 난독화한다.
    // R8 의 가독화 파일(mapping.txt)은 aab 에 같이 들어가 Play Console 이 알아서 가져간다 — 비정상 종료·ANR 스택이 원래 이름으로 보인다.
    // 리소스 축소: JS 에서 require 한 이미지는 Expo CLI 가 만드는 res/raw/keep.xml 이 지켜 준다.
    // 릴리즈에서만 생기는 크래시(ClassNotFoundException 등)는 리플렉션으로 찾는 코드가 지워진 것 — 그 클래스를 extraProguardRules 에 -keep 으로 더한다.
    [
      'expo-build-properties',
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
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

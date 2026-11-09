# Quiz Word iOS 앱 (mobile/)

웹 단어장과 같은 단어 데이터·학습 로직을 쓰는 iPhone 앱입니다. TestFlight 내부 테스트로 본인만 설치해 씁니다.

- Expo SDK 54 (React Native 0.81) — App Store 의 Expo Go 가 지원하는 마지막 SDK라서, 개발 중에 iPhone 의 Expo Go 로 바로 확인할 수 있습니다.
- 단어 데이터는 앱에 들어 있어 오프라인으로 동작하고, 진행 기록은 기기 안(SQLite)에 저장됩니다.
- 웹에서 내보낸 진행 기록 JSON 을 그대로 가져올 수 있고, 그 반대도 됩니다 (설정 → 진행 기록).

## 구조

```
mobile/
  src/app/            화면 (expo-router)
    (tabs)/           오늘 · 단어장 · 학습 · 오답노트 (네이티브 탭)
    word/[id].tsx     단어 상세
    scope.tsx         범위 고르기 시트
    session/          플래시카드 · 객관식 · 복습 (전체 화면)
    settings.tsx
  src/components/     FlashSession(스와이프·뒤집기) · QuizSession · 공용 UI · 모션 조각
  src/theme/          디자인 토큰 · 모션 곡선 · 진동
  src/generated/      ← 자동 생성 (git 제외): 웹과 공용 로직(../src/lib) + 단어 데이터(../data)
  scripts/sync-shared.mjs   공용 로직·데이터 복사 (npm install / npm start 때 자동 실행)
  scripts/make-icons.mjs    아이콘·스플래시 생성
```

공용 로직(SRS, 오답 보기 생성, 플래시카드 대기열, 검색, 진행 기록 스토어)은 저장소 루트의 `src/lib` 에 있고, 웹과 앱이 함께 씁니다. **앱 쪽 `src/generated/` 는 고치지 말고 원본을 고치세요.**

## 개발 중 미리보기 (iPhone + Expo Go)

```bash
cd mobile
npm install
npm start          # QR 코드가 나오면 iPhone 카메라로 찍어 Expo Go 에서 연다
```

- iPhone 과 PC 가 같은 Wi-Fi 여야 합니다. 회사망에서 막히면 휴대폰 핫스팟에 PC 를 연결하거나 `npm run start:tunnel` 을 써 보세요.
- 웹 브라우저로 대충 볼 때: `npx expo start --web` (탭·아이콘·시트 모양은 iPhone 과 다릅니다)
- 검사: `npm run typecheck` · `npm run lint` · `npm run export:ios` (iOS 번들이 만들어지는지)

## 단어를 고쳤을 때 → OTA 업데이트 (TestFlight 재빌드 없이)

```bash
# 저장소 루트에서
npm run data:validate
# mobile 에서
cd mobile
npm run ota -- "단어 추가: idempotent"
```

앱을 한 번 껐다 켜면 새 데이터를 받아 두고, 다음 실행 때 적용됩니다. 바로 적용하려면 설정 → **업데이트 확인**.

- 화면 코드나 공용 로직을 고친 경우도 같은 방법으로 반영됩니다.
- **네이티브 패키지를 추가·변경한 경우**에는 `app.config.ts` 의 `VERSION` 을 올리고 TestFlight 를 다시 빌드해야 합니다 (runtimeVersion 이 바뀌어 이전 앱에는 OTA 가 가지 않습니다).
- OTA 는 Expo 서버(expo.dev)에 접속해야 합니다. 회사망에서 막히면 다른 네트워크에서 실행하세요.

## TestFlight 빌드

GitHub Actions → **iOS TestFlight** → Run workflow (또는 `gh workflow run ios-testflight.yml -f upload_testflight=true`).
Quiz-Bank 와 같은 방식(Expo prebuild → xcodebuild → altool)이며 macOS 러너에서 20~30분 걸립니다. 업로드 후 App Store Connect 처리(10~30분)가 끝나면 iPhone 의 TestFlight 앱에 나타납니다.

### 처음 한 번만 할 일 (체크리스트)

1. **Apple Developer** (developer.apple.com → Certificates, IDs & Profiles)
   - Identifiers → **App ID** 추가: `com.swpark3179.quizword2`
   - Profiles → **App Store** 배포 프로파일 생성 (기존 Apple Distribution 인증서 선택) → 다운로드
2. **App Store Connect** → 앱 → `+` 새로운 앱
   - 플랫폼 iOS, 번들 ID `com.swpark3179.quizword2`, SKU 아무 값, 이름은 App Store 전체에서 유일해야 함 (예: "Quiz Word SW")
   - TestFlight → 내부 테스트 그룹 만들고 본인 추가 (내부 테스트는 심사 없음)
3. **GitHub** 저장소(private 권장)를 만들고 이 폴더를 push → Settings → Secrets and variables → Actions 에 시크릿 등록
   - Quiz-Bank 와 같은 값: `IOS_P12_BASE64`, `IOS_P12_PASSWORD`, `IOS_KEYCHAIN_PASSWORD`, `IOS_TEAM_ID`, `IOS_CODE_SIGN_IDENTITY`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`
   - 새로 만든 값: `IOS_PROVISIONING_PROFILE_BASE64` (1번 프로파일 파일을 base64), `IOS_PROVISIONING_PROFILE_NAME` (프로파일 이름)
   - base64 만들기 (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("profile.mobileprovision")) | Set-Clipboard`
4. **Expo (OTA)**
   - `cd mobile && npx eas-cli@latest login` (계정 swpark3179)
   - `npx eas-cli@latest init` → 알려 주는 project id 를 `app.config.ts` 의 `EAS_PROJECT_ID` 에 붙여 넣기
   - 그다음 TestFlight 빌드를 한 번 해야 OTA 를 받을 수 있는 앱이 됩니다

private 저장소는 GitHub Actions macOS 무료 사용량이 월 약 200분(빌드 8~10회)이라, 평소 수정은 OTA 로 하고 네이티브가 바뀔 때만 빌드하세요.

## 디자인 메모

- 네이티브 탭(iOS 26 Liquid Glass), large title, 네이티브 검색창, 시트, SF Symbols, 시스템 폰트
- 웹과 같은 인디고 브랜드 색, 품사 색, 형광펜 예문 강조
- 모션: 플래시카드 드래그(회전·덧칠·도장) → 판정 시 3D 뒤집기 → 위로 날아가며 뒤 카드가 앞으로 오는 딜 모션, 객관식 정답 채움·오답 흔들림, count-up·진척 링. 모든 판정에 진동
- iPhone 의 "동작 줄이기"를 켜면 회전·뒤집기는 크로스페이드로, 흔들림은 색 변화로 바뀝니다
- 모션 시안(웹): `design/motion-prototype.html`

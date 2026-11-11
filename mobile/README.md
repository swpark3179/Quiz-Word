# Quiz Word iOS 앱 (mobile/)

웹 단어장과 같은 단어 데이터·학습 로직을 쓰는 iPhone 앱입니다. TestFlight 내부 테스트로 본인만 설치해 씁니다.

- Expo SDK 54 (React Native 0.81) — App Store 의 Expo Go 가 지원하는 마지막 SDK라서, 개발 중에 iPhone 의 Expo Go 로 바로 확인할 수 있습니다.
- 단어 데이터는 앱에 들어 있어 오프라인으로 동작하고, 진행 기록은 기기 안(SQLite)에 저장됩니다.
- 단어를 고치면 웹에서 **단어 세트 파일**을 내려받아 앱 설정에서 불러옵니다 (OTA·재빌드 없이). 아래 '단어를 고쳤을 때' 참고.
- 웹에서 내보낸 진행 기록 JSON 을 그대로 가져올 수 있고, 그 반대도 됩니다 (설정 → 진행 기록). 학습장 전체 목록도 함께 옮겨집니다.

## 구조

```
mobile/
  src/app/            화면 (expo-router)
    (tabs)/           오늘 · 단어장 · 학습 · 학습장 · 오답노트 (네이티브 탭)
      notebooks/      학습장 목록 · [id] 학습장 하나 (검색창으로 담기, 쓸어서 빼기, 플래시카드·객관식·문맥 뜻)
    word/[id].tsx     단어 상세
    scope.tsx         범위 고르기 시트
    notebook-merge.tsx  학습장 합치기 시트 (둘 이상 골라 겹치는 단어 없이 새 학습장, 기존 학습장 남겨두기/삭제)
    session/          플래시카드 · 객관식 · 복습 (전체 화면)
    settings.tsx
  src/components/     FlashSession(스와이프·뒤집기) · QuizSession · 공용 UI · 모션 조각
  src/lib/wordSet.ts  단어 세트 — 앱 기본(내장) 또는 불러온 파일(문서 폴더 wordset.json)을 켤 때 읽음
  src/theme/          디자인 토큰 · 모션 곡선 · 진동
  src/generated/      ← 자동 생성 (git 제외): 웹과 공용 로직(../src/lib) + 단어 데이터(../data/words, ../data/exams)
  scripts/sync-shared.mjs   공용 로직·데이터 복사 (npm install / npm start 때 자동 실행)
  scripts/make-icons.mjs    아이콘·스플래시 생성
```

공용 로직(SRS, 오답 보기 생성, 플래시카드 대기열, 검색, 진행 기록·학습장 스토어)은 저장소 루트의 `src/lib` 에 있고, 웹과 앱이 함께 씁니다. **앱 쪽 `src/generated/` 는 고치지 말고 원본을 고치세요.**

## 개발 중 미리보기 (iPhone + Expo Go)

```bash
cd mobile
npm install
npm start          # QR 코드가 나오면 iPhone 카메라로 찍어 Expo Go 에서 연다
```

- iPhone 과 PC 가 같은 Wi-Fi 여야 합니다. 회사망에서 막히면 휴대폰 핫스팟에 PC 를 연결하거나 `npm run start:tunnel` 을 써 보세요.
- 웹 브라우저로 대충 볼 때: `npx expo start --web` (탭·아이콘·시트 모양은 iPhone 과 다릅니다)
- 검사: `npm run typecheck` · `npm run lint` · `npm run export:ios` (iOS 번들이 만들어지는지)

## 단어를 고쳤을 때 → 단어 세트 파일 (빌드 없이)

1. 저장소 루트에서 `data/words/*.json`(사전)이나 `data/exams/`(시험별 예문·노트)를 고치고 `npm run data:validate`
2. 단어 세트 파일 만들기 — 둘 중 편한 것
   - 웹(`npm start`) → **설정 → 단어 세트 · iPhone 앱으로 보내기 → 단어 세트 파일 내려받기**
   - 터미널: `npm run data:pack` → `wordset/quiz-word-words-YYYYMMDD.json` (검사를 통과해야 만들어짐)
3. 파일을 AirDrop·iCloud Drive·메신저 등으로 iPhone 의 **파일** 앱에 옮긴다
4. 앱 → **설정 → 단어 세트 → 파일에서 불러오기** → 바뀌는 단어 수를 확인하고 **바꾸고 다시 시작**

- 단어 세트 파일(약 4.8MB)에는 공통 사전(`data/words`)과 시험 데이터(`data/exams` — 문제 파일 목록·출현 횟수·예문·문제 문장·노트)가 들어 있고, 불러오면 앱의 단어 **전체**가 이 파일로 바뀝니다.
- **파일 형식은 버전 2입니다.** 단어에서 시험 전용 정보를 떼어 내면서 바뀌었습니다.
  - 예전 빌드(버전 1만 아는 앱)는 새 파일을 "앱을 먼저 업데이트하세요"라며 받지 않습니다 → **새 TestFlight 빌드를 먼저 설치**한 뒤 파일을 옮기세요.
  - 기기에 예전(버전 1) 파일이 남아 있으면 새 앱은 그 파일을 쓰지 않고 앱 기본 단어로 열며, 설정 → 단어 세트에 이유를 보여 줍니다. 새 파일을 다시 불러오면 됩니다.
- 진행 기록·학습장은 단어 id 기준이라 그대로 이어집니다. 새 세트에서 빠진 단어의 기록은 지워지지 않고 숨겨져 있다가, 그 단어가 다시 들어오면 이어집니다.
- 설정 → 단어 세트에서 지금 쓰는 세트(앱 기본 / 불러온 파일, 만든 시각, 단어 수)를 볼 수 있고, **앱 기본 단어 세트로 되돌리기**도 됩니다. 새 TestFlight 빌드에 든 앱 기본 단어가 불러온 파일보다 최근이면 거기서 알려 줍니다.
- 불러온 파일은 기기 안 문서 폴더(`wordset.json`)에 저장되고, 앱이 켜질 때 읽습니다. 파일이 손상돼 읽지 못하면 앱 기본 단어로 열고 설정에 이유를 보여 줍니다.

## 화면·로직을 고쳤을 때 → TestFlight 빌드

OTA 는 쓰지 않으므로, 화면 코드나 공용 로직(`src/lib`)을 고치면 아래 **TestFlight 빌드**로 반영합니다. 빌드에는 그 시점의 `data/words` 가 앱 기본 단어로 함께 들어갑니다.

## 성능 메모

- 긴 목록(단어장·오답노트·학습장)은 FlashList 로 보이는 줄만 그리고, 줄은 자기 단어의 학습 상태만 구독합니다(판정 하나에 바뀐 줄 하나만 다시 그림).
- 보이지 않는 탭은 얼려 두고(`enableFreeze`), 세션을 띄운 오늘·학습 탭은 가려진 동안 계산을 멈춥니다(`useFocusSnapshot`).
- 진행 기록은 0.8초 동안 모아 한 번에 저장하고, 앱이 백그라운드로 가면 바로 씁니다.
- 판정 기록은 카드가 넘어가는 프레임 뒤에, 객관식 다음 문제는 해설을 보는 동안 미리 만듭니다.

## TestFlight 빌드

GitHub Actions → **iOS TestFlight** → Run workflow (또는 `gh workflow run ios-testflight.yml -f upload_testflight=true`).
Quiz-Bank 와 같은 방식(Expo prebuild → xcodebuild → altool)이며 macOS 러너에서 20~30분 걸립니다. 업로드 후 App Store Connect 처리(10~30분)가 끝나면 iPhone 의 TestFlight 앱에 나타납니다.

### 처음 한 번만 할 일 (체크리스트)

1. **Apple Developer** (developer.apple.com → Certificates, IDs & Profiles)
   - Identifiers → **App ID** 추가: `com.swpark3179.quizword2`
     (번들 ID 를 바꾸면 그 ID 로 App ID·프로파일을 다시 만들고 프로파일 시크릿 2개를 바꿔야 합니다. 워크플로가 빌드 전에 검사합니다)
   - Profiles → **App Store** 배포 프로파일 생성 (기존 Apple Distribution 인증서 선택) → 다운로드
2. **App Store Connect** → 앱 → `+` 새로운 앱
   - 플랫폼 iOS, 번들 ID `com.swpark3179.quizword2`, SKU 아무 값, 이름은 App Store 전체에서 유일해야 함 (예: "Quiz Word SW")
   - TestFlight → 내부 테스트 그룹 만들고 본인 추가 (내부 테스트는 심사 없음)
3. **GitHub** 저장소(private 권장)를 만들고 이 폴더를 push → Settings → Secrets and variables → Actions 에 시크릿 등록
   - Quiz-Bank 와 같은 값: `IOS_P12_BASE64`, `IOS_P12_PASSWORD`, `IOS_KEYCHAIN_PASSWORD`, `IOS_TEAM_ID`, `IOS_CODE_SIGN_IDENTITY`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`
   - 새로 만든 값: `IOS_PROVISIONING_PROFILE_BASE64` (1번 프로파일 파일을 base64), `IOS_PROVISIONING_PROFILE_NAME` (프로파일 이름)
   - base64 만들기 (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("profile.mobileprovision")) | Set-Clipboard`
   - Windows 에서 AES256 형식으로 내보낸 p12 도 워크플로가 macOS 가 읽는 형식(3DES/SHA-1)으로 자동 변환해 등록합니다.
   - `IOS_CODE_SIGN_IDENTITY`: p12 에 든 배포 인증서 이름. 보통 `Apple Distribution` 만 넣으면 됩니다 (따옴표·공백 없이, 전체 이름 `Apple Distribution: 이름 (TEAMID)` 도 가능).
     정확한 이름은 `certutil -dump cert.p12` (Windows, Subject 의 CN) 또는 `security find-identity -v -p codesigning` (Mac) 으로 확인합니다.
     `Apple Development`(개발용)는 안 되고, 1번 프로파일을 만들 때 고른 인증서와 같아야 합니다.
private 저장소는 GitHub Actions macOS 무료 사용량이 월 약 200분(빌드 8~10회)입니다. 단어만 바뀌었으면 빌드하지 말고 단어 세트 파일로 옮기세요.

## 디자인 메모

- 네이티브 탭(iOS 26 Liquid Glass), large title, 네이티브 검색창, 시트, SF Symbols, 시스템 폰트
- 웹과 같은 인디고 브랜드 색, 품사 색, 형광펜 예문 강조
- 모션: 플래시카드 드래그(회전·덧칠·도장) → 판정 시 3D 뒤집기 → 위로 날아가며 뒤 카드가 앞으로 오는 딜 모션, 객관식 정답 채움·오답 흔들림, count-up·진척 링. 모든 판정에 진동
- iPhone 의 "동작 줄이기"를 켜면 회전·뒤집기는 크로스페이드로, 흔들림은 색 변화로 바뀝니다
- 모션 시안(웹): `design/motion-prototype.html`

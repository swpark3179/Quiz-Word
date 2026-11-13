# Quiz Word 앱 (mobile/) — iOS · 안드로이드

웹 단어장과 같은 단어 데이터·학습 로직을 쓰는 휴대폰 앱입니다. iPhone 은 TestFlight 내부 테스트로 본인만 설치해 쓰고, 안드로이드는 GitHub Release 의 APK(또는 Play 내부 테스트)로 설치합니다 — 아래 [안드로이드](#안드로이드).

- Expo SDK 54 (React Native 0.81) — App Store 의 Expo Go 가 지원하는 마지막 SDK라서, 개발 중에 iPhone 의 Expo Go 로 바로 확인할 수 있습니다.
- 단어 데이터는 앱에 들어 있어 오프라인으로 동작하고, 진행 기록은 기기 안(SQLite)에 저장됩니다.
- 단어를 고치면 웹에서 **단어 세트 파일**을 내려받아 앱 설정에서 불러옵니다 (OTA·재빌드 없이). 아래 '단어를 고쳤을 때' 참고.
- 웹에서 내보낸 진행 기록 JSON 을 그대로 가져올 수 있고, 그 반대도 됩니다 (설정 → 진행 기록). 학습장 전체 목록도 함께 옮겨집니다.

## 구조

```
mobile/
  src/app/            화면 (expo-router)
    (tabs)/           오늘 · 단어장 · 학습 · 학습장 · 오답노트 (네이티브 탭 — 안드로이드는 _layout.android.tsx)
      notebooks/      학습장 목록 · [id] 학습장 하나 (검색창으로 담기, 쓸어서 빼기, 플래시카드·객관식·문맥 뜻)
    word/[id].tsx     단어 상세
    +native-intent.tsx  다른 앱이 연 주소 다듬기 (quizword://lookup → 단어장 탭) — 아래 '문제은행 앱과 함께 쓰기'
    scope.tsx         범위 고르기 시트
    notebook-merge.tsx  학습장 합치기 시트 (둘 이상 골라 겹치는 단어 없이 새 학습장, 기존 학습장 남겨두기/삭제)
    session/          플래시카드 · 객관식 · 복습 (전체 화면)
    settings.tsx
  src/components/     FlashSession(스와이프·뒤집기) · QuizSession · 공용 UI · 모션 조각
  src/lib/wordSet.ts  단어 세트 — 앱 기본(내장) 또는 불러온 파일(문서 폴더 wordset.json)을 켤 때 읽음
  src/lib/examPacks.ts 시험 팩 — 시험 하나를 지금 단어 위에 얹는 파일(문서 폴더 exampacks/)을 읽고 쓰기
  src/lib/sheet.ts    선택 메뉴 · 이름 입력창 (iOS 는 시스템 것, 안드로이드는 sheet.android.ts + DialogHost)
  src/lib/sharedLexicon.ts  문제은행이 읽을 단어 목록 내보내기 (iOS App Group · 안드로이드 ContentProvider)
  modules/lexicon-provider/  안드로이드 전용 로컬 모듈 — 단어 목록 ContentProvider (Kotlin)
  android-version.json  안드로이드 버전 (Release 워크플로가 올림)
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

## 시험을 하나 더할 때 → 시험 팩 (빌드 없이)

단어 세트 파일이 **단어 전체를 통째로 바꾸는** 것과 달리, 시험 팩(`*.exampack.json`)은 시험 하나를 **지금 단어 위에 더합니다**.

1. 시험 팩을 만든다 — 코딩 에이전트에게 문제 파일과 가이드(`https://swpark3179.github.io/Quiz-Word/exam-pack-guide.md`)를 주거나, 저장소의 시험이면 `npm run data:pack-exam -- --exam <id>`
2. 파일을 iPhone 의 **파일** 앱에 옮긴다
3. 앱 → **설정 → 시험 → 시험 팩 불러오기** → 새 단어 수·그대로 두는 단어 수를 확인하고 **추가하고 다시 시작**

- 이미 있는 단어의 뜻·단계·외우기는 바뀌지 않습니다. 그 시험의 예문이 쓰는 뜻이 없을 때만 뜻 하나가 덧붙습니다.
- 추가한 시험은 설정 → 시험 목록에서 눌러 **지울 수 있습니다**. 지우면 그 시험과, 그 시험에만 있던 단어가 빠집니다(진행 기록은 남아 있다가 다시 불러오면 이어집니다).
- 같은 id 의 시험이 이미 있으면(앱 기본 단어의 시험 포함) 그 시험만 팩의 것으로 바뀝니다. 팩을 지우면 원래대로 돌아갑니다.
- 불러온 팩은 문서 폴더의 `exampacks/<시험 id>.json` 에 저장되고, 앱이 켜질 때 기본 단어(내장 또는 불러온 단어 세트) 위에 차례로 얹습니다(`src/lib/examPacks.ts`). 그래서 **단어 세트를 바꾸거나 새 빌드를 깔아도 추가한 시험은 남습니다**.
- 파일 검사는 불러올 때 한 번 하고(웹의 검증기와 같은 코드), 켤 때는 다시 하지 않습니다.
- 설정 → 시험의 **시험 팩 만드는 법**은 안내 페이지(지시문 예시·파일 검사)를 브라우저로 열고, **가이드 주소 보내기**는 에이전트에게 줄 가이드 주소를 공유 시트로 보냅니다(복사·메시지·AirDrop). 주소는 `src/lib/examPacks.ts` 에 있습니다.

## 문제은행 앱과 함께 쓰기

문제은행(Quiz-Bank) 앱이 이 앱의 단어를 씁니다. 두 가지입니다.

**1. 등록 단어 목록 (문제은행의 '단어장 앱' 모드)** — 모바일 OS 는 앱끼리 보이지 않게 함수를 부르고 값을 돌려받을 수 없어서,
이 앱이 켜질 때 등록 단어 목록(`lexicon.json`)을 두 앱이 함께 읽는 곳에 써 둡니다(`src/lib/sharedLexicon.ts`, 형식은 `../src/lib/lexicon.ts`).
문제은행은 문제 텍스트를 공백으로 나눈 단어 배열을 이 목록과 맞춰 **등록된 단어만** 강조합니다.

- 담기는 것: id · 표제어 · 한 줄 뜻 · 품사 · 발음 · 변화형. 진행 기록 같은 개인 데이터는 넣지 않습니다.
- 단어 세트·시험 팩을 바꾸면 앱이 다시 시작되면서 목록도 새로 씁니다(바뀌지 않았으면 쓰지 않음). **이 앱을 한 번은 켜야** 목록이 생깁니다.
- iOS: App Group `group.com.swpark3179.shared` 공유 폴더의 `quiz-word/lexicon.json`. 두 앱의 App ID 에 같은 App Group 이 있어야 합니다(아래 체크리스트 1번). Expo Go 에서는 공유 폴더가 없어 아무것도 하지 않습니다.
- 안드로이드: 앱 문서 폴더의 `shared/lexicon.json` 을 `modules/lexicon-provider` 의 ContentProvider 가 읽기 전용으로 내보냅니다 —
  `content://com.swpark3179.quizword2.lexicon/lexicon.json` (미리보기 빌드는 `com.swpark3179.quizword2.preview.lexicon`).
  확인: `adb shell content read --uri content://com.swpark3179.quizword2.lexicon/lexicon.json`

**2. 단어 상세 열기** — 다른 앱이 이 주소를 열면 단어장 탭에서 그 단어를 찾습니다 (x-callback-url 방식).

```
quizword://lookup?word=<단어>&x-source=<앱 이름>&x-error=<결과 없음일 때 열 주소, 인코딩>
```

| 찾은 결과 | 이 앱 | 부른 앱에 |
|---|---|---|
| 표제어·변화형이 정확히 같음 (대소문자 무시, ran → run) | 단어장 탭 검색창에 단어 → 상세 화면 | 알리지 않음 (iOS 왼쪽 위 '◀ 앱 이름'으로 돌아감) |
| 비슷한 단어만 있음 | 단어장 탭 검색 결과 목록 | 알리지 않음 |
| 없음 | 단어장 탭 (찾는 단어가 없어요) | `x-error` 주소에 `errorCode=not_found&errorMessage=…&word=…` 를 붙여 연다 → 그 앱이 다시 앞으로 |

- `x-error` 는 아는 앱의 스킴(`quizbank`)만 엽니다 (`src/lib/wordLookup.ts` 의 `CALLBACK_SCHEMES`). 단어는 64자까지.
- 해 보기: iPhone Safari 주소창에 `quizword://lookup?word=escalate` / 안드로이드 `adb shell am start -a android.intent.action.VIEW -d "quizword://lookup?word=escalate"`. Expo Go 에서는 `exp://<PC IP>:8081/--/lookup?word=escalate`
- 링크가 올 때 플래시카드·객관식이 열려 있으면 단어장 탭으로 가면서 닫힐 수 있습니다 (진행 기록은 판정마다 저장되어 있음).

## 화면·로직을 고쳤을 때 → TestFlight 빌드 (안드로이드는 Release)

OTA 는 쓰지 않으므로, 화면 코드나 공용 로직(`src/lib`)을 고치면 아래 **TestFlight 빌드**(안드로이드는 [Release 워크플로](#배포-release-워크플로))로 반영합니다. 빌드에는 그 시점의 `data/words` 가 앱 기본 단어로 함께 들어갑니다.

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
   - Identifiers → **App Groups** 에 `group.com.swpark3179.shared` 를 만들고, 위 App ID 와 문제은행 App ID(`com.swpark3179.quizbank`) 의
     Capabilities 에서 **App Groups** 를 켜 이 그룹을 고릅니다 (문제은행과 단어 목록을 나누는 데 씀).
     이미 프로파일을 만든 뒤라면 프로파일을 **다시 만들어** 시크릿을 바꿔야 합니다 — 워크플로가 프로파일에 그룹이 있는지 빌드 전에 검사합니다
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

## 안드로이드

같은 코드로 안드로이드 앱도 만듭니다. iOS 빌드(TestFlight)와는 워크플로·버전이 따로라서 서로 영향을 주지 않습니다.

- iOS 전용인 것은 안드로이드용 구현이 따로 있습니다 — 파일 이름이 `*.android.tsx` 이거나 `Platform.OS` 로 갈립니다.
  - 아이콘: SF Symbols 대신 Material 아이콘 (`src/components/Icon.android.tsx` 의 대응표. **새 SF Symbol 을 쓰면 여기에도 한 줄 더하세요**)
  - 탭: 네이티브 탭 대신 기본 아래 탭 (`src/app/(tabs)/_layout.android.tsx`)
  - 선택 메뉴·이름 입력창: iOS 액션 시트·입력창 대신 앱 대화상자 (`src/lib/sheet.ts` · `sheet.android.ts` · `src/components/DialogHost.android.tsx`). 화면에서는 `showActionSheet` · `promptText` · `alertButtons` 를 씁니다
  - 헤더: large title·블러 없이 보통 헤더, 범위·합치기 시트는 아래에서 올라오는 화면 (`src/theme/index.ts` 의 `largeHeader` · `sheetOptions`)
  - 세션 화면에서 뒤로 가기를 누르면 그만할지 묻습니다 (`src/lib/useBackClose.ts`)
- 패키지 이름 `com.swpark3179.quizword2`. 버전은 `android-version.json` 에 있고 Release 워크플로가 올립니다 (`app.config.ts` 의 iOS `VERSION` 과 별개).
- 단어 세트·시험 팩·진행 기록 파일은 iPhone 과 같은 방법으로 옮깁니다 (Google Drive·메신저·USB 로 폰에 넣고 앱 설정에서 불러오기).
- 검사: `npm run export:android` (안드로이드 번들이 만들어지는지)

### 미리보기 APK (머지 전에 폰에서 확인)

PR 에서 `mobile/` · `src/lib/` · `data/` 가 바뀌면 **Android Check** 워크플로가 검사 후 미리보기 APK 를 만듭니다 (Actions → Android Check → Run workflow 로 직접 돌려도 됩니다).
실행 화면 맨 아래 **Artifacts → quiz-word-preview-apk** 를 내려받아 압축을 풀고 `quiz-word-preview.apk` 를 폰에 설치합니다.
이름이 "단어장 (미리보기)", 패키지가 `…quizword2.preview` 라서 정식 앱과 나란히 깔리고 기록도 따로입니다. 시크릿 없이 디버그 키로 서명한 것이라 배포용은 아닙니다. 빌드 시간을 줄이려고 arm64(요즘 휴대폰) 전용으로 만듭니다 — 정식 Release 의 APK 는 32비트 arm 도 포함합니다.

### 배포: Release 워크플로

GitHub Actions → **Release** → Run workflow → 버전 증가 기준(major / minor / patch)을 고릅니다.

1. Release 페이지의 가장 높은 버전에서 다음 버전을 정합니다 (처음이면 `v1.0.0`)
2. 검사(테스트·타입·린트) → `android-version.json` 에 버전 반영(versionCode +1) → Expo prebuild → 업로드 키로 서명한 **apk · aab** 빌드
3. `android-version.json` 을 기본 브랜치에 커밋하고, 그 커밋에 태그와 **Release 페이지**를 만들어 apk · aab 와 이전 버전 이후 PR 목록을 붙입니다
4. `upload_play` 를 켰으면 aab 를 Play Console **내부 테스트** 트랙에 올립니다

폰에서는 Release 페이지의 `Quiz-Word-<버전>.apk` 를 내려받아 설치합니다 (처음 한 번 "출처를 알 수 없는 앱 설치" 허용). 같은 키로 서명하므로 다음 버전은 덮어 설치됩니다.

- 빌드 도중 기본 브랜치에 다른 커밋이 들어오면 3번의 푸시가 거부되고 Release 도 만들어지지 않습니다 (빌드한 코드와 태그를 맞추기 위한 동작). 다시 실행하면 됩니다.
- 기본 브랜치에 보호 규칙이 있으면 `Contents: Read and write` 권한의 fine-grained PAT 를 `RELEASE_TOKEN` 시크릿으로 등록하세요.

### 처음 한 번만 할 일 — 서명 키

1. 업로드 키스토어 만들기 (JDK 의 keytool. **이 파일과 비밀번호를 잃으면 같은 앱으로 업데이트할 수 없으니** 저장소 밖에 안전하게 보관)
   `keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
2. Settings → Secrets and variables → Actions → **Secrets** 탭 → **New repository secret** 으로 등록
   - `ANDROID_KEYSTORE_BASE64` — 키스토어 파일의 base64. 키스토어가 있는 폴더의 PowerShell 에서:
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path "upload-keystore.jks"))) | Set-Clipboard`
     (`Resolve-Path` 를 빼면 .NET 이 PowerShell 의 현재 폴더가 아닌 다른 폴더에서 파일을 찾아 실패하고, 클립보드에는 예전 내용이 남습니다. 붙여 넣기 전에 긴 영문·숫자 한 줄인지 확인)
   - `ANDROID_KEYSTORE_PASSWORD` — 키스토어 비밀번호
   - `ANDROID_KEY_ALIAS` — 키 별칭 (위 명령대로면 `upload`)
   - `ANDROID_KEY_PASSWORD` — 키 비밀번호 (keytool 기본값인 PKCS12 키스토어면 키스토어 비밀번호와 같음)
   - **Variables 탭 · Environment secrets · Dependabot secrets 에 넣으면 Release 워크플로에 전달되지 않습니다.** Release 가 "전달되지 않은 서명 시크릿: …" 으로 멈추면 거기 찍힌 이름이 Repository secrets 목록에 똑같은 이름으로 있는지 확인하세요. 바로 다음 단계 "빠진 서명 시크릿 진단" 이 그 실행이 실제로 받은 시크릿 이름(값은 안 찍음)을 보여 주고, Variables 탭에 들어 있거나 비슷한 이름으로 등록된 경우를 짚어 줍니다
   - Release 는 Gradle 빌드 전에 키스토어 · 비밀번호 · 별칭이 서로 맞는지 먼저 확인하고, 틀리면 어느 시크릿이 문제인지 알려 주고 멈춥니다

여기까지 하면 Release 워크플로로 APK 배포가 됩니다.

### Play 내부 테스트 (선택)

1. [Play Console](https://play.google.com/console) 개발자 계정(등록비 1회)으로 **앱 만들기** — 패키지 이름은 첫 업로드 때 `com.swpark3179.quizword2` 로 정해지고 바꿀 수 없습니다
2. **첫 aab 는 직접 올립니다** (API 는 한 번도 올린 적 없는 앱에 올리지 못합니다): Release 페이지의 `Quiz-Word-<버전>.aab` 를 내려받아 테스트 → 내부 테스트 → 새 버전 만들기에 올리고, Play 앱 서명을 켜고, 테스터에 본인 계정을 넣습니다
3. 서비스 계정: Google Cloud 콘솔에서 서비스 계정을 만들고 JSON 키를 내려받은 뒤, Play Console → 사용자 및 권한에서 그 계정을 초대해 이 앱의 **출시 권한**(테스트 트랙 출시)을 줍니다. Google Cloud 프로젝트에서 *Google Play Android Developer API* 를 켭니다
4. JSON 키 파일 내용을 그대로 `PLAY_SERVICE_ACCOUNT_JSON` 시크릿에 넣습니다
5. Release 를 실행할 때 **upload_play** 를 켭니다

- 올린 버전은 기본으로 **초안(draft)** 상태입니다 — Play Console 의 내부 테스트에서 검토·출시를 눌러야 테스터에게 나갑니다. 앱이 아직 한 번도 검토를 통과하지 않았으면 API 가 초안만 받기 때문입니다.
  이후에는 저장소 변수(Settings → Secrets and variables → Actions → Variables) `PLAY_RELEASE_STATUS` 를 `completed` 로 두면 올리자마자 나갑니다.
- Play 업로드 단계는 Release 페이지를 만든 뒤에 돕니다. 여기서 실패해도 apk · aab 는 Release 에 있으니 aab 를 직접 올리면 됩니다.

## 디자인 메모

- 네이티브 탭(iOS 26 Liquid Glass), large title, 네이티브 검색창, 시트, SF Symbols, 시스템 폰트
- 헤더 오른쪽 버튼은 `HeaderIconButton`(44pt 정사각형)을 씁니다 — iOS 26 이 헤더 버튼을 유리 동그라미로 감싸므로, 버튼이 그보다 작으면 아이콘이 동그라미 안에서 치우칩니다
- 웹과 같은 인디고 브랜드 색, 품사 색, 형광펜 예문 강조
- 모션: 플래시카드 드래그(회전·덧칠·도장) → 판정 시 3D 뒤집기 → 위로 날아가며 뒤 카드가 앞으로 오는 딜 모션, 객관식 정답 채움·오답 흔들림, count-up·진척 링. 모든 판정에 진동
- iPhone 의 "동작 줄이기"를 켜면 회전·뒤집기는 크로스페이드로, 흔들림은 색 변화로 바뀝니다
- 모션 시안(웹): `design/motion-prototype.html`

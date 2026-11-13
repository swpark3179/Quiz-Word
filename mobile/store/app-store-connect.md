# App Store Connect 등록 정보 (iOS)

App Store Connect → 앱 → **배포** 탭의 1.0 버전 페이지와 **앱 정보** · **앱 개인정보 보호** 페이지에 넣을 값입니다.
글자 수는 App Store Connect 한도 기준입니다. 아래 `텍스트` 블록을 그대로 복사해 붙여 넣으면 됩니다.

> **먼저 할 일**: 이 PR 을 main 에 머지하면 Pages 워크플로가 `docs/` 를 올리고, 아래 지원 URL · 개인정보 처리방침 URL 이 열립니다.
> 두 주소가 브라우저에서 열리는 것을 확인한 다음 App Store Connect 에 넣으세요 (심사에서 주소가 안 열리면 반려됩니다).

## 한눈에 보기

| 항목 | 값 |
|---|---|
| 기본 언어 | 한국어 |
| 이름 (30자) | `단어장 - 시험 영어 단어 암기` (17자) — 아래 [이름](#이름-부제) 참고 |
| 부제 (30자) | `문제 속 문장과 어원으로 외우는 영단어` (21자) |
| 번들 ID | `com.swpark3179.quizword2` |
| 카테고리 | 기본 **교육**, 보조 **참고** |
| 가격 | 무료 (앱 내 구입 없음) |
| 연령 등급 | **4+** — 설문의 모든 항목 "없음"/"아니요" |
| 지원 URL | https://swpark3179.github.io/Quiz-Word/support.html |
| 마케팅 URL | 비워 둠 (선택 항목) |
| 개인정보 처리방침 URL | https://swpark3179.github.io/Quiz-Word/privacy.html |
| 앱 개인정보 보호 (데이터 수집) | **아니요, 이 앱에서 데이터를 수집하지 않습니다** |
| 저작권 | `2026 swpark3179` (실명이나 다른 표기를 쓰려면 바꾸세요) |
| 로그인 필요 | 체크 해제 (계정 없음) |
| 수출 규정 준수 | 질문 없음 — `ITSAppUsesNonExemptEncryption: false` 가 `app.config.ts` 에 이미 있음 |
| 스크린샷 | iPhone 6.9" 3장 (필수는 1장) — [스크린샷](#스크린샷) |
| 앱 미리보기(동영상) | 넣지 않음 (선택 항목) |
| 출시 방식 | "이 버전을 수동으로 출시" 권장 — 승인 후 원할 때 출시 |

## 이름 · 부제

**이름**

```text
단어장 - 시험 영어 단어 암기
```

**부제**

```text
문제 속 문장과 어원으로 외우는 영단어
```

- 홈 화면에 보이는 이름은 `app.config.ts` 의 `name` 인 **단어장** 입니다. App Store 이름이 이것과 동떨어지면(예: "Quiz Word SW") 가이드라인 2.3.8(기기에 보이는 이름과 스토어 이름이 충분히 일치해야 함)로 반려될 수 있어, 스토어 이름을 `단어장` 으로 시작하게 했습니다.
- 이름은 App Store 전체에서 유일해야 합니다. 이미 쓰는 이름이라고 나오면 뒷부분만 바꿉니다 (예: `단어장 - 시험 문제 영단어`).
- TestFlight 때 만든 앱 레코드의 이름이 다르면, 1.0 버전 페이지(또는 앱 정보)에서 바꿀 수 있습니다.

## 프로모션 텍스트 (170자)

심사 없이 언제든 바꿀 수 있는 문구입니다. 설명 위에 나옵니다. (92자)

```text
시험 문제에 실제로 나온 영어 단어를 그 문제 속 문장과 함께 익히세요. 어원·연상 카드, 문맥 뜻 퀴즈, 시험일에 맞춘 복습 일정까지 — 가입 없이, 인터넷 없이.
```

## 설명 (4,000자)

(1,130자)

```text
시험 문제에 나온 영어 단어를, 그 단어가 나온 문제 속 문장과 함께 익히는 단어장입니다.
단어 뜻만 외우는 대신 "시험에서 이 뜻으로 이렇게 쓰였다"를 함께 보여 주어, 여러 뜻을 가진 단어도 문맥으로 구분할 수 있게 돕습니다.

■ 문제 속 뜻과 예문
· 단어마다 시험 문제에 실제로 나온 문장과 한국어 해석, 출처 문제를 보여 줍니다
· 같은 단어라도 문제에서 쓰인 뜻별로 예문을 나눠 보여 줍니다
· 어느 문제 파일에 몇 번 나왔는지도 한눈에 확인합니다

■ 어원과 연상으로 외우기
· 어원 조각(접두사·어근·접미사), 어원으로 그린 장면, 발음 연상, 같은 어근 단어
· 플래시카드 뒷면과 단어 상세 화면에서 바로 확인합니다

■ 여러 가지 학습 방법
· 플래시카드 — 밀어서 안다/모른다, 모른 카드는 몇 장 뒤에 다시 나옵니다
· 객관식 — 단어 → 뜻, 그리고 시험 문장 속 의미를 고르는 '문맥 뜻'
· 오답 보기는 같은 품사·비슷한 뜻에서 골라, 헷갈리는 단어까지 구분하게 합니다
· 시험 → 문제 파일 → 난이도 단계로 범위를 골라 학습합니다

■ 시험일에 맞춘 복습
· FSRS 간격 반복 알고리즘이 오늘 복습할 단어를 정해 줍니다
· 시험일을 정하면 복습 간격이 시험일을 넘지 않아, 시험 전에 모든 단어를 한 번 더 봅니다
· 오늘 탭에서 복습할 단어, 새 단어, 진척률, 최근 7일 학습량을 확인합니다

■ 오답노트와 학습장
· 틀린 단어는 오답노트에 자동으로 모이고, 연속으로 맞히면 빠집니다
· 원하는 단어만 모은 학습장을 만들고, 여러 학습장을 하나로 합칠 수 있습니다

■ 단어 2,121개 · 6단계 난이도
· 초등 수준부터 전문·기술 용어까지 1~6단계로 나눈 단어
· AI·소프트웨어 개발 분야 영어 시험 문제에서 뽑은 단어와 예문이 기본으로 들어 있습니다
· 시험 팩 파일을 불러와 다른 시험의 단어와 예문을 더할 수 있습니다

■ 발음
· 기기에 내장된 음성으로 인터넷 없이 발음을 듣습니다
· 카드가 나올 때 자동 발음, 고품질 영어 목소리 선택

■ 가입 없이, 인터넷 없이
· 학습 기록은 기기 안에만 저장되며, 어떤 개인정보도 수집하지 않습니다
· 광고가 없습니다
· 학습 기록을 파일로 내보내 다른 기기로 옮길 수 있습니다
· 다크 모드와 '동작 줄이기'를 지원합니다
```

## 키워드 (100자)

쉼표로 나누고 띄어쓰기 없이 씁니다. 이름·부제에 이미 있는 낱말(단어장, 시험, 영어, 단어, 암기, 문제, 문장, 어원, 영단어)은 검색에 이미 잡히므로 뺐습니다. (67자)

```text
플래시카드,간격반복,복습,오답노트,객관식,퀴즈,연상,발음,예문,어휘,보카,자격증,IT영어,개발자,기술영어,다의어,FSRS
```

## 지원 URL · 개인정보 처리방침 URL

| 칸 | 주소 | 파일 |
|---|---|---|
| 지원 URL | https://swpark3179.github.io/Quiz-Word/support.html | `docs/support.html` |
| 개인정보 처리방침 URL | https://swpark3179.github.io/Quiz-Word/privacy.html | `docs/privacy.html` |

- 둘 다 한국어 본문 아래에 영어 본문이 있습니다 (심사자용).
- 지원 페이지의 문의 창구는 이 저장소의 **GitHub Issues** 입니다 (저장소가 공개이고 Issues 가 켜져 있어야 함). 이메일 문의도 받으려면 `docs/support.html` 의 "문의하기" 상자에 주소를 더하세요.
- 개인정보 처리방침 URL 은 **앱 개인정보 보호** 페이지(그리고 앱 정보)에 넣습니다.

## 앱 개인정보 보호 (개인정보 '영양 성분표')

**데이터 수집** → "아니요, 이 앱에서 데이터를 수집하지 않습니다" 를 고르고 게시합니다. 근거:

- 서버·계정이 없고 네트워크 요청을 하지 않음 (`fetch` 없음 — 설정의 안내 페이지 링크를 브라우저로 여는 것뿐)
- 광고·분석·충돌 보고 SDK 없음, 추적(ATT) 없음
- 학습 기록은 기기 안 SQLite 에만 저장, 발음은 기기 내장 음성 합성
- 문제은행 앱에 나누는 단어 목록(App Group)은 기기 밖으로 나가지 않고 개인 데이터가 없음 → Apple 기준의 "수집"이 아님

## 앱 심사 정보 — 메모 (영문)

**로그인 필요**는 체크 해제. **연락처 정보**(이름 · 전화 · 이메일)는 심사팀만 보는 칸이니 직접 적으세요. 아래를 **메모**에 붙여 넣습니다 (2,957자 · 한도 4,000자).

```text
Thank you for reviewing this app.

OVERVIEW
"단어장" (Quiz Word) is an offline English vocabulary app for Korean learners preparing for an English-language exam. Each word is shown with the sentences it appears in within the exam questions, a Korean translation, etymology/mnemonic hints, flashcards, multiple-choice quizzes and spaced-repetition review (FSRS). The UI is in Korean; the vocabulary is English.

NO ACCOUNT, NO NETWORK
- No sign-in or account. Every feature is available immediately after launch.
- All content (2,121 words) is bundled in the app; it works fully offline.
- No data is collected. Progress is stored only on the device. No ads, analytics or tracking SDKs. No in-app purchases.

HOW TO TRY THE MAIN FEATURES (tab names in Korean)
1. 오늘 (Today, 1st tab): tap "복습 시작" (Start review) to begin a flashcard review session.
2. 학습 (Study, 3rd tab): choose 플래시카드 (Flashcards), 객관식 (Multiple choice) or 문맥 뜻 (Meaning in context), then tap "N개 시작하기" (Start N words) at the bottom of the sheet.
   - Flashcards: tap 안다 (I know) / 모른다 (I don't know) or swipe; the back shows meanings, mnemonics and example sentences.
3. 단어장 (Words, 2nd tab): search or tap any word to open its detail page. The speaker icon plays the pronunciation using the built-in iOS speech synthesizer.
4. 학습장 (Notebooks, 4th tab) and 오답노트 (Mistakes, 5th tab) collect words chosen by the user or answered incorrectly.
5. Settings: gear icon at the top right of the 오늘 (Today) tab.

OPTIONAL FILE IMPORT (not required to use the app)
In Settings, users can import JSON files they made themselves through the system document picker:
- 시험 팩 불러오기 (Import exam pack): adds one exam's words and example sentences. A small sample file can be downloaded here and saved to the Files app to test it:
  https://swpark3179.github.io/Quiz-Word/example.exampack.json
- 단어 세트 (Word set) and 진행 기록 가져오기/내보내기 (Import/export progress) use the same picker and the system share sheet.
The app only reads the file the user picks; nothing is uploaded.

MICROPHONE USAGE DESCRIPTION
The app never requests or uses the microphone. NSMicrophoneUsageDescription is present only because the bundled audio module (expo-audio, used to configure audio playback for pronunciation) contains recording APIs, and App Store Connect requires the string for that (ITMS-90683). No microphone permission prompt is ever shown.

APP GROUP AND URL SCHEME
- App Group "group.com.swpark3179.shared": on launch the app writes its word list (headwords, meanings, part of speech, pronunciation; no personal data) to the shared container so that the same developer's companion quiz app can highlight registered words. This never leaves the device.
- URL scheme "quizword://lookup?word=<word>" opens the Words tab with that word, for the companion app. Example: quizword://lookup?word=escalate

EXTERNAL LINK
Settings > 시험 > "시험 팩 만드는 법" opens the developer's GitHub Pages guide in Safari.

The app supports iPhone only.
```

## 스크린샷

`mobile/store/screenshots/iphone-6.9/` — App Store Connect 의 **iPhone 6.9" 디스플레이** 칸에 1 → 2 → 3 순서로 끌어다 놓습니다.

| 파일 | 크기 | 화면 | 문구 |
|---|---|---|---|
| `01-flashcard.png` | 1320 × 2868 | 플래시카드 뒷면 (뜻 · 외우기 · 문제 속 쓰임) | 어원과 연상으로 오래 남는 단어 |
| `02-context-quiz.png` | 1320 × 2868 | 문맥 뜻 객관식 — 정답과 해설 | 시험 문장 속에서 뜻을 고르세요 |
| `03-word-detail.png` | 1320 × 2868 | 단어 상세 (여러 뜻 · 어원 · 예문) | 뜻 · 외우기 · 예문을 한 화면에 |

- **필요한 크기는 6.9" 하나뿐입니다.** 6.9" 를 올리면 더 작은 iPhone 크기는 App Store 가 줄여서 씁니다. `supportsTablet: false` 라서 iPad 스크린샷은 필요 없습니다.
- **최소 개수는 1장**입니다. 1장만 올린다면 `01-flashcard.png` 를 올리세요. 3장은 앱의 세 가지 핵심(외우기 카드 · 문맥 퀴즈 · 단어 상세)을 보여 주는 최소 구성입니다.
- PNG · RGB(알파 채널 없음)로 저장되어 있습니다.
- **만든 방법**: 앱의 실제 화면 코드와 단어 데이터를 Expo 웹 렌더러로 그려 440 × 860pt(@3x)로 캡처하고, 상태 표시줄 · 기기 테두리 · 문구를 합성했습니다. 그래서 iPhone 과 조금 다른 점이 있습니다 —
  아이콘이 SF Symbols 대신 비슷한 Material 아이콘이고, 단어 상세의 헤더(뒤로 · 제목 · 발음 버튼)는 iOS large title 모양으로 다시 그렸습니다.
  똑같은 화면으로 바꾸고 싶으면 6.9" iPhone(16 Pro Max · 17 Pro Max 등, 화면 캡처가 그대로 1320 × 2868)에서 TestFlight 빌드로 같은 화면을 찍어 바꿔 올리면 됩니다.

### 앱 미리보기 (동영상)

선택 항목이라 **넣지 않습니다**. 넣는다면 15~30초, 6.9" 용 886 × 1920(세로), 실제 앱에서 녹화한 화면이어야 합니다.

## 그 밖의 칸

**앱 정보 → 콘텐츠 권한** — "앱에 제3자 콘텐츠가 포함되어 있거나, 표시하거나, 접근합니까?"
앱 기본 데이터에 시험 문제 문장(`data/exams/ccar-f/sentences`)이 들어 있습니다. 문장의 원저작자가 따로 있다면 "예"를 고르고 그 콘텐츠를 쓸 권리가 있음을 확인해야 합니다.
**공개 배포 전에 이 문장들을 앱에 넣어 배포할 권리가 있는지 확인하세요** — 권리가 없는 제3자 콘텐츠는 가이드라인 5.2(지적 재산권)로 반려되거나 나중에 삭제될 수 있습니다.
같은 이유로 설명 · 키워드에는 특정 시험 이름이나 상표를 넣지 않았습니다 (주관사와 관계가 있는 앱으로 보이면 5.2.1 반려 사유가 됩니다).

**연령 등급 설문** — 아래는 모두 "없음" 또는 "아니요" → 4+

- 폭력 · 성적 콘텐츠 · 비속어 · 공포 · 약물 · 도박 · 의료 정보 등: 없음
- 사용자 생성 콘텐츠 · 메시지/채팅 · 광고 · 제한 없는 웹 접근 · 자녀 보호 기능: 아니요 (안내 페이지 링크는 Safari 로 열 뿐, 앱 안 브라우저가 없음)

**이 버전의 새로운 기능** — 첫 버전에는 나오지 않습니다.

## 제출 전 체크리스트

- [ ] 이 PR 머지 → Actions 의 **Pages** 성공 → 지원 · 개인정보 처리방침 URL 이 열리는지 확인
- [ ] 앱 정보: 이름 · 부제 · 카테고리(교육/참고) · 콘텐츠 권한 · 연령 등급(4+) · 개인정보 처리방침 URL
- [ ] 앱 개인정보 보호: "데이터를 수집하지 않습니다" 게시
- [ ] 가격 및 사용 가능 여부: 무료, 판매 국가
- [ ] 1.0 버전: 스크린샷 · 프로모션 텍스트 · 설명 · 키워드 · 지원 URL · 저작권
- [ ] 빌드: TestFlight 에 올라간 빌드 선택 (iOS **TestFlight** 워크플로로 만든 것)
- [ ] 앱 심사 정보: 로그인 필요 해제, 연락처, 메모
- [ ] 기본 데이터의 시험 문제 문장을 배포할 권리 확인 (위 "콘텐츠 권한")

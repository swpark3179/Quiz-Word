# Quiz Word — CCAR-F 영어 단어장

CCAR-F 문제 파일(`Quiz-Bank/assets/quiz-data/ccar-f`)에 나온 영어 단어를 문제 속 뜻·예문과 함께 익히는 로컬 단어장입니다.

## 실행

```bash
npm install   # 처음 한 번
npm start     # http://localhost:5179 이 브라우저로 열립니다
```

또는 `start.cmd` 를 더블클릭합니다.

> 진행 기록(복습 일정·오답노트·통계)은 브라우저 localStorage 에 **localhost:5179** 기준으로 저장됩니다.
> 포트를 바꾸거나 다른 브라우저를 쓰면 기록이 보이지 않으니, 옮길 때는 **설정 → 진행 기록 내보내기/가져오기**를 쓰세요.

## 기능

| 화면 | 내용 |
|------|------|
| 홈 | 오늘 복습할 단어·새 단어·오답 수, 문제 파일별 진척, 최근 7일 학습량 |
| 단어장 | 영어·한글 뜻 검색(`/` 키), 문제 파일·품사·학습 상태·핵심/확장 필터 |
| 단어 상세 | 품사·발음기호·🔊 발음, 사전 뜻, **문제 속 뜻별 예문**(원문 + 해석 + 출처 문제), 기존 단어장 노트 |
| 플래시카드 | 단어 → 안다/모른다 → 상세 → 다음. 모른 카드는 4~6장 뒤에 다시 나옴 |
| 객관식 | 단어 → 뜻 / **문맥 뜻**(예문 속 다의어) — 오답 보기는 같은 품사·비슷한 뜻 분류에서 고름 |
| 복습 | FSRS 간격 반복. 시험일을 정하면 간격이 시험일을 넘지 않음 |
| 오답노트 | 틀린 단어 모음. 연속 2번 맞히면 자동으로 빠짐 (설정 가능) |

키보드: 플래시카드 `←`/`1` 모른다 · `→`/`2` 안다 · `Space` 다음 · `↓` 판정 바꾸기 · `P` 발음 / 객관식 `1`~`5` 선택 · `Enter` 다음

## iPhone 앱

`mobile/` 에 같은 단어·학습 로직을 쓰는 iOS 앱(Expo)이 있습니다. TestFlight 로 설치하고, 단어를 고치면 OTA 로 반영합니다.
자세한 내용은 [mobile/README.md](mobile/README.md) 를 보세요. 웹과 앱의 진행 기록은 설정의 내보내기/가져오기로 옮길 수 있습니다.

## 단어 직접 추가·수정

단어는 `data/words/{첫 글자}.json` 에 있습니다(예: `escalate` → `data/words/e.json`). 배열에 항목을 추가하면 개발 서버가 바로 다시 읽습니다.

**최소 항목**

```json
{
  "id": "idempotent",
  "word": "idempotent",
  "pos": "형용사",
  "meaning": "멱등의 — 여러 번 실행해도 결과가 같은",
  "short": "멱등의",
  "domain": "상태·성질"
}
```

- `contexts` 를 적지 않으면 CCAR-F 문제 문장(`data/corpus.json`)에서 이 단어가 나온 문장을 **자동으로 예문으로 붙입니다**.
- 고친 뒤 검사: `npm run data:validate`

**전체 필드**

| 필드 | 필수 | 설명 |
|------|:---:|------|
| `id` | ✅ | 소문자·숫자·하이픈. 진행 기록의 키라서 **바꾸면 그 단어의 기록이 끊깁니다** |
| `word` | ✅ | 표제어 (여러 단어 구도 가능) |
| `pos` | ✅ | 품사 배열 또는 `"명사·동사"` 문자열 — 명사, 동사, 형용사, 부사, 전치사, 접속사, 대명사, 한정사, 감탄사, 약어, 명사구, 동사구, 형용사구, 부사구, 전치사구 |
| `meaning` | ✅ | 사전식 한 줄 뜻 (`① … ② …`) |
| `short` | | 객관식 보기에 쓰는 짧은 뜻 (영어 없이 15자 안팎). 없으면 meaning 에서 만듦 |
| `domain` | | 의미 분류 (`src/lib/schema.ts` 의 `DOMAINS`). 오답 보기를 비슷한 뜻에서 고르는 데 씀. 없으면 `일반` |
| `ipa` | | 발음기호 (`/` 없이) |
| `senses` | | `[{ "pos": "동사", "ko": "다루다" }, …]` 여러 뜻 |
| `contexts` | | `[{ "src", "q", "en", "surface", "pos", "sense", "ko" }]` 문제 속 뜻 + 예문. `sense` 는 senses 의 `ko` 중 하나 |
| `forms` | | 변화형·파생어 (검색·예문 찾기에 사용) |
| `synonyms` | | 영어 유의어 (객관식에서 정답과 겹치지 않게 오답 보기에서 뺌) |
| `tier` | | `core`(CCAR-F 등장) / `extra`(확장). 없으면 `extra` |
| `basic` | | 쉬운 기초 단어면 `true` — 기본 학습 범위에서 빠짐 |
| `freq`, `sources` | | 문제 등장 횟수·파일 (생성 스크립트가 채움) |
| `note` | | 마크다운 노트 |

## 데이터를 다시 만들 때 (파이프라인)

문제 파일이 바뀌어 처음부터 다시 만들 때만 필요합니다. 원본 위치는 `QUIZ_DATA_DIR` 환경 변수로 바꿀 수 있습니다.

1. `npm run data:extract` — 문제 파일에서 문장과 단어 원형을 뽑음 → `pipeline/work/`
2. `npx tsx scripts/build-batches.ts` / `npx tsx scripts/build-batches-b.ts` — LLM 생성용 배치 입력
3. 배치마다 `pipeline/prompts/passA.md`(단어 정보·문맥 뜻), `passB.md`(문장 해석) 지시대로 생성 → `pipeline/work/gen/`
4. `npm run data:merge` — vocab + 생성 결과를 합쳐 `data/` 를 새로 씀 (**직접 고친 내용은 덮어써지니 주의**)
5. `npm run data:validate`
6. 앱에 반영: `cd mobile && npm run ota -- "데이터 갱신"`

## 개발

- `npm test` — 단위 테스트 (오답 보기 생성, 플래시카드 대기열, SRS, 검색, 문장 분리)
- `npx tsx scripts/smoke.ts` — 개발 서버를 띄운 상태에서 설치된 Edge 로 주요 화면을 눌러 보고 스크린샷 저장
- 스택: Vite + React 19 + TypeScript, Tailwind CSS v4, zustand(localStorage), ts-fsrs, Pretendard

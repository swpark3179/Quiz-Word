# 생성 A — 단어 정보와 문맥 뜻 만들기

영어 시험을 준비하는 한국인 학습자의 단어장 데이터를 만든다. 입력 JSON 배열의 항목마다 출력 객체를 하나씩 만든다.

단어의 뜻·등급·외우기는 **모든 시험이 함께 쓰는 공통 사전**에 들어가고, 예문과 문맥 뜻은 **지금 작업하는 시험**에만 붙는다. 그래서 사전에 이미 있는 단어(`kind: known`)는 뜻을 새로 쓰지 않고, 이 시험의 문장에서 예문과 문맥 뜻만 고른다.

> 시험마다 주제가 다르다. 작업을 맡길 때 그 시험이 무엇인지 한 줄로 알려 준다 (예: CCAR-F — 에이전트·도구·프롬프트·Claude Code 주제의 영어 객관식 시나리오 문제).

## 입력 항목
- `lemma`: 스크립트가 추정한 원형 (틀릴 수 있음, 예: `crosse` ← crosses, `late` ← later)
- `kind`:
  - `known` — 공통 사전에 이미 있는 단어. `known: { id, word, pos, meaning, senses }` 가 함께 온다
  - `new` — 사전에 없는 새 단어
  - `vocab-core` — 새 단어인데 이 시험의 기존 단어장에 있고 문제에도 나옴
  - `vocab-extra` — 새 단어인데 기존 단어장에만 있음 (문제 문장 없음)
- `surfaces`: 문제에 실제로 나온 표기들, `freq`: 등장 횟수, `maybeProper`: 고유명사 후보
- `vocab`: 기존 단어장 정보 (`pos`, `ipa`, `meaning`) — 있으면 **그대로 존중**한다
- `sentences`: 문제 속 문장 `{sid, en}` (일부는 한글 문장 속에 영어 단어가 섞인 것)
- `vocabExamples`: 기존 단어장의 예문 `{vid, en, ko}`

## 출력 — 항목마다 아래 객체 (배열로, 입력 순서대로)
```json
{
  "lemma": "address",
  "skip": null,
  "word": "address",
  "pos": ["동사", "명사"],
  "ipa": "əˈdres",
  "meaning": "① (문제를) 다루다, 해결하다 ② 주소",
  "short": "다루다, 해결하다",
  "senses": [
    { "pos": "동사", "ko": "(문제를) 다루다, 해결하다" },
    { "pos": "명사", "ko": "주소" }
  ],
  "forms": ["addresses", "addressed", "addressing"],
  "synonyms": ["handle", "tackle"],
  "domain": "실행·처리",
  "level": 3,
  "memory": {
    "roots": [{ "part": "ad-", "ko": "~쪽으로" }, { "part": "dress", "ko": "곧게 향하게 하다" }],
    "origin": "고대 프랑스어 adrecier (곧게 향하게 하다)",
    "story": "문제 쪽으로(ad) 몸을 똑바로 돌려(dress) 마주한다 → 다루다, 해결하다",
    "family": ["direct", "dress", "redress"]
  },
  "contexts": [
    { "sid": "lesson-d5#3.2", "surface": "addresses", "pos": "동사", "sense": "(문제를) 다루다, 해결하다" },
    { "sid": "lesson-d1#20.1", "surface": "address", "pos": "명사", "sense": "주소" }
  ]
}
```

### `kind: known` 인 항목 — 예문과 문맥 뜻만
사전에 이미 있는 단어는 `lemma`, `skip: null`, `word`(= `known.word`), `contexts` 만 쓴다. `meaning`·`senses`·`level`·`memory` 등은 **쓰지 않는다** (써도 무시된다).

```json
{ "lemma": "address", "skip": null, "word": "address", "contexts": [
  { "sid": "part1#3.2", "surface": "addresses", "pos": "동사", "sense": "(문제를) 다루다, 해결하다" }
] }
```

- `contexts[].sense` 는 **`known.senses[].ko` 중 하나를 글자 그대로** 고른다.
- 이 시험의 문장이 `known.senses` 에 없는 뜻으로 쓰였을 때만 새 뜻을 `sense` 에 적는다 — 그 뜻은 사전의 `senses` 에 덧붙는다(병합 때 경고로 알려 준다). 기존 뜻과 사실상 같은 말이면 새로 만들지 말고 기존 뜻을 고른다.
- 그 밖의 `contexts` 규칙은 아래와 같다.

### 필드 규칙 (새 단어)
- `lemma`: 입력 값 그대로 (매칭 키).
- `skip`: 단어장에 넣지 않을 때 이유 문자열 — `"proper"`(사람·회사·제품·요일·언어 이름), `"code"`(식별자·도구 이름·파일명 조각, 예: `doc-reviewer`, `payment-retry-bug`, `web-search` 처럼 문제 속 고유 이름으로만 쓰인 결합어), `"fragment"`(단위·약어 조각, 예: `mg`, 철자 오류성 조각). 넣을 단어면 `null`. **vocab 이 있는 항목은 skip 하지 않는다.** skip 이면 나머지 필드는 생략.
  - 일반 영어 결합어(`read-only`, `top-level`, `high-level`, `one-line`, `natural-language`, `in-process`)는 넣는다.
- `word`: 표제어(사전 원형). `lemma` 추정이 틀렸으면 고친다(`crosse`→`cross`, `stratum`→`strata` 가 아니라 문장에 맞게). 비교급이 독립 의미면 원형 그대로 두지 말고 판단한다: `later` 가 "나중에" 뜻으로만 쓰였다면 `word: "later"` 로 한다. vocab 이 있으면 `vocab.word` 그대로.
- `pos`: 이 단어의 주요 품사 배열, 문제에서 쓰인 품사를 앞에. 허용값: 명사, 동사, 형용사, 부사, 전치사, 접속사, 대명사, 한정사, 감탄사, 약어, 명사구, 동사구, 형용사구, 부사구, 전치사구. vocab 이 있으면 `vocab.pos` 를 `·` 로 나눈 배열 그대로.
- `ipa`: 미국식 발음 기호, 앞뒤 `/` 없이, 기존 단어장 표기 스타일(`ˈeskəleɪt`, `əˈbɔːrt`, `ˈæbsəns` — 강세 ˈˌ, 장음 ː 사용). vocab 이 있으면 그대로.
- `meaning`: 사전식 한 줄 뜻. 뜻이 여럿이면 `① … ② …`. 괄호로 쓰임 보충 가능. vocab 이 있으면 그대로 복사.
- `short`: **객관식 보기로 쓸 간결한 한국어 뜻** — 15자 안팎(최대 22자), 영어 알파벳·①② 없이, 이 시험 문장에서 가장 많이 쓰인 뜻 1~2개를 쉼표로. 예: `다루다, 해결하다`, `(상위 담당자에게) 넘기다`, `원인`, `여전히, 그럼에도`.
- `senses`: 이 단어의 뜻 목록(1~4개). 문제·예문에서 쓰인 뜻은 반드시 포함하고, 시험에 나올 만한 다른 주요 뜻도 넣는다(다의어 학습용). 각 `ko` 는 짧고 서로 구별되게.
- `forms`: 변화형·파생어 (문제에 나온 표기 `surfaces` 포함, 원형 제외). vocab-core/extra 는 생략해도 된다.
- `synonyms`: 영어 유의어 0~4개 (뜻이 거의 같은 단어만).
- `domain`: 아래 중 하나 — 생성·추가, 삭제·제거, 변경·수정, 확인·검증, 실행·처리, 이동·전달, 저장·기록, 검색·조회, 비교·평가·판단, 제어·제한·관리, 연결·통합, 요청·소통, 시작·종료, 오류·실패·위험, 원인·결과·영향, 정도·양·크기, 시간·순서·빈도, 구조·구성·부분, 데이터·정보·문서, 시스템·도구·기술, 사람·조직·역할, 상태·성질, 정확·품질·신뢰, 계획·목표·전략, 비즈니스·업무, 논리·관계·연결어, 일반
- `level`: 난이도 1~6 의 정수 — 기준은 `pipeline/prompts/level.md`. 1 초등 · 2 중학 · 3 고등 기본 · 4 수능 · 5 대학·공인영어 · 6 전문·기술. 쉬운 단어라도 `senses` 의 핵심 뜻이 어려우면 그 뜻 기준으로 매긴다.
- `memory`: 외우기(어원·연상) — 형식과 규칙은 `pipeline/prompts/memory.md`. `level` 이 2 이상이면 반드시 넣고(`story` 나 `hook` 중 하나는 필수), 1이면 생략한다. **어원은 확실할 때만** `roots`·`origin` 을 쓴다.
- `contexts`: 예문 최대 4개. `sentences` 의 `sid` 또는 `vocabExamples` 의 `vid` 로 고른다.
  - **서로 다른 뜻을 먼저 하나씩** 고른 뒤, 남는 자리는 다른 출처 파일·짧고 이해하기 쉬운 영어 문장으로 채운다. 한글 문장(`sentences` 중 한글이 섞인 것)은 영어 문장이 없을 때만.
  - `vocabExamples` 는 `sentences` 가 없거나 그 뜻의 예가 sentences 에 없을 때 쓴다.
  - `surface`: 그 문장에 **실제로 나온 표기 그대로**(대소문자 포함, 문장 안에 정확히 들어 있어야 함).
  - `pos`: 그 문장에서의 품사. `sense`: 그 문장에서의 뜻 — **반드시 `senses[].ko` 중 하나를 글자 그대로** 쓴다.
  - 해당 단어가 문장에서 단어의 일부(식별자, 다른 결합어 속)로만 쓰였다면 그 문장은 고르지 않는다.

## 출력 방법
- 결과를 **유효한 JSON 배열 하나**로 지정된 출력 파일에 Write 도구로 저장한다 (코드 펜스·설명 없이 JSON 만).
- 입력 항목 수와 출력 객체 수가 같아야 한다.
- 새 단어의 `memory` 는 반영 전에 `pipeline/prompts/memory.md` 의 길이·형식 규칙을 다시 확인한다.
- 저장 후 `node -e "const a=JSON.parse(require('fs').readFileSync('<출력파일>','utf8'));console.log(a.length)"` 로 파싱과 개수를 확인한다.
- 마지막 응답은 한 줄: `완료 <출력파일> <개수>개, skip <n>개`.

# Quiz Word 시험 팩 만들기 — 에이전트용 가이드

형식 버전 **1** · 기준 주소 `https://swpark3179.github.io/Quiz-Word/`

이 문서는 **시험 문제 파일을 받아, Quiz Word 앱이 불러올 수 있는 "시험 팩" 파일 하나를 만드는 방법**을 정한다. 이 문서만 보고 끝낼 수 있게 썼다. 다른 저장소나 기존 단어장을 볼 필요가 없다.

> **한 줄 요약** — `<시험 id>.exampack.json` 파일 하나를 만들고, 검증기(`validate-exampack.mjs`)가 `RESULT: PASS` 를 낼 때까지 고친다.

| 파일 | 주소 |
|---|---|
| 이 가이드 | `https://swpark3179.github.io/Quiz-Word/exam-pack-guide.md` |
| 검증기 (Node 18+, 의존성 없음) | `https://swpark3179.github.io/Quiz-Word/validate-exampack.mjs` |
| JSON Schema | `https://swpark3179.github.io/Quiz-Word/exampack.schema.json` |
| 완성 예시 | `https://swpark3179.github.io/Quiz-Word/example.exampack.json` |

---

## 1. 만들 것

- **파일 하나**: `<시험 id>.exampack.json` (예: `aws-saa.exampack.json`)
- UTF-8 (BOM 없이), JSON. 주석·끝 쉼표 금지.
- 시험 하나에 파일 하나. 문제 파일(회차·단원)이 여러 개여도 한 시험이면 한 파일에 담는다.
- 내용은 두 덩어리다.
  - `exam` — 그 시험의 문제 파일 목록, 단어가 나온 횟수, 예문, 문제 문장, 노트
  - `words` — 그 시험이 가리키는 **모든 단어의 사전 항목** (뜻·품사·발음·단계·외우기)

Quiz Word 는 한국인이 영어 시험을 준비하며 쓰는 단어장이다. 영어 단어, 한국어 뜻, 영어 예문과 한국어 해석으로 이루어진다. **뜻·해석·외우기·노트는 한국어로** 쓴다.

## 2. 앱이 이 파일을 쓰는 방법

앱에는 이미 다른 시험의 단어가 들어 있을 수 있다. 시험 팩은 그것을 **지우지 않고 얹는다**.

1. `words` 의 단어를 **id** 로, 없으면 **표제어**(대소문자 무시)로 앱의 사전에서 찾는다. 그래도 없는데 그 표제어가 앱 사전에서 다른 단어의 변화형으로 등록돼 있으면(예: 앱에는 `mitigation` 이 있고 `mitigate` 는 그 변화형) 그 단어로 본다.
2. **이미 있는 단어**는 앱의 것을 그대로 쓴다 — 뜻·단계·외우기를 바꾸지 않는다. 예문이 쓰는 뜻이 앱의 사전에 없을 때만 그 뜻 하나를 덧붙인다.
3. **없는 단어**는 팩에 적힌 항목을 사전에 넣는다.
4. `exam` 은 새 시험으로 추가한다. 같은 `exam.id` 의 시험이 이미 있으면 그 시험만 통째로 바꾼다.

그래서:

- **기존 사전을 몰라도 된다.** 문제에 나온 단어마다 사전 항목을 성실히 쓰면 된다. 겹치는 단어는 앱이 알아서 맞춘다.
- **단어 id 규칙(4절)을 반드시 지킨다.** 같은 단어가 같은 id 를 갖는 것이 겹침을 맞추는 열쇠다.
- 팩은 **자기 완결**이어야 한다. `exam` 이 가리키는 단어는 하나도 빠짐없이 `words` 에 있어야 한다.

## 3. 파일 구조

```jsonc
{
  "app": "quiz-word",                       // 고정
  "kind": "exampack",                       // 고정
  "version": 1,                             // 고정 (숫자)
  "builtAt": "2026-11-12T09:00:00.000Z",    // 만든 시각, ISO 8601
  "exam": {
    "id": "my-exam",
    "name": "내 시험",
    "sources":   [ { "id": "part1", "name": "1회" } ],
    "index":     { "<단어 id>": { "<문제 파일 id>": 3 } },
    "examples":  { "<문제 파일 id>": { "<단어 id>": [ { "n": 0, "q": 12, "en": "…", "surface": "…", "pos": "동사", "sense": "…", "ko": "…" } ] } },
    "sentences": { "<문제 파일 id>": [ { "q": 12, "en": "…", "ko": "…" } ] },
    "notes":     { "<단어 id>": "마크다운" }
  },
  "words": [
    { "id": "…", "word": "…", "level": 4, "pos": ["동사"], "ipa": "…", "meaning": "…", "short": "…",
      "senses": [ { "pos": "동사", "ko": "…" } ], "forms": ["…"], "synonyms": ["…"], "domain": "…", "memory": { … } }
  ]
}
```

위는 설명용이다(주석이 있다). 실제 파일은 12절의 예시처럼 주석 없는 JSON 이다.

### 3.1 맨 위

| 필드 | 필수 | 값 |
|---|:---:|---|
| `app` | ✅ | `"quiz-word"` |
| `kind` | ✅ | `"exampack"` |
| `version` | ✅ | `1` (숫자) |
| `builtAt` | ✅ | 만든 시각. ISO 8601 문자열 (`new Date().toISOString()`) |
| `exam` | ✅ | 시험 (3.2) |
| `words` | ✅ | 단어 항목 배열, 하나 이상 (3.3) |
| `$schema` | | 넣어도 된다: `"https://swpark3179.github.io/Quiz-Word/exampack.schema.json"` |

### 3.2 `exam`

| 필드 | 필수 | 값 |
|---|:---:|---|
| `id` | ✅ | 시험 id. 소문자·숫자를 하이픈으로 이은 것 (`^[a-z0-9]+(-[a-z0-9]+)*$`). 예: `aws-saa`, `toeic-2026` |
| `name` | ✅ | 화면에 보일 시험 이름. 예: `"AWS SAA"` |
| `order` | | 시험을 보여 줄 순서(숫자, 작은 것부터). 보통 생략 |
| `sources` | ✅ | 문제 파일 목록 `[{ "id", "name" }]`. **보여 줄 순서대로.** `id` 는 시험 id 와 같은 형식이고 이 시험 안에서 겹치지 않아야 한다. `name` 은 화면에 보일 이름(`"1회"`, `"D2-네트워크"`) |
| `index` | ✅ | 단어가 **어느 문제 파일에 몇 번 나왔는지**. `{ 단어 id: { 문제 파일 id: 횟수 } }`. 횟수는 1 이상의 정수. 비어 있으면 안 된다 (6.6) |
| `examples` | | 뜻이 정해진 예문. `{ 문제 파일 id: { 단어 id: [예문] } }` (3.4) |
| `sentences` | | 문제 문장 전체. `{ 문제 파일 id: [ { "q", "en", "ko" } ] }` (3.5). 문제 파일마다 넣는다 |
| `notes` | | 그 시험용 단어 노트. `{ 단어 id: "마크다운" }`. 선택 |

`sources` 항목에 `"kind": "wordbook"` 을 붙이면 "예문만 있는 파일"이 된다(문제 파일 목록에 나오지 않고, `index`·`sentences` 에 쓸 수 없다). 문제 파일에는 `kind` 를 적지 않는다(`"quiz"` 라고 적어도 같다).

### 3.3 `words` 의 단어 항목

| 필드 | 필수 | 값 |
|---|:---:|---|
| `id` | ✅ | **표제어에서 규칙대로 만든 값** (4절). 팩 안에서 겹치면 안 된다 |
| `word` | ✅ | 표제어(사전 원형). 여러 단어로 된 구도 된다 (`"carry out"`) |
| `level` | ✅ | 난이도 `1`~`6` 의 정수 (7절) |
| `pos` | ✅ | 품사 **배열**, 문제에서 쓰인 품사를 앞에. 허용값은 5.1 |
| `ipa` | | 미국식 발음기호, 앞뒤 `/` 없이. 예: `"ˈeskəleɪt"` |
| `meaning` | ✅ | 사전식 한 줄 뜻(한국어). 뜻이 여럿이면 `"① … ② …"` |
| `short` | ✅ | **객관식 보기로 쓸 짧은 한국어 뜻.** 15자 안팎(26자를 넘지 않게), 영어 알파벳·`①②` 없이. 예: `"다루다, 해결하다"` |
| `senses` | ✅ | 뜻 목록 `[{ "pos", "ko" }]`, 1~4개. `ko` 는 짧고 서로 달라야 한다. **예문의 `sense` 는 여기의 `ko` 를 글자 그대로 가리킨다** |
| `forms` | | 변화형·파생어 문자열 배열 (`["escalated", "escalating", "escalation"]`). 표제어 자신은 넣지 않는다. **문제 문장에 나온 표기는 반드시 넣는다** (6.4) |
| `synonyms` | | 영어 유의어 0~4개 |
| `domain` | ✅ | 의미 분류. 허용값은 5.2 |
| `memory` | `level` ≥ 2 면 ✅ | 외우기(어원·연상). 8절. 1단계는 생략한다 |

`words` 의 순서와 `index`·`examples`·`notes` 안의 키 순서는 자유다. id 순으로 적으면 읽기 좋다.

단어 항목에 **적으면 안 되는 필드**: `tier`, `basic`, `freq`, `sources`, `contexts`, `note` — 시험에 딸린 정보는 `exam` 쪽에 적는다.

### 3.4 예문 (`exam.examples`)

```json
{ "n": 0, "q": 12, "en": "Escalate the ticket to a human reviewer.", "surface": "Escalate", "pos": "동사", "sense": "(상위 담당자에게) 넘기다", "ko": "티켓을 사람 검토자에게 넘긴다." }
```

| 필드 | 필수 | 값 |
|---|:---:|---|
| `n` | | 그 단어의 예문을 보여 줄 순서. 단어마다 `0, 1, 2, 3` — 문제 파일이 달라도 **그 단어 안에서 이어서** 세고 겹치지 않게 한다. 6.5 에서 고른 순서(서로 다른 뜻 먼저)가 곧 `n` 이다 |
| `q` | | 문제 번호 (0 이상의 정수) |
| `en` | ✅ | 영어 문장. **그 문제 파일의 `sentences` 에 있는 문장을 글자 그대로** |
| `surface` | ✅ | 그 문장 안에 **실제로 나온 표기** (대소문자까지 그대로). `en` 안에 들어 있어야 한다 |
| `pos` | ✅ | 그 문장에서의 품사 (5.1) |
| `sense` | ✅ | 그 문장에서의 뜻. **그 단어 `senses[].ko` 중 하나와 글자 하나 다르지 않게 같아야 한다** |
| `ko` | | 문장의 한국어 해석. 넣는 것이 원칙 |

### 3.5 문제 문장 (`exam.sentences`)

```json
{ "q": 12, "en": "Escalate the ticket to a human reviewer.", "ko": "티켓을 사람 검토자에게 넘긴다." }
```

`q` 는 문제 번호, `en` 은 영어 문장 하나, `ko` 는 그 해석. 예문을 따로 적지 않은 단어에는 앱이 여기서 문장을 찾아 자동으로 붙이고, "예문 더 보기"에도 쓴다.

## 4. id 규칙

**단어 id** 는 표제어에서 기계적으로 만든다.

1. 소문자로 바꾼다.
2. 아포스트로피(`'`, `’`)를 지운다.
3. 영문 소문자·숫자가 아닌 글자가 이어진 곳을 하이픈 하나로 바꾼다.
4. 맨 앞·맨 뒤의 하이픈을 지운다.

```js
const slugId = (word) =>
  word.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
```

| 표제어 | id |
|---|---|
| `escalate` | `escalate` |
| `carry out` | `carry-out` |
| `SLA` | `sla` |
| `read-only` | `read-only` |
| `root cause` | `root-cause` |
| `don't` | `dont` |
| `lost-in-the-middle` | `lost-in-the-middle` |

id 가 이 규칙과 다르면 검증기가 오류를 낸다. **시험 id·문제 파일 id** 는 스스로 정하되 같은 형식(소문자·숫자·하이픈)을 따른다.

## 5. 허용값

### 5.1 품사 (`pos`, `senses[].pos`, 예문의 `pos`) — 15개

`명사` · `동사` · `형용사` · `부사` · `전치사` · `접속사` · `대명사` · `한정사` · `감탄사` · `약어` · `명사구` · `동사구` · `형용사구` · `부사구` · `전치사구`

- 여러 단어로 된 표제어는 `…구` 를 쓴다 (`carry out` → `동사구`, `root cause` → `명사구`, `according to` → `전치사구`). 어느 `…구` 인지는 **문장에서 하는 구실**로 정한다 (`data in transit` 의 `in transit` 은 명사를 꾸미므로 `형용사구`).
- 여러 단어로 된 접속사(`as soon as`, `so that`)는 `…구` 가 없으므로 `접속사` 를 쓴다.
- 약어(`API`, `SLA`)는 `약어`.
- 이 밖의 값(`noun`, `명`, `조동사` 등)은 오류다.

### 5.2 의미 분류 (`domain`) — 27개

오답 보기를 비슷한 뜻의 단어에서 고르는 데 쓴다. 가장 가까운 것 하나를 고르고, 정말 없으면 `일반`.

`생성·추가` · `삭제·제거` · `변경·수정` · `확인·검증` · `실행·처리` · `이동·전달` · `저장·기록` · `검색·조회` · `비교·평가·판단` · `제어·제한·관리` · `연결·통합` · `요청·소통` · `시작·종료` · `오류·실패·위험` · `원인·결과·영향` · `정도·양·크기` · `시간·순서·빈도` · `구조·구성·부분` · `데이터·정보·문서` · `시스템·도구·기술` · `사람·조직·역할` · `상태·성질` · `정확·품질·신뢰` · `계획·목표·전략` · `비즈니스·업무` · `논리·관계·연결어` · `일반`

가운뎃점(`·`, U+00B7)까지 글자 그대로 써야 한다.

## 6. 작성 절차

### 6.1 시험과 문제 파일 정하기

- 시험 `id`·`name` 을 정한다.
- 받은 문제 파일 하나를 `sources` 항목 하나로 한다. `id` 는 파일 이름에서 짧게 따오고(`part1`, `mock-2`, `ch03`), `name` 은 사람이 알아볼 이름으로 — 원본 제목을 그대로 써도, 한국어로 짧게 옮겨도 된다(`"연습 세트 A"`).
- 한 파일 안에서 문제 번호 `q` 는 1부터 차례로 붙인다(원본에 번호가 있으면 그 번호).

### 6.2 문제를 문장으로 나누기 → `sentences`

- 넣는 것: **문제 지문, 지문 아래의 설명 문장, 보기** — 영어로 된 것.
- 넣지 않는 것: 파일 제목·머리말·단원 제목 줄, 코드 블록, 표, **전체가 코드인 줄**(인라인 코드만 있는 보기 `` `git status` `` 포함), 한국어만 있는 문장, 정답 표시(`Answer: B`), 해설.
- 낱말 하나짜리 보기(`traceroute`, `TLS`, `A firewall`)도 코드가 아니면 **넣는다**. 그 낱말을 단어로 넣을지는 6.3 에서 따로 정한다.
- 지문은 **문장 단위로** 나눈다(마침표·물음표·느낌표 뒤). `e.g.`, `i.e.`, `vs.`, 소수점, 인라인 코드 안의 점에서는 나누지 않는다.
- 보기는 보기 하나를 문장 하나로 한다. 보기 기호(`①`, `A.`, `A)`, `1)`)와 문제 번호 표시(`Q1.`, `1.`, `문제 1`)는 뗀다. 문제 번호는 `q` 에 적는다.
- 마크다운 강조 기호(`**`, `*`, `_`)는 걷어 낸다. 인라인 코드의 백틱(`` ` ``)은 남긴다.
- **원문을 고치지 않는다.** 오탈자를 바로잡거나 줄이지 않는다.
- `ko` 는 그 문장의 자연스러운 한국어 해석. **모든 문장에 넣는다.** 원본에 번역이 있으면 그것을 따른다. 기술 용어는 업계에서 쓰는 말로(`deploy` → 배포하다). 약어·이름뿐인 문장은 한국어 풀이를 적는다(`TLS` → `"TLS (전송 계층 보안)"`). 풀 말이 없으면 그대로 옮긴다.
- 문제 파일 안에서 문제 순서, 문제 안에서 지문 → 보기 순서로 적는다.

### 6.3 넣을 단어 고르기

`sentences` 의 영어 문장에 나온 낱말에서 고른다.

**넣는다**
- 뜻을 알아야 문제를 풀 수 있는 낱말 전부 — 명사·동사·형용사·부사.
- 쉬운 단어도 넣는다(`make`, `file`). 단계 1 을 주면 학습자가 걸러 낼 수 있다.
- 아래 "뺀다"의 기능어 목록에 **없는** 전치사·접속사·부사 (`behind`, `during`, `between`, `despite`, `whereas`, `unless`, `only`).
- 여러 단어가 한 뜻을 이루는 것 (`carry out`, `root cause`, `trade-off`, `read-only`, `according to`, `as soon as`).
- 그 분야의 일반 용어와 약어 (`latency`, `SLA`, `API`).
- 특정 회사의 것이 아닌 **표준·프로토콜·기법의 이름** (`DNS`, `TLS`, `HTTP`, `Telnet`, `OAuth`) — 6단계, 약어면 `약어`, 아니면 `명사`.

**뺀다**
- 기능어 — 아래 목록이 전부다. 여기 없는 낱말은 넣는다.
  - 관사: `a`, `an`, `the`
  - be·have·do 가 조동사로 쓰인 것과 그 변화형, 조동사: `is`, `are`, `was`, `were`, `be`, `been`, `being`, `has`, `have`, `had`, `do`, `does`, `did`, `will`, `would`, `can`, `could`, `should`, `may`, `might`, `must`, `shall` (본동사로 "하다·가지다"의 뜻이면 넣어도 된다)
  - 인칭·소유·재귀 대명사: `I`, `you`, `he`, `she`, `it`, `we`, `they`, `me`, `him`, `her`, `us`, `them`, `my`, `your`, `his`, `its`, `our`, `their`, `itself`, `themselves` …
  - 지시어·의문사: `this`, `that`, `these`, `those`, `there`, `what`, `which`, `who`, `whom`, `whose`, `when`, `where`, `why`, `how`
  - 기본 전치사: `of`, `to`, `in`, `on`, `at`, `by`, `for`, `from`, `with`, `as`, `into`, `about`, `than`
  - 기본 접속사: `and`, `or`, `but`, `if`, `so`, `because`
  - 수량어·수사·부정어: `all`, `any`, `some`, `no`, `not`, `each`, `every`, `both`, `many`, `much`, `more`, `most`, `few`, `one`, `two`, `three` …
- 고유명사: 사람·회사·**제품·서비스** 이름(`Kubernetes`, `S3`), 요일·월 이름.
- 코드 식별자, 파일 이름, 명령어·도구 이름, 설정 키 (`max_tokens`, `config.json`, `--verbose`, `traceroute`).
- 숫자(`443`), 단위 조각 (`mg`, `ms`).

단어는 `sentences` 에 넣은 문장에서만 고른다. 6.2 에서 뺀 줄(코드, 제목)에만 있는 낱말은 단어가 되지 않는다 — 의도한 것이다.

**표제어 정하기**
- 굴절형은 원형으로 돌린다: 동사는 원형(`escalated` → `escalate`), 명사는 단수(`policies` → `policy`), 형용사·부사는 원급.
- 문제에 나온 낱말이 **그 자체로 사전에 실리는 말**이면 그것을 표제어로 쓴다 (`administrator`, `usage`, `unresponsive`, `silently`). 바탕 단어(`administer`, `use`)가 문제에 안 나왔으면 억지로 바탕 단어로 돌리지 않는다.
- 바탕 단어와 파생어가 **둘 다** 문제에 나오고 뜻이 그대로 이어지면 **한 단어로 합치고** 파생어를 `forms` 에 넣는다 (`migrate` + `migration`, `fail` + `failure`). 그 품사의 뜻이 필요하면 `senses` 에 `{ "pos": "명사", "ko": "(migration) 이전 작업" }` 처럼 넣는다. 합칠지 망설여지면 따로 둔다 (`health` 와 `healthy` 는 따로).
- 뜻이 따로 굳은 파생어는 **별도 단어**로 둔다 (`later` 나중에, `hardly` 거의 ~않다, `eventually`).

**여러 단어로 된 표제어**
- **굳은 용어·관용 표현**이면 한 단어로 넣는다: 뜻이 구성 단어를 더한 것과 다르거나, 그 분야에서 하나의 이름으로 쓰는 것 (`load balancer`, `single point of failure`, `availability zone`, `shut down`, `in transit`).
- 뜻이 **구성 단어의 합으로 바로 나오면** 따로따로 넣는다 (`packet loss` → `packet`, `loss` / `disk usage` → `disk`, `usage`).
- 여러 단어로 넣은 표제어의 구성 단어(`load`, `balancer`)는 **따로 알아 둘 만할 때만** 넣는다. 그 표제어 안에서만 나오고 쉬운 낱말이면 넣지 않아도 된다.

**같은 표기는 한 단어에만**
- 어떤 표기(문자열)를 두 단어의 `word`·`forms` 에 함께 넣으면 오류다 (`failure` 를 `fail` 의 `forms` 에 넣었다면 `failure` 라는 단어를 따로 만들 수 없다).
- 이 규칙은 **문자열 전체**에 대한 것이다. `single point of failure` 라는 표제어 안에 `failure` 가 들어 있는 것은 괜찮다 — 그 문장은 `fail` 과 `single point of failure` 양쪽의 횟수에 들어간다.

### 6.4 사전 항목 쓰기 → `words`

단어마다 3.3 의 필드를 채운다.

- `meaning` — 이 시험에서 쓰인 뜻을 앞에. 예: `"① (문제를) 다루다, 해결하다 ② 주소"`
- `short` — 이 시험에서 가장 많이 쓰인 뜻 1~2개를 쉼표로. 영어 알파벳을 넣지 않는다(보기에서 정답이 드러난다).
- `senses` — 문제에서 쓰인 뜻은 반드시 넣고, 알아 둘 만한 다른 주요 뜻도 넣는다. 최대 4개. `ko` 끼리 겹치지 않게.
- `forms` — **`sentences` 에 실제로 나온 표기를 모두** 넣고(소문자로), 흔한 변화형도 넣는다. 표제어 자신은 넣지 않는다.
  - 앱이 알아서 찾는 것(빼도 된다): 표제어·변화형 뒤에 `-s`/`-es` 만 붙은 꼴(`servers`, `matches`), 소유격 `'s`(`company's` 는 `company` 로 찾는다).
  - **넣어야 하는 것**: `y → ies`(`queries`), 과거형·진행형(`rerouted`, `planning`), 불규칙형(`chose`), 파생어.
- `synonyms` — 뜻이 거의 같은 영어 단어만 0~4개.
- `domain` — 5.2 에서 하나.
- `level` — 7절.
- `memory` — 8절.

### 6.5 예문 고르기 → `examples`

- 단어마다 **최대 4개**.
- **서로 다른 뜻을 먼저 하나씩** 고른다. 남는 자리는 다른 문제 파일의 문장, 짧고 이해하기 쉬운 문장으로 채운다.
- 문장은 `sentences` 에서 고르고 `en`·`ko` 를 **그대로 복사**한다. 그 문장이 속한 문제 파일 아래에 적는다.
- `surface` 는 그 문장에 나온 표기 그대로(`Escalated`, `policies`).
- `pos` 는 그 문장에서의 품사, `sense` 는 그 문장에서의 뜻 — `senses[].ko` 중 하나를 **복사해 붙인다**.
- 낱말이 식별자나 하이픈 결합어의 일부로만 쓰인 문장(`retry` 가 `retry-after` 안에만 있는 문장)은 고르지 않는다. 여러 단어로 된 용어 안에 있더라도 **그 낱말이 제 뜻으로 쓰였으면** 골라도 된다 (`content delivery network` 의 `network`).
- 낱말 하나짜리 보기(`"A firewall"`)는 다른 문장이 없을 때만 예문으로 쓴다.
- 고를 문장이 여럿이면 짧은 것, 문제 지문보다 완결된 문장인 것을 먼저 고른다.
- `n` 은 단어마다 0부터, **고른 순서대로**. 문제 파일이 달라도 이어서 센다 (1회에서 `0, 1`, 2회에서 `2`).
- 예문을 하나도 고르지 않은 단어는 앱이 `sentences` 에서 자동으로 찾아 보여 준다(이때는 뜻 표시가 없다). 가능하면 모든 단어에 하나 이상 고른다.

### 6.6 문제 파일별 횟수 세기 → `index`

단어마다, **그 문제 파일의 `sentences` 에서 그 단어(표제어 또는 `forms` 의 표기)가 몇 번 나오는지** 센다. 앱과 검증기가 쓰는 세는 방법은 아래와 같다 — 이 함수로 세면 값이 정확히 맞는다.

```js
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 표제어·변화형을 찾는 정규식 — 대소문자 무시, 낱말 단위, 규칙적인 -s/-es 포함 */
function wordRegex(word, forms = []) {
  const alts = [word, ...forms]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((s) => esc(s).replace(/\s+/g, '\\s+') + (/[a-z]$/i.test(s) ? '(?:e?s)?' : ''));
  return new RegExp(`(?<![A-Za-z0-9_-])(?:${alts.join('|')})(?![A-Za-z0-9_-])`, 'gi');
}

/** index[word.id][sourceId] */
function countIn(word, sentences) {
  const re = wordRegex(word.word, word.forms);
  return sentences.reduce((n, s) => n + (s.en.match(re)?.length ?? 0), 0);
}
```

- 횟수가 0 인 문제 파일은 적지 않는다.
- 낱말 앞뒤에 영문자·숫자·`_`·`-` 가 붙어 있으면 세지 않는다 (`retry-after` 의 `retry` 는 `retry` 로 세지 않는다).
- **띄어 쓴 용어 안의 낱말은 센다** (`load balancer` 의 `load` 는 `load` 의 횟수에도 들어간다). 그래서 한 문장이 여러 단어의 횟수에 들어갈 수 있다 — 정상이다.
- `words` 의 단어는 보통 모두 `index` 에 나온다(문제에 나온 단어만 넣었다면 자연히 그렇게 된다). `index`·`examples`·`notes` 어디에도 없는 단어는 경고가 난다.
- 횟수가 맞지 않거나 문장에서 찾지 못하면 검증기가 경고한다 — 대개 `forms` 에 그 표기가 빠진 것이다.

### 6.7 노트 (선택) → `notes`

그 시험에서 특히 알아 둘 것이 있는 단어에만 쓴다. 마크다운. 줄바꿈은 `\n`. 예:

```
하던 작업을 **도중에 그만두는** 것입니다.\n\n## 함께 쓰는 표현\n- **abort a request** : 요청을 중단하다
```

## 7. 단계 (`level`)

한국 영어 교육과정에 대략 맞춘 난이도다. 학습자는 공부할 단계를 골라(여러 개 가능) 공부한다.

| 단계 | 이름 | 기준 | 예 |
|:---:|---|---|---|
| 1 | 초등 | 초등 교과서·일상 기초 단어 | make, time, open, first, problem, number |
| 2 | 중학 | 중학 교과서 수준 | change, report, common, divide, actually, expensive |
| 3 | 고등 기본 | 고1~2 교과서, 기본 수험 어휘 | specific, evidence, recommend, version, require |
| 4 | 수능 | 수능·모의고사 수준 | abandon, sensitive, inherit, guarantee, hierarchy |
| 5 | 대학·공인영어 | TOEIC·TOEFL, 대학 교재 | ambiguous, consecutive, discrepancy, plausible |
| 6 | 전문·기술 | 업계 용어·약어·전문 합성어 | idempotent, symlink, SLA, lost-in-the-middle |

- **뜻 기준.** 쉬운 철자에 어려운 뜻이 붙으면 올린다 (`address` 다루다 → 3, `issue` 발급하다 → 3).
- 약어와 **그 분야 밖에서는 쓰지 않는 말**은 6 (`idempotent`, `DNS`). 하나의 이름으로 굳은 업계 용어는 여러 단어여도 6 이다 (`load balancer`, `availability zone`) — 아래 합성어 규칙보다 이 규칙이 먼저다.
- 쉬운 단어가 그 분야의 뜻으로 쓰인 것은 **3~4 까지만** 올린다 (`port` 네트워크 포트 → 3, `client` → 3, `traffic` 통신량 → 3, `drop` (패킷을) 버리다 → 3). 6 으로 올리지 않는다.
- 일반 영어의 합성어·하이픈 결합어는 구성 단어 중 가장 높은 단계에 0~1 을 더한다 (`health check` → 3, `rate limit` → 4). 뜻이 뻔하면 그대로(`read-only`), 관용적이면 올린다(`ad hoc`, `trade-off`).
- 파생어(`-ly`, `-ness`, `un-`, `re-`)는 바탕 단어와 같거나 한 단계 위.
- 문제에 자주 나온다고 쉬운 것이 아니다. 자주 나와도 어려운 단어는 어려운 단계다.

## 8. 외우기 (`memory`)

`level` 이 2 이상인 단어에는 **반드시** 넣는다. 1단계는 넣지 않는다. 학습자가 뜻을 떠올리게 돕는 정보로, 플래시카드 뒷면에 나온다.

```json
"memory": {
  "roots":  [{ "part": "de-", "ko": "떨어져, 멀리" }, { "part": "fer", "ko": "나르다" }],
  "origin": "라틴어 differre (따로 나르다)",
  "story":  "일을 저만치(de) 날라(fer) 둔다 → 미루다",
  "hook":   "디퍼 → '뒤로 퍼~ 넘긴다' → 미루다",
  "family": ["transfer", "refer", "prefer", "infer"]
}
```

| 필드 | 내용 | 길이 |
|---|---|---|
| `roots` | 어원 조각 `[{ "part", "ko" }]`. 접두사는 `re-`, 접미사는 `-tion`, 어근은 그대로. `part` 는 **단어 철자에 실제로 보이는 조각** — 바탕 단어의 끝 글자가 떨어졌으면 보이는 만큼만 (`usage` → `us` + `-age`, `administrator` → `ad-` + `ministr` + `-ator`) | 2~4개 |
| `origin` | 어원 한 줄. `언어 이름 + 원어 + (뜻)` | 50자 이하 |
| `story` | 어원 조각으로 그린 **장면 → 뜻**. 조각을 괄호로 짚는다 | 80자 이하 |
| `hook` | 발음 연상. `한글 발음 → 연상 → 뜻` | 60자 이하 |
| `family` | 같은 어근을 가진 **다른** 영어 단어 2~4개. 떳떳하게 댈 수 있는 것이 없으면 생략한다 (하나뿐이면 하나만 적어도 된다) | |

규칙:

1. **`story` 나 `hook` 중 하나는 반드시** 있어야 한다. 나머지는 없어도 된다.
2. **어원은 확실할 때만.** 사전에서 확인되는 어원이 아니면 `roots`·`origin` 을 적지 않는다. 지어낸 어근·민간 어원 금지. 불확실하면 쓰임 장면을 그린 `story` 나 `hook` 만 쓴다.
3. `story`·`hook` 은 **`→ 뜻` 으로 끝맺고**(`→` 가 없으면 경고), 그 뜻은 `meaning` 과 맞아야 한다.
4. `hook` 은 발음이 실제로 비슷하고 자연스러울 때만. 한국어에서 이미 외래어로 쓰는 말이면 그것을 건다(콘크리트, 스파이크). 억지 말장난·비하 표현 금지.
5. 합성어·하이픈 결합어·여러 단어로 된 용어는 `roots` 에 구성 단어를 적고 `story` 에서 푼다. `origin`·`family` 는 대개 필요 없다.
6. 약어는 `origin` 에 원말(`Service Level Agreement`)을 적고 `story` 에서 한국어로 푼다. `roots` 는 쓰지 않는다.
7. `family` 에 자기 자신이나 단순 변화형을 넣지 않는다.
8. 간결한 구절로. 존댓말·이모지·마크다운 금지.

## 9. 검사

**검증기를 통과해야 앱이 불러온다.** 검증기는 앱이 파일을 읽을 때 쓰는 검사와 같은 코드다.

```bash
curl -fsSLO https://swpark3179.github.io/Quiz-Word/validate-exampack.mjs
node validate-exampack.mjs my-exam.exampack.json
```

검증기 파일을 이미 받았으면(작업 폴더에 함께 들어 있으면) 내려받지 말고 그 경로로 실행한다.

출력:

```
WARN   해석(ko)이 없는 예문 2개: part1.escalate[0], part2.retry[1]
ERROR  words[3] (migrate): id 는 "migrate" 여야 함 (표제어 "migrate" 를 소문자·하이픈으로 바꾼 값)
RESULT: FAIL errors=1 warnings=1 (시험 팩 형식 버전 1)
```

- `ERROR` 가 하나라도 있으면 앱이 불러오지 않는다. **`RESULT: PASS` 가 나올 때까지 고친다.**
- `WARN` 은 불러올 수는 있지만 확인이 필요한 것이다. 하나씩 읽고 고친다. 이 가이드대로 만들면 경고는 0 이 된다 — 남은 경고가 있으면 무엇이고 왜 남겼는지 보고한다.
- 검증기가 **보지 못하는 것**도 있다: 뜻과 해석이 맞는지, 어원이 사실인지, 넣어야 할 낱말이 빠졌는지, 단계가 적절한지. 이것은 13절 점검표로 스스로 확인한다.
- 종료 코드: `0` 통과 · `1` 오류 있음 · `2` 파일을 읽지 못함(JSON 문법 오류 포함).
- `--json` 을 붙이면 `{ "ok", "errors", "warnings", "summary" }` 를 JSON 으로 낸다.
- JSON Schema(`exampack.schema.json`)는 구조·필수 필드·허용값만 본다. 편집기 자동 완성이나 구조화 출력에 쓰고, **마지막 판정은 검증기로** 한다.

## 10. 자주 나오는 오류

| 메시지 | 원인과 고치는 법 |
|---|---|
| `id 는 "…" 여야 함` | id 를 4절 규칙으로 다시 만든다. `index`·`examples`·`notes` 의 키도 함께 고친다 |
| `사전에 없는 단어 "…"` | `exam` 이 가리키는 단어가 `words` 에 없다. 사전 항목을 추가하거나 그 키를 지운다 |
| `문맥 뜻 "…" 가 senses 에 없음` | 예문의 `sense` 가 `senses[].ko` 와 글자가 다르다(띄어쓰기·괄호 포함). `senses` 에서 복사해 붙인다 |
| `예문에 "…" 없음` | `surface` 가 `en` 안에 없다. 문장에 실제로 나온 표기를 적는다 |
| `알 수 없는 품사` / `알 수 없는 domain` | 5절의 허용값을 글자 그대로 쓴다 |
| `level(1~6) 없음` / `level 은 1~6 의 정수` | 숫자 1~6 (문자열 `"4"` 는 안 된다) |
| `2단계 이상인 단어에는 memory…` | 외우기를 넣는다(8절). 1단계라면 `level` 을 확인한다 |
| `memory.story 가 김` | 80자 이하로 줄인다 (`hook` 60, `origin` 50) |
| `표현 "…" 가 … 에도 등록됨` | 같은 표기가 두 단어의 `word`·`forms` 에 있다. 한쪽에서 뺀다 |
| `문제 파일 목록에 없는 "…"` | `index`·`sentences` 의 문제 파일 id 가 `sources` 에 없다 |
| `"tier" 는 단어 항목에 적지 않는다` | 단어 항목에서 그 필드를 지운다 (`basic`, `freq`, `sources`, `contexts`, `note` 도 같다) |
| 경고 `문장에서 찾지 못한 단어` | 그 문제 파일 문장에 나온 표기가 `forms` 에 없다. 표기를 `forms` 에 넣거나, 실제로 안 나왔으면 `index` 에서 뺀다 |
| 경고 `횟수가 문장에서 센 값과 다른 항목` | 6.6 의 함수로 다시 센다 |
| 경고 `예문의 en 이 … sentences 에 없음` | 예문 문장을 `sentences` 에서 그대로 복사한다 |
| 경고 `예문이 없는 단어` | 그 단어의 예문을 하나 이상 고른다(6.5). 여러 단어로 된 용어 안에서만 나오는 쉬운 구성 단어라면 단어에서 빼는 것도 방법이다(6.3) |
| 경고 `예문의 n 이 겹치는 단어` | 단어마다 `n` 을 0부터 이어서 다시 매긴다 |
| 경고 `surface 의 대소문자가 문장과 다른 예문` | 문장에 나온 그대로 적는다 (`Increase`) |
| 경고 `해석(ko)이 없는 문제 문장` / `…예문` | 해석을 넣는다 |
| 경고 `memory.roots 의 조각 … 이 철자 … 에 안 보임` | 단어에 보이는 대로 적거나(`ministr`), 어원이 확실하지 않으면 `roots` 를 뺀다 |
| 경고 `파일 이름이 …` | 파일 이름을 `<exam.id>.exampack.json` 으로 바꾼다 |

## 11. 문제가 많을 때

- 문제 파일 하나씩 처리한다: 문장 나누기 → 해석 → 단어 고르기.
- 단어 사전 항목은 모든 문제 파일을 훑은 뒤 **단어마다 한 번** 쓴다(같은 단어를 문제 파일마다 따로 쓰지 않는다).
- `index` 는 손으로 세지 말고 6.6 의 함수로 계산한다. `forms` 를 다 채운 뒤에 센다.
- JSON 은 손으로 이어 붙이지 말고 스크립트로 조립해 `JSON.stringify` 로 쓴다.
- 단어가 수백 개를 넘으면 중간중간 검증기를 돌린다.

## 12. 완성 예시

문제 파일 2개, 단어 11개짜리 시험이다. 이 파일은 검증기를 오류·경고 없이 통과한다 (`example.exampack.json` 과 같은 내용).

<!-- example:start -->
```json
{
  "$schema": "https://swpark3179.github.io/Quiz-Word/exampack.schema.json",
  "app": "quiz-word",
  "kind": "exampack",
  "version": 1,
  "builtAt": "2026-11-12T00:00:00.000Z",
  "exam": {
    "id": "example",
    "name": "샘플 시험",
    "sources": [
      {
        "id": "part1",
        "name": "1회"
      },
      {
        "id": "part2",
        "name": "2회"
      }
    ],
    "index": {
      "downtime": {
        "part1": 1,
        "part2": 1
      },
      "fallback": {
        "part2": 1
      },
      "legacy": {
        "part1": 1
      },
      "migrate": {
        "part1": 2,
        "part2": 1
      },
      "mitigate": {
        "part1": 1,
        "part2": 1
      },
      "outage": {
        "part1": 2,
        "part2": 1
      },
      "replicate": {
        "part1": 1,
        "part2": 1
      },
      "risk": {
        "part1": 1,
        "part2": 1
      },
      "robust": {
        "part2": 1
      },
      "spike": {
        "part1": 1
      },
      "team": {
        "part1": 1,
        "part2": 1
      }
    },
    "examples": {
      "part1": {
        "downtime": [
          {
            "n": 0,
            "q": 1,
            "en": "Which approach minimizes downtime during the migration?",
            "surface": "downtime",
            "pos": "명사",
            "sense": "(시스템의) 중단 시간",
            "ko": "이전하는 동안 중단 시간을 가장 줄이는 방법은 무엇인가?"
          }
        ],
        "legacy": [
          {
            "n": 0,
            "q": 1,
            "en": "The team decided to migrate the legacy database to the cloud.",
            "surface": "legacy",
            "pos": "형용사",
            "sense": "(시스템이) 오래된 기존의",
            "ko": "팀은 기존 데이터베이스를 클라우드로 이전하기로 했다."
          }
        ],
        "migrate": [
          {
            "n": 0,
            "q": 1,
            "en": "The team decided to migrate the legacy database to the cloud.",
            "surface": "migrate",
            "pos": "동사",
            "sense": "(데이터·시스템을) 옮기다, 이전하다",
            "ko": "팀은 기존 데이터베이스를 클라우드로 이전하기로 했다."
          },
          {
            "n": 1,
            "q": 1,
            "en": "Which approach minimizes downtime during the migration?",
            "surface": "migration",
            "pos": "명사",
            "sense": "(migration) 이전 작업",
            "ko": "이전하는 동안 중단 시간을 가장 줄이는 방법은 무엇인가?"
          }
        ],
        "mitigate": [
          {
            "n": 0,
            "q": 2,
            "en": "The engineer wants to mitigate the risk of another outage.",
            "surface": "mitigate",
            "pos": "동사",
            "sense": "(위험·피해를) 줄이다, 완화하다",
            "ko": "엔지니어는 장애가 또 일어날 위험을 줄이고 싶어 한다."
          }
        ],
        "outage": [
          {
            "n": 0,
            "q": 2,
            "en": "A sudden spike in traffic caused an outage.",
            "surface": "outage",
            "pos": "명사",
            "sense": "(서비스) 장애, 일시 중단",
            "ko": "트래픽이 갑자기 급증해 장애가 발생했다."
          }
        ],
        "replicate": [
          {
            "n": 0,
            "q": 1,
            "en": "Replicate the data first, then switch over",
            "surface": "Replicate",
            "pos": "동사",
            "sense": "(데이터를) 복제하다",
            "ko": "먼저 데이터를 복제한 다음 전환한다"
          }
        ],
        "risk": [
          {
            "n": 0,
            "q": 2,
            "en": "The engineer wants to mitigate the risk of another outage.",
            "surface": "risk",
            "pos": "명사",
            "sense": "위험(성)",
            "ko": "엔지니어는 장애가 또 일어날 위험을 줄이고 싶어 한다."
          }
        ],
        "spike": [
          {
            "n": 0,
            "q": 2,
            "en": "A sudden spike in traffic caused an outage.",
            "surface": "spike",
            "pos": "명사",
            "sense": "급증, 급등",
            "ko": "트래픽이 갑자기 급증해 장애가 발생했다."
          }
        ],
        "team": [
          {
            "n": 0,
            "q": 1,
            "en": "The team decided to migrate the legacy database to the cloud.",
            "surface": "team",
            "pos": "명사",
            "sense": "팀",
            "ko": "팀은 기존 데이터베이스를 클라우드로 이전하기로 했다."
          }
        ]
      },
      "part2": {
        "fallback": [
          {
            "n": 0,
            "q": 1,
            "en": "A robust fallback can mitigate downtime.",
            "surface": "fallback",
            "pos": "명사",
            "sense": "대체 수단, 예비책",
            "ko": "견고한 대체 수단은 중단 시간을 줄일 수 있다."
          }
        ],
        "migrate": [
          {
            "n": 2,
            "q": 1,
            "en": "After the outage, the team migrated the remaining services.",
            "surface": "migrated",
            "pos": "동사",
            "sense": "(데이터·시스템을) 옮기다, 이전하다",
            "ko": "장애 이후 팀은 남은 서비스를 이전했다."
          }
        ],
        "outage": [
          {
            "n": 1,
            "q": 1,
            "en": "After the outage, the team migrated the remaining services.",
            "surface": "outage",
            "pos": "명사",
            "sense": "(서비스) 장애, 일시 중단",
            "ko": "장애 이후 팀은 남은 서비스를 이전했다."
          }
        ],
        "replicate": [
          {
            "n": 1,
            "q": 2,
            "en": "Replicate the database across two regions to reduce risk.",
            "surface": "Replicate",
            "pos": "동사",
            "sense": "(데이터를) 복제하다",
            "ko": "위험을 줄이려면 데이터베이스를 두 리전에 복제한다."
          }
        ],
        "robust": [
          {
            "n": 0,
            "q": 1,
            "en": "A robust fallback can mitigate downtime.",
            "surface": "robust",
            "pos": "형용사",
            "sense": "견고한, 쉽게 깨지지 않는",
            "ko": "견고한 대체 수단은 중단 시간을 줄일 수 있다."
          }
        ]
      }
    },
    "sentences": {
      "part1": [
        {
          "q": 1,
          "en": "The team decided to migrate the legacy database to the cloud.",
          "ko": "팀은 기존 데이터베이스를 클라우드로 이전하기로 했다."
        },
        {
          "q": 1,
          "en": "Which approach minimizes downtime during the migration?",
          "ko": "이전하는 동안 중단 시간을 가장 줄이는 방법은 무엇인가?"
        },
        {
          "q": 1,
          "en": "Replicate the data first, then switch over",
          "ko": "먼저 데이터를 복제한 다음 전환한다"
        },
        {
          "q": 2,
          "en": "A sudden spike in traffic caused an outage.",
          "ko": "트래픽이 갑자기 급증해 장애가 발생했다."
        },
        {
          "q": 2,
          "en": "The engineer wants to mitigate the risk of another outage.",
          "ko": "엔지니어는 장애가 또 일어날 위험을 줄이고 싶어 한다."
        }
      ],
      "part2": [
        {
          "q": 1,
          "en": "After the outage, the team migrated the remaining services.",
          "ko": "장애 이후 팀은 남은 서비스를 이전했다."
        },
        {
          "q": 1,
          "en": "A robust fallback can mitigate downtime.",
          "ko": "견고한 대체 수단은 중단 시간을 줄일 수 있다."
        },
        {
          "q": 2,
          "en": "Replicate the database across two regions to reduce risk.",
          "ko": "위험을 줄이려면 데이터베이스를 두 리전에 복제한다."
        }
      ]
    },
    "notes": {
      "outage": "서비스가 **멈춘 사건**을 가리킵니다. 멈춰 있던 **시간**은 downtime 입니다.\n\n## 함께 쓰는 표현\n- **cause an outage** : 장애를 일으키다\n- **a service outage** : 서비스 장애"
    }
  },
  "words": [
    {
      "id": "downtime",
      "word": "downtime",
      "level": 5,
      "pos": [
        "명사"
      ],
      "ipa": "ˈdaʊntaɪm",
      "meaning": "(시스템이) 멈춰 있는 시간, 중단 시간",
      "short": "중단 시간",
      "senses": [
        {
          "pos": "명사",
          "ko": "(시스템의) 중단 시간"
        }
      ],
      "synonyms": [
        "outage"
      ],
      "domain": "오류·실패·위험",
      "memory": {
        "roots": [
          {
            "part": "down",
            "ko": "내려간, 멈춘"
          },
          {
            "part": "time",
            "ko": "시간"
          }
        ],
        "story": "시스템이 내려가(down) 있는 시간(time) → 중단 시간",
        "family": [
          "uptime",
          "downturn"
        ]
      }
    },
    {
      "id": "fallback",
      "word": "fallback",
      "level": 6,
      "pos": [
        "명사"
      ],
      "ipa": "ˈfɔːlbæk",
      "meaning": "(문제가 생겼을 때 쓰는) 대체 수단, 예비책",
      "short": "대체 수단",
      "senses": [
        {
          "pos": "명사",
          "ko": "대체 수단, 예비책"
        }
      ],
      "synonyms": [
        "backup"
      ],
      "domain": "오류·실패·위험",
      "memory": {
        "roots": [
          {
            "part": "fall",
            "ko": "물러나다"
          },
          {
            "part": "back",
            "ko": "뒤로"
          }
        ],
        "story": "막히면 뒤로(back) 물러나(fall) 기댈 곳 → 대체 수단",
        "family": [
          "setback",
          "backup"
        ]
      }
    },
    {
      "id": "legacy",
      "word": "legacy",
      "level": 5,
      "pos": [
        "형용사",
        "명사"
      ],
      "ipa": "ˈleɡəsi",
      "meaning": "① (시스템이) 오래된 기존의 ② 유산",
      "short": "오래된 기존의",
      "senses": [
        {
          "pos": "형용사",
          "ko": "(시스템이) 오래된 기존의"
        },
        {
          "pos": "명사",
          "ko": "유산"
        }
      ],
      "domain": "상태·성질",
      "memory": {
        "origin": "라틴어 legatus (위임받은 사람)",
        "story": "앞사람이 남기고 간 것 → 유산 → 물려받은 오래된 시스템",
        "hook": "레거시 → 물려받은 '레거시 코드' → 오래된 기존의"
      }
    },
    {
      "id": "migrate",
      "word": "migrate",
      "level": 5,
      "pos": [
        "동사"
      ],
      "ipa": "ˈmaɪɡreɪt",
      "meaning": "(데이터·시스템을) 옮기다, 이전하다",
      "short": "옮기다, 이전하다",
      "senses": [
        {
          "pos": "동사",
          "ko": "(데이터·시스템을) 옮기다, 이전하다"
        },
        {
          "pos": "명사",
          "ko": "(migration) 이전 작업"
        }
      ],
      "forms": [
        "migrated",
        "migrating",
        "migration"
      ],
      "synonyms": [
        "move",
        "transfer"
      ],
      "domain": "이동·전달",
      "memory": {
        "roots": [
          {
            "part": "migr",
            "ko": "옮겨 가다"
          },
          {
            "part": "-ate",
            "ko": "~하다"
          }
        ],
        "origin": "라틴어 migrare (옮겨 살다)",
        "story": "철새가 살 곳을 옮겨 가듯(migr) → 데이터를 옮기다, 이전하다",
        "family": [
          "immigrate",
          "emigrate",
          "migrant"
        ]
      }
    },
    {
      "id": "mitigate",
      "word": "mitigate",
      "level": 5,
      "pos": [
        "동사"
      ],
      "ipa": "ˈmɪtɪɡeɪt",
      "meaning": "(위험·피해를) 줄이다, 완화하다",
      "short": "줄이다, 완화하다",
      "senses": [
        {
          "pos": "동사",
          "ko": "(위험·피해를) 줄이다, 완화하다"
        }
      ],
      "forms": [
        "mitigated",
        "mitigating",
        "mitigation"
      ],
      "synonyms": [
        "reduce",
        "lessen"
      ],
      "domain": "오류·실패·위험",
      "memory": {
        "roots": [
          {
            "part": "mit",
            "ko": "부드러운"
          },
          {
            "part": "-igate",
            "ko": "~하게 하다"
          }
        ],
        "origin": "라틴어 mitigare (부드럽게 하다)",
        "story": "거친 충격을 부드럽게(mitis) 만든다 → 완화하다, 줄이다"
      }
    },
    {
      "id": "outage",
      "word": "outage",
      "level": 6,
      "pos": [
        "명사"
      ],
      "ipa": "ˈaʊtɪdʒ",
      "meaning": "(서비스·전력의) 중단, 장애",
      "short": "(서비스) 장애",
      "senses": [
        {
          "pos": "명사",
          "ko": "(서비스) 장애, 일시 중단"
        }
      ],
      "synonyms": [
        "downtime",
        "failure"
      ],
      "domain": "오류·실패·위험",
      "memory": {
        "roots": [
          {
            "part": "out",
            "ko": "나간, 꺼진"
          },
          {
            "part": "-age",
            "ko": "~한 상태"
          }
        ],
        "story": "불이 나간(out) 상태(-age) → 서비스가 멈춘 장애",
        "family": [
          "blackout",
          "shortage"
        ]
      }
    },
    {
      "id": "replicate",
      "word": "replicate",
      "level": 5,
      "pos": [
        "동사"
      ],
      "ipa": "ˈreplɪkeɪt",
      "meaning": "(데이터를) 복제하다",
      "short": "복제하다",
      "senses": [
        {
          "pos": "동사",
          "ko": "(데이터를) 복제하다"
        }
      ],
      "forms": [
        "replicated",
        "replicating",
        "replication"
      ],
      "synonyms": [
        "copy",
        "duplicate"
      ],
      "domain": "생성·추가",
      "memory": {
        "roots": [
          {
            "part": "re-",
            "ko": "다시"
          },
          {
            "part": "plic",
            "ko": "접다"
          },
          {
            "part": "-ate",
            "ko": "~하다"
          }
        ],
        "origin": "라틴어 replicare (되접다, 되풀이하다)",
        "story": "다시(re) 접어(plic) 같은 것을 한 벌 더 만든다 → 복제하다",
        "family": [
          "replica",
          "duplicate",
          "complicate"
        ]
      }
    },
    {
      "id": "risk",
      "word": "risk",
      "level": 3,
      "pos": [
        "명사"
      ],
      "ipa": "rɪsk",
      "meaning": "위험(성), 위험 요소",
      "short": "위험(성)",
      "senses": [
        {
          "pos": "명사",
          "ko": "위험(성)"
        }
      ],
      "synonyms": [
        "danger",
        "hazard"
      ],
      "domain": "오류·실패·위험",
      "memory": {
        "origin": "프랑스어 risque ← 이탈리아어 risco",
        "story": "암초 옆을 지나는 배가 무릅쓰는 것 → 위험",
        "hook": "리스크 → '리스크가 크다'의 그 리스크 → 위험"
      }
    },
    {
      "id": "robust",
      "word": "robust",
      "level": 5,
      "pos": [
        "형용사"
      ],
      "ipa": "roʊˈbʌst",
      "meaning": "견고한, 쉽게 깨지지 않는",
      "short": "견고한",
      "senses": [
        {
          "pos": "형용사",
          "ko": "견고한, 쉽게 깨지지 않는"
        }
      ],
      "synonyms": [
        "sturdy",
        "resilient"
      ],
      "domain": "정확·품질·신뢰",
      "memory": {
        "origin": "라틴어 robustus (참나무처럼 단단한)",
        "story": "참나무(robur)처럼 단단해 쉽게 부러지지 않는 → 견고한"
      }
    },
    {
      "id": "spike",
      "word": "spike",
      "level": 5,
      "pos": [
        "명사"
      ],
      "ipa": "spaɪk",
      "meaning": "급증, 급등",
      "short": "급증",
      "senses": [
        {
          "pos": "명사",
          "ko": "급증, 급등"
        }
      ],
      "synonyms": [
        "surge"
      ],
      "domain": "정도·양·크기",
      "memory": {
        "story": "그래프가 못(spike)처럼 뾰족하게 솟는다 → 급증",
        "hook": "스파이크 → 배구 스파이크처럼 확 치솟는 → 급증"
      }
    },
    {
      "id": "team",
      "word": "team",
      "level": 1,
      "pos": [
        "명사"
      ],
      "ipa": "tiːm",
      "meaning": "팀, 조",
      "short": "팀",
      "senses": [
        {
          "pos": "명사",
          "ko": "팀"
        }
      ],
      "domain": "사람·조직·역할"
    }
  ]
}
```
<!-- example:end -->

## 13. 끝내기 전 점검표

- [ ] 파일 이름이 `<exam.id>.exampack.json` 이다
- [ ] `node validate-exampack.mjs <파일>` 이 `RESULT: PASS` 이고, 남은 경고를 하나씩 확인했다
- [ ] `sentences` 의 영어 문장은 원문 그대로이고, 문장마다 한국어 해석이 있다
- [ ] 문제를 푸는 데 필요한 낱말이 빠지지 않았다 (기능어·고유명사·코드 식별자만 뺐다)
- [ ] 모든 단어의 `id` 가 4절 규칙대로다
- [ ] `level` 2 이상인 단어는 모두 `memory` 가 있고, 확실하지 않은 어원은 적지 않았다
- [ ] 예문의 `sense` 는 `senses[].ko` 를 복사한 것이다
- [ ] `index` 는 6.6 의 함수로 센 값이다

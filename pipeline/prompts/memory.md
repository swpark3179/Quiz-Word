# 외우기(memory) 생성 — 어원·연상

입력: `pipeline/work/memory/in-NN.json` — `[{ id, word, pos, ipa, meaning, level }]`
출력: `pipeline/work/memory/out-NN.json` — `{ "<id>": { roots?, origin?, story?, hook?, family? }, … }` (입력의 모든 id 를 빠짐없이, 같은 순서로)

한국인 학습자가 단어의 **뜻을 떠올리게** 돕는 정보다. 플래시카드 뒷면에서 뜻 바로 아래에 나온다.

## 필드

| 필드 | 내용 | 길이 |
|---|---|---|
| `roots` | 어원 조각 `[{ "part": "re-", "ko": "다시" }]`. 접두사는 `re-`, 접미사는 `-tion`, 어근은 그대로. **`part` 는 단어 철자에 실제로 보이는 조각**으로 적는다(동화된 접두사는 `ac-`, `oc-`, `ap-` 처럼 보이는 대로) | 조각 2~4개 |
| `origin` | 어원 한 줄. `라틴어 differre (따로 나르다)` 형식 — 언어 이름 + 원어 + (뜻) | 50자 이하 |
| `story` | 어원 조각으로 그린 **장면 → 뜻**. 조각을 괄호로 짚는다: `일을 저만치(de) 날라(fer) 둔다 → 미루다` | 80자 이하 |
| `hook` | 발음 연상. `디퍼 → '뒤로 퍼~ 넘긴다' → 미루다` 형식 — 한글 발음 → 연상 → 뜻 | 60자 이하 |
| `family` | 같은 어근을 가진 **다른** 영어 단어 2~4개 (자기 자신·단순 변화형 금지) | |

## 규칙

1. **`story` 나 `hook` 중 하나는 반드시** 있어야 한다. 둘 다 좋으면 둘 다 쓴다.
2. **어원은 확실할 때만.** 사전에서 확인되는 어원이 아니면 `roots`·`origin` 을 적지 않는다. 지어낸 어근·민간 어원 금지. 불확실하면 `hook` 이나 어원 없는 `story`(쓰임 장면)만 쓴다.
3. `story`·`hook` 의 끝은 `→ 뜻` 으로 맺고, 그 뜻은 입력의 `meaning`(이 단어장에서 쓰는 뜻)과 맞아야 한다. 뜻이 여러 개면 가장 앞의 뜻(또는 어원에서 자연스럽게 이어지는 뜻)에 맞춘다.
4. `hook` 은 발음이 실제로 비슷하고 연상이 자연스러울 때만 쓴다. 억지 말장난, 비하·선정적 표현 금지. 이미 한국어에서 외래어로 쓰는 말이면(예: 콘크리트, 익스플로러, 버짓) 그 외래어를 걸어 준다.
5. **합성어·하이픈 결합어**(`back-and-forth`, `mid-session`, `lockfile`): `roots` 에 구성 단어를 적고 `story` 에서 풀어 준다. `origin` 은 대개 필요 없다.
6. **약어**(`SLA`, `OTPM`, `CLI`): `origin` 에 원말(`Service Level Agreement`)을 적고, `story` 는 원말을 한국어로 풀어 뜻으로 잇는다. `roots` 는 쓰지 않는다.
7. **구동사·관용구**(`carry out`, `as is`): 구성 단어의 그림으로 `story` 를 쓴다.
8. **고유 기술 용어**(`kafka`, `redis`, `grep`, `zod`): 이름의 유래가 알려져 있으면 `origin`·`story` 에 쓰고, 아니면 쓰임을 그린 `story` 만 쓴다.
9. `-ly`, `-ness`, `-tion`, `un-`, `re-` 같은 **파생어**는 바탕 단어 + 접사로 `roots` 를 적고, `story` 는 바탕 단어의 뜻에서 출발한다.
10. 말투는 간결한 명사형·서술형 구절(“~한다 → 뜻”). 존댓말·이모지·마크다운 금지. 영어 조각은 괄호 안에만.

## 예시

```json
{
  "concrete": {
    "roots": [{ "part": "con-", "ko": "함께" }, { "part": "crete", "ko": "자라다, 굳다" }],
    "origin": "라틴어 concretus (함께 자라 굳은)",
    "story": "함께(con) 자라(cret) 단단히 굳어 손에 잡히는 → 구체적인, 실제의",
    "hook": "콩크리트 → 콘크리트처럼 손에 딱 잡히는 → 구체적인",
    "family": ["increase", "decrease", "crescent"]
  },
  "trivial": {
    "roots": [{ "part": "tri-", "ko": "셋" }, { "part": "via", "ko": "길" }, { "part": "-al", "ko": "~의" }],
    "origin": "라틴어 trivialis (삼거리의, 흔한)",
    "story": "세(tri) 갈래 길(via)에서 흔히 오가는 잡담 → 사소한, 하찮은",
    "hook": "트리비얼 → 퀴즈 '트리비아'처럼 시시콜콜한",
    "family": ["trivia", "obvious", "via"]
  },
  "deem": {
    "origin": "고대 영어 dēman (판단하다)",
    "story": "재판관이 판결(dōm, doom)을 내리듯 → ~라고 여기다, 판단하다"
  },
  "misplace": {
    "roots": [{ "part": "mis-", "ko": "잘못" }, { "part": "place", "ko": "두다, 자리" }],
    "story": "엉뚱한(mis) 자리(place)에 둬 버린다 → 잘못 배치하다",
    "hook": "미스플레이스 → 플레이스(자리) 미스",
    "family": ["replace", "displace", "placement"]
  },
  "fuzzy": {
    "roots": [{ "part": "fuzz", "ko": "보풀, 솜털" }, { "part": "-y", "ko": "~같은" }],
    "story": "솜털(fuzz)처럼 경계가 보송보송 흐릿해 → 대략 일치하는, 근사의",
    "hook": "퍼지 → 경계가 퍼져 번진다 → 대충 비슷하면 일치"
  },
  "sla": {
    "origin": "Service Level Agreement",
    "story": "서비스(Service)를 어느 수준(Level)까지 지키겠다는 약속(Agreement) → 서비스 수준 협약"
  }
}
```

## 검사

배치를 쓴 뒤 반드시 돌려 오류 0 을 확인한다 (경고는 내용을 보고 고칠지 판단):

```
npx tsx scripts/apply-memory.ts --check pipeline/work/memory/out-NN.json
```

반영은 `npx tsx scripts/apply-memory.ts` — 이미 `memory` 가 있는 단어는 건드리지 않는다.

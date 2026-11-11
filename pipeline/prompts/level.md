# 난이도 등급 — 1~6단계

단어마다 한국 영어 교육과정에 대략 맞춘 난이도를 매긴다. 학습자는 "N단계 이상만" 골라 공부한다.

| 단계 | 이름 | 점수 | 기준 | 예 |
|---|---|---|---|---|
| 1 | 초등 | 10~19 | 초등 교과서·일상 기초 단어 | make, time, open, first, problem, number |
| 2 | 중학 | 20~29 | 중학 교과서 수준 | change, report, common, divide, actually, expensive |
| 3 | 고등 기본 | 30~39 | 고1~2 교과서, 기본 수험 어휘 | specific, evidence, recommend, version, require |
| 4 | 수능 | 40~49 | 수능·모의고사 수준 | abandon, sensitive, inherit, guarantee, hierarchy |
| 5 | 대학·공인영어 | 50~59 | TOEIC·TOEFL, 대학 교재 | ambiguous, consecutive, discrepancy, plausible |
| 6 | 전문·기술 | 60~69 | 업계 용어·약어·전문 합성어 | idempotent, symlink, SLA, lost-in-the-middle |

## 판정 규칙

1. **뜻 기준.** 단어장에 적힌 뜻(`senses`) 가운데 핵심 뜻이 어려우면 그 뜻으로 매긴다. `address`(다루다), `issue`(발급하다)처럼 쉬운 철자에 어려운 뜻이 붙으면 올린다.
2. **약어·전문 용어는 6.** 풀어 써야 뜻을 아는 약어(API, SLA), 특정 분야에서만 쓰는 말.
3. **합성어·하이픈 결합어**는 구성 단어 가운데 가장 높은 단계에 0~1을 더한다. 뜻이 뻔하면(`one-line`, `read-only`) 그대로, 관용적이면(`ad hoc`, `trade-off`) 올린다.
4. **파생어**(-ly, -ness, un-, re-)는 바탕 단어와 같거나 한 단계 위.
5. 시험 주제 때문에 자주 보이는 것과 난이도는 다르다. 자주 나와도 어려운 단어는 어려운 단계다.

## 전체를 다시 나눌 때 (점수 → 단계)

사전 전체의 등급을 다시 매길 때는 단계 대신 **10~69 점**을 준다(십의 자리 = 위 표의 단계, 일의 자리 = 단계 안에서의 위치).

- 점수 파일: `pipeline/work/levels/scores-*.txt` — `id=점수` 를 공백으로 구분
- `npx tsx scripts/apply-levels.ts` — 모든 단어에 점수가 정확히 하나씩 있는지 확인하고, 단계마다 300~400개가 되도록 경계 점수를 정해 `pipeline/work/levels/levels.json` 에 적는다. 같은 점수의 단어는 같은 단계가 된다.
- `--write` 를 붙이면 `data/words` 의 `level` 을 고친다.

개수를 고르게 맞추기 때문에 교육과정 이름은 근사치다 (지금 경계: 1단계 ≤18 · 2단계 ≤28 · 3단계 ≤36 · 4단계 ≤44 · 5단계 ≤52 · 6단계 그 위).

새 단어 몇 개를 추가할 때는 점수를 다시 매기지 않고 위 표를 보고 `level` 을 바로 적는다.

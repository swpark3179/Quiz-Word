/**
 * 객관식 보기 만들기.
 *
 * 오답 보기는 정답과 "헷갈릴 만한" 단어에서 고른다 — 같은 품사·같은 의미 분류·뜻이 적당히 비슷한 단어.
 * 다만 사실상 같은 뜻(동의어, 같은 뜻 조각, 한글 bigram 유사도 ≥ 0.5)은 빼서 정답이 둘이 되지 않게 한다.
 */
import type { Context, Word } from './schema';
import { dice, sample, sharesGloss, shuffle } from './text';

export interface Option {
  text: string;
  correct: boolean;
  /** 이 보기가 가리키는 단어 (오답 보기 해설용) */
  wordId?: string;
}

export interface Question {
  wordId: string;
  mode: 'meaning' | 'context';
  options: Option[];
  /** 문맥 모드일 때 문제로 보여 줄 예문 */
  context?: Context;
}

const SIMILAR_LIMIT = 0.5;

function tooClose(a: string, b: string): boolean {
  return a === b || dice(a, b) >= SIMILAR_LIMIT || sharesGloss(a, b);
}

/** 단어별 소문자 표제어·유의어·변화형 — 보기 하나를 만들 때 풀 전체(2천 개)와 비교하므로 한 번만 만든다 */
const lowerCache = new WeakMap<Word, { word: string; related: Set<string> }>();
function lowered(w: Word) {
  let v = lowerCache.get(w);
  if (!v) {
    v = { word: w.word.toLowerCase(), related: new Set([...(w.synonyms ?? []), ...(w.forms ?? [])].map((s) => s.toLowerCase())) };
    lowerCache.set(w, v);
  }
  return v;
}

function isSynonym(target: Word, other: Word): boolean {
  const t = lowered(target);
  const o = lowered(other);
  return t.related.has(o.word) || o.related.has(t.word);
}

/** 오답 후보 점수 — 클수록 헷갈리는 보기 */
export function distractorScore(target: Word, other: Word, answerText: string, otherText: string): number {
  let s = 0;
  if (other.pos[0] && other.pos[0] === target.pos[0]) s += 3;
  else if (other.pos.some((p) => target.pos.includes(p))) s += 1.5;
  if (other.domain === target.domain && target.domain !== '일반') s += 2;
  const sim = dice(answerText, otherText);
  if (sim >= 0.15 && sim < SIMILAR_LIMIT) s += sim * 2;
  // 난이도가 비슷한 단어의 뜻이 더 헷갈린다
  const gap = Math.abs(other.level - target.level);
  if (gap === 0) s += 0.5;
  else if (gap === 1) s += 0.25;
  if (Math.abs(otherText.length - answerText.length) <= 3) s += 0.5;
  return s;
}

/**
 * 오답 보기 텍스트 n 개를 고른다.
 * pool 에서 같은 주 품사 후보를 우선하고, 모자라면 다른 품사까지 넓힌다.
 */
export function pickDistractors(
  target: Word,
  answerText: string,
  pool: Word[],
  n: number,
  rng: () => number = Math.random,
  textOf: (w: Word) => string = (w) => w.short,
): Option[] {
  const candidates: { w: Word; text: string; score: number }[] = [];
  for (const other of pool) {
    if (other.id === target.id) continue;
    const text = textOf(other);
    if (!text || tooClose(answerText, text) || isSynonym(target, other)) continue;
    candidates.push({ w: other, text, score: distractorScore(target, other, answerText, text) + rng() * 0.6 });
  }
  const samePos = candidates.filter((c) => c.w.pos[0] === target.pos[0]);
  const base = samePos.length >= n ? samePos : candidates;
  base.sort((a, b) => b.score - a.score);

  // 상위 12개에서 무작위로 — 보기끼리도 서로 너무 비슷하지 않게
  const top = shuffle(base.slice(0, 12), rng);
  const chosen: Option[] = [];
  for (const c of [...top, ...base.slice(12)]) {
    if (chosen.length >= n) break;
    if (chosen.some((o) => tooClose(o.text, c.text))) continue;
    chosen.push({ text: c.text, correct: false, wordId: c.w.id });
  }
  return chosen;
}

/** 영어 → 한글 뜻 고르기 */
export function buildMeaningQuestion(target: Word, pool: Word[], choices = 4, rng: () => number = Math.random): Question {
  const answer = target.short;
  const wrong = pickDistractors(target, answer, pool, choices - 1, rng);
  return {
    wordId: target.id,
    mode: 'meaning',
    options: shuffle([{ text: answer, correct: true, wordId: target.id }, ...wrong], rng),
  };
}

/**
 * 문맥 뜻 고르기 — 예문 속 단어가 그 문장에서 어떤 뜻인지.
 * 같은 단어의 다른 뜻을 먼저 오답으로 쓰고(다의어 구별 연습), 모자라면 같은 품사·분류 단어의 뜻으로 채운다.
 */
export function buildContextQuestion(
  target: Word,
  pool: Word[],
  contexts: Context[],
  choices = 4,
  rng: () => number = Math.random,
): Question {
  const usable = contexts.filter((c) => c.sense);
  if (!usable.length) return buildMeaningQuestion(target, pool, choices, rng);
  const context = sample(usable, 1, rng)[0];
  const answer = context.sense;
  const options: Option[] = [{ text: answer, correct: true, wordId: target.id }];
  // 실제 문장에 쓰인 뜻 — 같은 품사의 다른 뜻은 이 목록에 있을 때만 오답으로 쓴다
  // (쓰이지 않은 같은 품사 뜻은 "견고한" / "튼튼한" 처럼 사실상 같은 뜻일 수 있다)
  const attested = new Set([...target.contexts, ...contexts].map((c) => c.sense));
  for (const s of shuffle(target.senses, rng)) {
    if (options.length >= choices) break;
    if (s.pos === context.pos && !attested.has(s.ko)) continue;
    if (options.some((o) => tooClose(o.text, s.ko))) continue;
    options.push({ text: s.ko, correct: false, wordId: target.id });
  }
  if (options.length < choices) {
    const ctxPos = context.pos || target.pos[0];
    const textOf = (w: Word) => w.senses.find((s) => s.pos === ctxPos)?.ko ?? w.short;
    const more = pickDistractors(target, answer, pool, choices - options.length + 2, rng, textOf).filter(
      (o) => !options.some((x) => tooClose(x.text, o.text)),
    );
    options.push(...more.slice(0, choices - options.length));
  }
  return { wordId: target.id, mode: 'context', context, options: shuffle(options, rng) };
}

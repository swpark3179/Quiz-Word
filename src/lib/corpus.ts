/**
 * 예문 고르기 — 웹·앱 공용.
 * 단어에 붙어 있는 예문(뜻이 정해진 예문)과, 문제 문장 색인에서 자동으로 찾은 문장(auto)을
 * 지금 보고 있는 시험·문제 파일에 맞춰 고른다.
 *
 *   1. 보고 있는 문제 파일의 예문 → 같은 시험 다른 문제 파일의 예문
 *   2. 같은 시험에 붙은 예문이 없으면 그 시험 문장 색인에서 찾은 문장
 *   3. 같은 시험에서 하나도 못 찾았을 때만 다른 시험의 예문(없으면 다른 시험의 문장)
 */
import type { Context, Word } from './schema';

export interface CorpusSentence {
  cat: string;
  src: string;
  q: number;
  en: string;
  ko?: string;
}

/** 지금 보고 있는 시험·문제 파일 — 예문을 이쪽 것부터 보여 준다 */
export interface ExamplePref {
  cat?: string;
  file?: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 단어(표제어·forms, -s/-es 포함)를 찾는 정규식 */
export function wordRegex(w: Pick<Word, 'word' | 'forms'>): RegExp {
  const alts = [w.word, ...(w.forms ?? [])]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((s) => escapeRe(s).replace(/\s+/g, '\\s+') + (/[a-z]$/i.test(s) ? '(?:e?s)?' : ''));
  return new RegExp(`(?<![A-Za-z0-9_-])(?:${alts.join('|')})(?![A-Za-z0-9_-])`, 'i');
}

/** 시험마다 자동으로 찾아 둘 문장 수 */
const AUTO_PER_EXAM = 40;

/** 보고 있는 문제 파일 → 같은 시험 → 나머지 순으로 (같은 순위 안에서는 원래 순서) */
function byPref<T extends { cat: string; src: string }>(list: T[], pref?: ExamplePref): T[] {
  if (!pref?.cat) return list;
  const rank = (c: T) => (c.cat !== pref.cat ? 2 : pref.file && c.src !== pref.file ? 1 : 0);
  return list
    .map((c, i) => ({ c, i, r: rank(c) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
}

export function createCorpusIndex(corpus: CorpusSentence[]) {
  // 영어 문장을 먼저 (한글이 섞인 문장은 뒤로)
  const ordered = [...corpus].sort((a, b) => Number(/[가-힣]/.test(a.en)) - Number(/[가-힣]/.test(b.en)));
  const cache = new Map<string, Context[]>();

  /** 이 단어가 쓰인 문제 문장 전부 (붙어 있는 예문과 겹치는 문장 제외) — 단어마다 한 번만 찾는다 */
  function autoExamples(w: Word): Context[] {
    let hit = cache.get(w.id);
    if (!hit) {
      const re = wordRegex(w);
      const seen = new Set(w.contexts.map((c) => c.en));
      const perExam = new Map<string, number>();
      hit = [];
      for (const s of ordered) {
        const n = perExam.get(s.cat) ?? 0;
        if (n >= AUTO_PER_EXAM || seen.has(s.en)) continue;
        const m = s.en.match(re);
        if (!m) continue;
        seen.add(s.en);
        perExam.set(s.cat, n + 1);
        hit.push({ cat: s.cat, src: s.src, q: s.q, en: s.en, ...(s.ko ? { ko: s.ko } : {}), surface: m[0], pos: w.pos[0] ?? '', sense: w.short, auto: true });
      }
      cache.set(w.id, hit);
    }
    return hit;
  }

  /** 이 단어가 쓰인 문제 문장 (붙어 있는 예문 제외) — 단어 상세의 "더 보기" */
  function corpusExamples(w: Word, limit = 12, pref?: ExamplePref): Context[] {
    return byPref(autoExamples(w), pref).slice(0, limit);
  }

  /** 학습 화면에 쓸 예문 */
  function contextsOf(w: Word, limit = 4, pref?: ExamplePref): Context[] {
    if (pref?.cat) {
      const same = w.contexts.filter((c) => c.cat === pref.cat);
      if (same.length) return byPref(same, pref).slice(0, limit);
      const auto = autoExamples(w).filter((c) => c.cat === pref.cat);
      if (auto.length) return byPref(auto, pref).slice(0, limit);
    }
    if (w.contexts.length) return w.contexts.slice(0, limit);
    return autoExamples(w).slice(0, limit);
  }

  return { corpusExamples, contextsOf };
}

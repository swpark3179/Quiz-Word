/**
 * 문제 문장 색인에서 단어 예문 찾기 — 웹·앱 공용.
 * 저장된 문맥 뜻(contexts)이 없는 단어(직접 추가한 단어 등)는 이 색인에서 예문을 자동으로 붙인다.
 */
import type { Context, Word } from './schema';

export interface CorpusSentence {
  src: string;
  q: number;
  en: string;
  ko?: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 단어(표제어·forms, -s/-es 포함)를 찾는 정규식 */
export function wordRegex(w: Word): RegExp {
  const alts = [w.word, ...(w.forms ?? [])]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((s) => escapeRe(s).replace(/\s+/g, '\\s+') + (/[a-z]$/i.test(s) ? '(?:e?s)?' : ''));
  return new RegExp(`(?<![A-Za-z0-9_-])(?:${alts.join('|')})(?![A-Za-z0-9_-])`, 'i');
}

export function createCorpusIndex(corpus: CorpusSentence[]) {
  // 영어 문장을 먼저 (한글판 문제 속 영어 단어는 뒤로)
  const ordered = [...corpus].sort((a, b) => Number(/[가-힣]/.test(a.en)) - Number(/[가-힣]/.test(b.en)));
  const cache = new Map<string, Context[]>();

  /** 이 단어가 쓰인 문제 문장 (저장된 예문과 겹치는 문장 제외) */
  function corpusExamples(w: Word, limit = 12): Context[] {
    let hit = cache.get(w.id);
    if (!hit) {
      const re = wordRegex(w);
      const seen = new Set(w.contexts.map((c) => c.en));
      hit = [];
      for (const s of ordered) {
        if (seen.has(s.en)) continue;
        const m = s.en.match(re);
        if (!m) continue;
        seen.add(s.en);
        hit.push({ src: s.src, q: s.q, en: s.en, ko: s.ko, surface: m[0], pos: w.pos[0] ?? '', sense: w.short });
        if (hit.length >= 40) break;
      }
      cache.set(w.id, hit);
    }
    return hit.slice(0, limit);
  }

  /** 학습 화면에 쓸 예문 — 저장된 문맥 뜻이 없으면 문장 색인에서 자동으로 붙인다 */
  function contextsOf(w: Word, limit = 4): Context[] {
    if (w.contexts.length) return w.contexts.slice(0, limit);
    return corpusExamples(w, limit);
  }

  return { corpusExamples, contextsOf };
}

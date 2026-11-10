import type { Word } from './schema';
import { compareWord } from './text';

const hasHangul = (s: string) => /[가-힣ㄱ-ㅎ]/.test(s);

/**
 * 단어 검색 순위 (작을수록 위):
 * 0 표제어 정확 일치 · 1 표제어 접두 · 2 변화형 정확 일치 · 3 변화형 접두 · 4 표제어 포함 · 5 한글 뜻 포함
 * 한글로 검색하면 뜻(meaning·short·senses)에서 찾는다.
 */
/** 단어별 검색용 문자열 — 글자를 칠 때마다 2천 개를 다시 소문자로 만들지 않게 한 번만 만든다 */
interface SearchKeys {
  word: string;
  forms: string[];
  ko: string;
}
const keyCache = new WeakMap<Word, SearchKeys>();
function keysOf(w: Word): SearchKeys {
  let k = keyCache.get(w);
  if (!k) {
    k = {
      word: w.word.toLowerCase(),
      forms: (w.forms ?? []).map((f) => f.toLowerCase()),
      ko: [w.short, w.meaning, ...w.senses.map((s) => s.ko)].join(' '),
    };
    keyCache.set(w, k);
  }
  return k;
}

export function rankWord(w: Word, query: string): number {
  return rankNormalized(w, query.trim().toLowerCase());
}

function rankNormalized(w: Word, q: string): number {
  if (!q) return 0;
  const k = keysOf(w);
  if (hasHangul(q)) {
    if (w.short.startsWith(q)) return 1;
    return k.ko.includes(q) ? 5 : -1;
  }
  if (k.word === q) return 0;
  if (k.word.startsWith(q)) return 1;
  if (k.forms.includes(q)) return 2;
  if (k.forms.some((f) => f.startsWith(q))) return 3;
  if (k.word.includes(q)) return 4;
  return -1;
}

export function searchWords(words: Word[], query: string): Word[] {
  const q = query.trim().toLowerCase();
  if (!q) return words;
  const ranked: { w: Word; r: number }[] = [];
  for (const w of words) {
    const r = rankNormalized(w, q);
    if (r >= 0) ranked.push({ w, r });
  }
  ranked.sort((a, b) => a.r - b.r || b.w.freq - a.w.freq || a.w.word.length - b.w.word.length || compareWord(a.w.word, b.w.word));
  return ranked.map((x) => x.w);
}

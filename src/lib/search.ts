import type { Word } from './schema';

const hasHangul = (s: string) => /[가-힣ㄱ-ㅎ]/.test(s);

/**
 * 단어 검색 순위 (작을수록 위):
 * 0 표제어 정확 일치 · 1 표제어 접두 · 2 변화형 정확 일치 · 3 변화형 접두 · 4 표제어 포함 · 5 한글 뜻 포함
 * 한글로 검색하면 뜻(meaning·short·senses)에서 찾는다.
 */
export function rankWord(w: Word, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  if (hasHangul(q)) {
    const text = [w.short, w.meaning, ...w.senses.map((s) => s.ko)].join(' ');
    if (w.short.startsWith(q)) return 1;
    return text.includes(q) ? 5 : -1;
  }
  const word = w.word.toLowerCase();
  if (word === q) return 0;
  if (word.startsWith(q)) return 1;
  const forms = (w.forms ?? []).map((f) => f.toLowerCase());
  if (forms.includes(q)) return 2;
  if (forms.some((f) => f.startsWith(q))) return 3;
  if (word.includes(q)) return 4;
  return -1;
}

export function searchWords(words: Word[], query: string): Word[] {
  if (!query.trim()) return words;
  const ranked: { w: Word; r: number }[] = [];
  for (const w of words) {
    const r = rankWord(w, query);
    if (r >= 0) ranked.push({ w, r });
  }
  ranked.sort((a, b) => a.r - b.r || b.w.freq - a.w.freq || a.w.word.length - b.w.word.length || a.w.word.localeCompare(b.w.word));
  return ranked.map((x) => x.w);
}

import fs from 'node:fs';
import path from 'node:path';
import type { VocabEntry } from '../../src/lib/matcher';

export const QUIZ_DATA_DIR_PATH =
  process.env.QUIZ_DATA_DIR ?? 'C:/Users/s-w.park/Desktop/Quiz-Bank/assets/quiz-data';
export const WORK = path.resolve('pipeline/work');

export function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

export function vocabMdPath(id: string) {
  return path.join(QUIZ_DATA_DIR_PATH, 'vocab', `${id}.md`);
}

/** vocab/{id}.md 의 "문제 속 쓰임" 인용문에서 (영어, 한글) 예문 쌍을 뽑는다 */
export function parseVocabExamples(md: string): { en: string; ko: string }[] {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^##\s*문제 속 쓰임/.test(l.trim()));
  if (start < 0) return [];
  const quotes: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const t = line.trim();
    if (t.startsWith('##')) break;
    if (t.startsWith('>')) quotes.push(t.replace(/^>\s*/, ''));
  }
  const clean = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').trim();
  const out: { en: string; ko: string }[] = [];
  for (let i = 0; i < quotes.length; i++) {
    const en = quotes[i];
    const ko = quotes[i + 1];
    if (!/[가-힣]/.test(en) && ko && /[가-힣]/.test(ko)) {
      out.push({ en: clean(en), ko: clean(ko) });
      i++;
    }
  }
  return out;
}

export function loadVocabExamples(vocab: VocabEntry[]) {
  const map = new Map<string, { vid: string; en: string; ko: string }[]>();
  for (const v of vocab) {
    const p = vocabMdPath(v.id);
    if (!fs.existsSync(p)) continue;
    const ex = parseVocabExamples(fs.readFileSync(p, 'utf8'));
    if (ex.length) map.set(v.id, ex.map((e, i) => ({ vid: `vocab:${v.id}.${i}`, ...e })));
  }
  return map;
}

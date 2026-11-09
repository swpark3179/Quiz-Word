/**
 * 3단계 준비 — 생성 B(문장 해석) 배치 입력.
 * - 보기 문장: "📝 문제 번역" 의 ①②③④ 줄과 1:1 로 맞춰 바로 해석을 붙인다 → gen/ko-choices.json
 * - 문제 본문 문장(과 보기 개수가 안 맞는 문제의 보기): 문제 번역 문단을 참고본으로 LLM 이 문장별로 옮긴다
 *   → batchB/in-NN.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { readJson, WORK } from './lib/common';

interface SentenceRec {
  sid: string;
  key: string;
  part: 'stem' | 'body' | 'choice';
  en: string;
  lang: 'en' | 'ko';
}

const size = Number(process.argv[2] ?? 30);
const questions = readJson<{ key: string; koRef?: string }[]>(path.join(WORK, 'questions.json'));
const sentences = readJson<SentenceRec[]>(path.join(WORK, 'sentences.json'));

const byKey = new Map<string, SentenceRec[]>();
for (const s of sentences) {
  if (s.lang !== 'en') continue;
  const list = byKey.get(s.key) ?? [];
  list.push(s);
  byKey.set(s.key, list);
}

const choiceKo: Record<string, string> = {};
const todo: { key: string; koRef?: string; sentences: { sid: string; en: string }[] }[] = [];

for (const q of questions) {
  const list = byKey.get(q.key);
  if (!list) continue;
  const choices = list.filter((s) => s.part === 'choice');
  const koChoices = (q.koRef ?? '')
    .split('\n')
    .filter((l) => /^[①-⑧]/.test(l))
    .map((l) => l.replace(/^[①-⑧]\s*/, '').trim());
  const aligned = koChoices.length === choices.length && choices.length > 0;
  if (aligned) choices.forEach((c, i) => (choiceKo[c.sid] = koChoices[i]));
  const rest = list.filter((s) => s.part !== 'choice' || !aligned);
  if (rest.length) todo.push({ key: q.key, koRef: q.koRef, sentences: rest.map((s) => ({ sid: s.sid, en: s.en })) });
}

fs.mkdirSync(path.join(WORK, 'gen'), { recursive: true });
fs.writeFileSync(path.join(WORK, 'gen', 'ko-choices.json'), JSON.stringify(choiceKo, null, 1));

const dir = path.join(WORK, 'batchB');
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) if (/^in-\d+\.json$/.test(f)) fs.unlinkSync(path.join(dir, f));
let n = 0;
for (let i = 0; i < todo.length; i += size) {
  n++;
  fs.writeFileSync(path.join(dir, `in-${String(n).padStart(2, '0')}.json`), JSON.stringify(todo.slice(i, i + size), null, 1));
}
const total = todo.reduce((a, t) => a + t.sentences.length, 0);
console.log(`보기 해석 자동 연결 ${Object.keys(choiceKo).length}개 · LLM 해석 대상 ${total}문장 (문제 ${todo.length}개) → 배치 ${n}개`);

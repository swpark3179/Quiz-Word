/**
 * 2단계 준비 — 생성 A(단어 단위) 배치 입력을 만든다.
 *   pipeline/work/batchA/in-NN.json
 * 각 항목: 원형, vocab 정보(있으면), 등장 문장(최대 8개), vocab 상세 예문(있으면)
 *
 * 실행: npx tsx scripts/build-batches.ts [배치크기=45] [--only=lemma1,lemma2] [--name=pilot]
 */
import fs from 'node:fs';
import path from 'node:path';
import type { VocabEntry } from '../src/lib/matcher';
import { QUIZ_DATA_DIR_PATH, loadVocabExamples, readJson, WORK } from './lib/common';

interface LemmaRec {
  lemma: string;
  vocabId?: string;
  surfaces: Record<string, number>;
  freq: number;
  sources: string[];
  sids: string[];
  maybeProper?: boolean;
}
interface SentenceRec {
  sid: string;
  src: string;
  en: string;
  lang: 'en' | 'ko';
  part: string;
}

const args = process.argv.slice(2);
const size = Number(args.find((a) => /^\d+$/.test(a)) ?? 45);
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const name = args.find((a) => a.startsWith('--name='))?.slice(7);

const lemmas = readJson<LemmaRec[]>(path.join(WORK, 'lemmas.json'));
const sentences = new Map(readJson<SentenceRec[]>(path.join(WORK, 'sentences.json')).map((s) => [s.sid, s]));
const vocab = readJson<VocabEntry[]>(path.join(QUIZ_DATA_DIR_PATH, 'vocab/index.json'));
const vocabById = new Map(vocab.map((v) => [v.id, v]));
const examples = loadVocabExamples(vocab);

/** 문장 고르기: 영어 우선, 출처를 고르게, 너무 짧거나 긴 문장은 뒤로 */
function pickSentences(sids: string[], max = 8) {
  const recs = sids.map((sid) => sentences.get(sid)!).filter(Boolean);
  const score = (s: SentenceRec) =>
    (s.lang === 'en' ? 0 : 1000) + (s.en.length < 30 ? 300 : s.en.length > 240 ? 200 : 0) + (s.part === 'choice' ? 20 : 0);
  recs.sort((a, b) => score(a) - score(b) || a.sid.localeCompare(b.sid));
  const picked: SentenceRec[] = [];
  const usedSrc = new Map<string, number>();
  // 출처별로 돌아가며 고른다
  for (let round = 0; picked.length < max && round < 10; round++) {
    for (const s of recs) {
      if (picked.length >= max) break;
      if (picked.includes(s)) continue;
      if ((usedSrc.get(s.src) ?? 0) > round) continue;
      picked.push(s);
      usedSrc.set(s.src, (usedSrc.get(s.src) ?? 0) + 1);
    }
  }
  return picked.map((s) => ({ sid: s.sid, en: s.en }));
}

interface Item {
  lemma: string;
  kind: 'vocab-core' | 'new' | 'vocab-extra';
  surfaces?: string[];
  freq?: number;
  maybeProper?: boolean;
  vocab?: { id: string; word: string; pos?: string; ipa?: string; meaning: string };
  sentences: { sid: string; en: string }[];
  vocabExamples?: { vid: string; en: string; ko: string }[];
}

const items: Item[] = [];
const seenVocab = new Set<string>();
for (const l of lemmas) {
  const v = l.vocabId ? vocabById.get(l.vocabId) : undefined;
  if (v) seenVocab.add(v.id);
  items.push({
    lemma: l.lemma,
    kind: v ? 'vocab-core' : 'new',
    surfaces: Object.keys(l.surfaces),
    freq: l.freq,
    ...(l.maybeProper ? { maybeProper: true } : {}),
    ...(v ? { vocab: { id: v.id, word: v.word, pos: v.pos, ipa: v.ipa, meaning: v.meaning } } : {}),
    sentences: pickSentences(l.sids),
    ...(v && examples.get(v.id)?.length ? { vocabExamples: examples.get(v.id) } : {}),
  });
}
for (const v of vocab) {
  if (seenVocab.has(v.id)) continue;
  items.push({
    lemma: v.word.toLowerCase(),
    kind: 'vocab-extra',
    vocab: { id: v.id, word: v.word, pos: v.pos, ipa: v.ipa, meaning: v.meaning },
    sentences: [],
    ...(examples.get(v.id)?.length ? { vocabExamples: examples.get(v.id) } : {}),
  });
}

// 이미 생성된 원형은 건너뛴다 (--all 이면 전부)
const done = new Set<string>();
if (!args.includes('--all') && !only) {
  const genDir = path.join(WORK, 'gen');
  for (const f of fs.existsSync(genDir) ? fs.readdirSync(genDir) : []) {
    if (/^lexicon-[\w-]+\.json$/.test(f)) for (const g of readJson<{ lemma: string }[]>(path.join(genDir, f))) done.add(g.lemma);
  }
}
const selected = only ? items.filter((i) => only.includes(i.lemma)) : items.filter((i) => !done.has(i.lemma));
// 알파벳 순으로 묶어 배치 안에서 비슷한 단어끼리 일관되게 뜻을 달게 한다
selected.sort((a, b) => a.lemma.localeCompare(b.lemma));

const dir = path.join(WORK, 'batchA');
fs.mkdirSync(dir, { recursive: true });
if (name) {
  fs.writeFileSync(path.join(dir, `in-${name}.json`), JSON.stringify(selected, null, 1));
  console.log(`in-${name}.json: ${selected.length}개`);
} else {
  for (const f of fs.readdirSync(dir)) if (/^in-\d+\.json$/.test(f)) fs.unlinkSync(path.join(dir, f));
  let n = 0;
  for (let i = 0; i < selected.length; i += size) {
    n++;
    fs.writeFileSync(
      path.join(dir, `in-${String(n).padStart(2, '0')}.json`),
      JSON.stringify(selected.slice(i, i + size), null, 1),
    );
  }
  const k = (kind: Item['kind']) => selected.filter((i) => i.kind === kind).length;
  console.log(`항목 ${selected.length}개 (vocab-core ${k('vocab-core')}, new ${k('new')}, vocab-extra ${k('vocab-extra')}) → 배치 ${n}개`);
}

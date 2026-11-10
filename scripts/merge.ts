/**
 * 4단계 — vocab + 생성 A(단어) + 생성 B(해석) 를 합쳐 앱 데이터 파일을 만든다.
 *   data/words/{a..z,0}.json   단어 (직접 편집하는 파일)
 *   data/corpus.json           ccar-f 전체 문장 (직접 추가한 단어에 예문 자동 연결용)
 *   data/sources.json          출처 파일 표시 이름
 *   pipeline/work/skipped.json 생성 단계에서 뺀 원형 (validate 의 누락 검사용)
 */
import fs from 'node:fs';
import path from 'node:path';
import type { VocabEntry } from '../src/lib/matcher';
import type { Context, Memory, Sense, Word } from '../src/lib/schema';
import { QUIZ_DATA_DIR_PATH, loadVocabExamples, readJson, vocabMdPath, WORK } from './lib/common';

interface LemmaRec {
  lemma: string;
  vocabId?: string;
  surfaces: Record<string, number>;
  freq: number;
  sources: string[];
}
interface SentenceRec {
  sid: string;
  src: string;
  q: number;
  en: string;
  lang: 'en' | 'ko';
}
interface GenItem {
  lemma: string;
  skip?: string | null;
  word?: string;
  pos?: string[];
  ipa?: string;
  meaning?: string;
  short?: string;
  senses?: Sense[];
  forms?: string[];
  synonyms?: string[];
  domain?: string;
  basic?: boolean;
  contexts?: { sid?: string; vid?: string; surface: string; pos: string; sense: string }[];
}

const DATA = path.resolve('data');
const GEN = path.join(WORK, 'gen');

const vocab = readJson<VocabEntry[]>(path.join(QUIZ_DATA_DIR_PATH, 'vocab/index.json'));
const vocabById = new Map(vocab.map((v) => [v.id, v]));
const vocabByWord = new Map(vocab.map((v) => [v.word.toLowerCase(), v]));
const vocabExamples = loadVocabExamples(vocab);
const exampleByVid = new Map([...vocabExamples.values()].flat().map((e) => [e.vid, e]));
const lemmas = new Map(readJson<LemmaRec[]>(path.join(WORK, 'lemmas.json')).map((l) => [l.lemma, l]));
const sentences = readJson<SentenceRec[]>(path.join(WORK, 'sentences.json'));
const sentenceBySid = new Map(sentences.map((s) => [s.sid, s]));

// 해석
const ko: Record<string, string> = {};
for (const f of fs.readdirSync(GEN)) {
  if (/^ko-(choices|\d+)\.json$/.test(f)) Object.assign(ko, readJson<Record<string, string>>(path.join(GEN, f)));
}

// 생성 A — pilot 을 먼저, 번호 배치가 같은 lemma 를 덮어쓴다
const gen = new Map<string, GenItem>();
const genFiles = fs
  .readdirSync(GEN)
  .filter((f) => /^lexicon-[\w-]+\.json$/.test(f))
  .sort((a, b) => (a.includes('pilot') ? -1 : b.includes('pilot') ? 1 : a.localeCompare(b)));
for (const f of genFiles) for (const g of readJson<GenItem[]>(path.join(GEN, f))) gen.set(g.lemma, g);

const warnings: string[] = [];
const skipped: Record<string, string> = {};

const slug = (w: string) =>
  w
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function findSurface(en: string, surface: string): string | undefined {
  if (en.includes(surface)) return surface;
  const i = en.toLowerCase().indexOf(surface.toLowerCase());
  return i >= 0 ? en.slice(i, i + surface.length) : undefined;
}

const words = new Map<string, Word>(); // key: word 소문자

function upsert(key: string, make: () => Word, mergeInto: (w: Word) => void) {
  const existing = words.get(key);
  if (existing) mergeInto(existing);
  else words.set(key, make());
}

for (const [lemma, g] of gen) {
  if (g.skip) {
    skipped[lemma] = g.skip;
    continue;
  }
  const lem = lemmas.get(lemma);
  const v = (lem?.vocabId ? vocabById.get(lem.vocabId) : undefined) ?? vocabByWord.get((g.word ?? lemma).toLowerCase()) ?? vocabByWord.get(lemma);
  const headword = v?.word ?? g.word ?? lemma;
  const key = headword.toLowerCase();

  const senses: Sense[] = (g.senses ?? []).filter((s) => s.ko);
  const contexts: Context[] = [];
  for (const raw of g.contexts ?? []) {
    // vocab 예문 id 를 sid 칸에 적은 경우도 받아 준다
    const c = raw.sid?.startsWith('vocab:') ? { ...raw, vid: raw.sid, sid: undefined } : raw;
    let src: string, q: number, en: string, cko: string | undefined;
    if (c.sid) {
      const s = sentenceBySid.get(c.sid);
      if (!s) {
        warnings.push(`${lemma}: 없는 sid ${c.sid}`);
        continue;
      }
      ({ src, q, en } = s);
      cko = s.lang === 'en' ? ko[c.sid] : undefined;
    } else if (c.vid) {
      const e = exampleByVid.get(c.vid);
      if (!e) {
        warnings.push(`${lemma}: 없는 vid ${c.vid}`);
        continue;
      }
      src = 'vocab';
      q = 0;
      en = e.en;
      cko = e.ko;
    } else continue;
    const surface = findSurface(en, c.surface);
    if (!surface) {
      warnings.push(`${lemma}: 문장에 "${c.surface}" 없음 (${c.sid ?? c.vid})`);
      continue;
    }
    if (!senses.some((s) => s.ko === c.sense)) {
      warnings.push(`${lemma}: sense "${c.sense}" 가 senses 에 없어 추가`);
      senses.push({ pos: c.pos, ko: c.sense });
    }
    contexts.push({ src, q, en, surface, pos: c.pos, sense: c.sense, ...(cko ? { ko: cko } : {}) });
  }

  const pos = v?.pos ? v.pos.split('·').map((p) => p.trim()) : (g.pos ?? []);
  const surfaces = Object.keys(lem?.surfaces ?? {});
  const forms = [...new Set([...(v?.forms ?? []), ...(g.forms ?? []), ...surfaces].map((f) => f.toLowerCase()))].filter(
    (f) => f !== key,
  );
  const tier: Word['tier'] = lem ? 'core' : 'extra';
  const mdPath = v ? vocabMdPath(v.id) : '';
  const note = v && fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8').trim() : undefined;

  upsert(
    key,
    () => ({
      id: v?.id ?? slug(headword),
      word: headword,
      tier,
      ...(g.basic ? { basic: true } : {}),
      pos,
      ...((v?.ipa ?? g.ipa) ? { ipa: v?.ipa ?? g.ipa } : {}),
      meaning: v?.meaning ?? g.meaning ?? senses.map((s) => s.ko).join(', '),
      short: g.short ?? senses[0]?.ko ?? '',
      senses,
      ...(forms.length ? { forms } : {}),
      ...(g.synonyms?.length ? { synonyms: g.synonyms } : {}),
      domain: g.domain ?? '일반',
      freq: lem?.freq ?? 0,
      sources: lem?.sources ?? [],
      contexts,
      ...(note ? { note } : {}),
    }),
    (w) => {
      // 같은 표제어로 모인 원형 (예: later ← late 추정) — 빈도·출처·예문·뜻을 합친다
      w.freq += lem?.freq ?? 0;
      w.sources = [...new Set([...w.sources, ...(lem?.sources ?? [])])];
      if (lem) w.tier = 'core';
      for (const s of senses) if (!w.senses.some((x) => x.ko === s.ko)) w.senses.push(s);
      for (const c of contexts) if (w.contexts.length < 4 && !w.contexts.some((x) => x.en === c.en)) w.contexts.push(c);
      w.forms = [...new Set([...(w.forms ?? []), ...forms])].filter((f) => f !== w.word.toLowerCase());
      if (w.basic && !g.basic) delete w.basic;
    },
  );
}

// 생성 결과에 없는 vocab 항목도 빠짐없이 넣는다 (생성 누락 대비)
for (const v of vocab) {
  const key = v.word.toLowerCase();
  if (words.has(key)) continue;
  warnings.push(`vocab ${v.id}: 생성 결과 없음 — vocab 정보만으로 추가`);
  const pos = (v.pos ?? '').split('·').filter(Boolean);
  words.set(key, {
    id: v.id,
    word: v.word,
    tier: 'extra',
    pos,
    ...(v.ipa ? { ipa: v.ipa } : {}),
    meaning: v.meaning,
    short: v.meaning.replace(/[①-⑨]\s*/g, '').split(/[—(]/)[0].trim(),
    senses: [{ pos: pos[0] ?? '명사', ko: v.meaning }],
    ...(v.forms?.length ? { forms: v.forms } : {}),
    domain: '일반',
    freq: 0,
    sources: [],
    contexts: [],
  });
}

// id 중복·표현 중복 정리
const usedIds = new Set<string>();
const claimed = new Map<string, string>(); // 표현 → id
const all = [...words.values()].sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'core' ? -1 : 1) || b.freq - a.freq);
for (const w of all) {
  let id = w.id;
  for (let n = 2; usedIds.has(id); n++) id = `${w.id}-${n}`;
  if (id !== w.id) warnings.push(`id 중복: ${w.id} → ${id}`);
  w.id = id;
  usedIds.add(id);
  claimed.set(w.word.toLowerCase(), w.id);
}
for (const w of all) {
  if (!w.forms) continue;
  w.forms = w.forms.filter((f) => {
    const owner = claimed.get(f);
    if (owner && owner !== w.id) return false;
    claimed.set(f, w.id);
    return true;
  });
  if (!w.forms.length) delete w.forms;
}

// 직접 넣은 외우기(어원·연상)는 생성 결과에 없으니, 지우기 전에 읽어 두었다가 같은 id 에 다시 붙인다
fs.mkdirSync(path.join(DATA, 'words'), { recursive: true });
const keptMemory = new Map<string, Memory>();
for (const f of fs.readdirSync(path.join(DATA, 'words')).filter((x) => x.endsWith('.json'))) {
  for (const r of readJson<Word[]>(path.join(DATA, 'words', f))) if (r?.id && r.memory) keptMemory.set(r.id, r.memory);
}
const withMemory = (w: Word): Word => {
  const memory = keptMemory.get(w.id);
  if (!memory) return w;
  const { note, ...rest } = w;
  return { ...rest, memory, ...(note ? { note } : {}) };
};

// 파일로 저장 — 첫 글자별
for (const f of fs.readdirSync(path.join(DATA, 'words'))) fs.unlinkSync(path.join(DATA, 'words', f));
const byLetter = new Map<string, Word[]>();
for (const w0 of all) {
  const w = withMemory(w0);
  const letter = /^[a-z]/.test(w.id) ? w.id[0] : '0';
  const list = byLetter.get(letter) ?? [];
  list.push(w);
  byLetter.set(letter, list);
}
for (const [letter, list] of byLetter) {
  list.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(DATA, 'words', `${letter}.json`), JSON.stringify(list, null, 2) + '\n');
}

// 문장 색인과 출처
const corpus = sentences.map((s) => ({
  src: s.src,
  q: s.q,
  en: s.en,
  ...(s.lang === 'en' && ko[s.sid] ? { ko: ko[s.sid] } : {}),
}));
fs.writeFileSync(path.join(DATA, 'corpus.json'), JSON.stringify(corpus));

const config = readJson<{ id: string; files: { id: string; name: string; order: number }[] }[]>(
  path.join(QUIZ_DATA_DIR_PATH, 'config.json'),
);
const set = config.find((c) => c.id === 'ccar-f')!;
const sources = [
  ...set.files.sort((a, b) => a.order - b.order).map((f) => ({ id: f.id, name: f.name })),
  { id: 'vocab', name: '기존 단어장 예문' },
];
fs.writeFileSync(path.join(DATA, 'sources.json'), JSON.stringify(sources, null, 2) + '\n');
fs.writeFileSync(path.join(WORK, 'skipped.json'), JSON.stringify(skipped, null, 1));
fs.writeFileSync(path.join(WORK, 'merge-warnings.txt'), warnings.join('\n'));

const core = all.filter((w) => w.tier === 'core').length;
console.log(`단어 ${all.length}개 (core ${core}, extra ${all.length - core}) · 제외 ${Object.keys(skipped).length}개 · 경고 ${warnings.length}개`);
console.log(`생성 A 반영 ${gen.size}개 원형 / 전체 원형 ${lemmas.size}개 · 해석 ${Object.keys(ko).length}문장`);

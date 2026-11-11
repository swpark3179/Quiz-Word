/**
 * 데이터 구조 이전 (v2) — 단어에 CCAR-F 정보가 섞여 있던 data/ 를 "공통 사전 + 시험 폴더"로 나눈다.
 *
 *   npx tsx scripts/migrations/v2.ts --write          예전 data 를 읽어 새 구조로 쓴다 (한 번만)
 *   npx tsx scripts/migrations/v2.ts [--check]        지금 data/ 가 예전 data 와 같은 내용인지 전수 비교
 *   --from <git ref>                                   예전 data 를 읽을 커밋 (기본 0f4164a — 이전 직전)
 *
 * 예전 data 와 파이프라인 작업물(lemmas·sentences)은 git 에서 읽으므로 언제든 다시 확인할 수 있다.
 *
 * 바뀌는 것
 *   - 단어: tier·basic·freq·sources·contexts·note 를 빼고 level(pipeline/work/levels/levels.json)을 넣는다
 *   - 한글 문제 파일(-kor)은 문제 파일 목록·예문·문장 색인·출현 횟수에서 모두 뺀다
 *   - contexts → exams/ccar-f/examples/<문제 파일>.json (n = 그 단어 안에서의 순서)
 *   - corpus.json → exams/ccar-f/sentences/<문제 파일>.json
 *   - note → exams/ccar-f/notes.json (줄바꿈만 CRLF → LF)
 *   - freq·sources → exams/ccar-f/index.json (문제 파일별 횟수)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildWordData, type ExamData, type RawExample } from '../../src/lib/exams';
import type { RawWord } from '../../src/lib/normalize';
import { wordRegex } from '../../src/lib/corpus';
import type { Memory, Sense } from '../../src/lib/schema';
import { maskNonProse, normalizeToken, tokenize } from '../lib/text';
import { readDict, readExams, writeDict, writeExam } from '../lib/data';

const EXAM_ID = 'ccar-f';
const EXAM_NAME = 'CCAR-F';
const DATA = path.resolve('data');

const args = process.argv.slice(2);
const refAt = args.indexOf('--from');
const REF = refAt >= 0 ? args[refAt + 1] : '0f4164a';
const WRITE = args.includes('--write');

interface OldContext {
  src: string;
  q: number;
  en: string;
  surface: string;
  pos: string;
  sense: string;
  ko?: string;
}
interface OldWord {
  id: string;
  word: string;
  tier: string;
  basic?: boolean;
  pos: string[];
  ipa?: string;
  meaning: string;
  short: string;
  senses: Sense[];
  forms?: string[];
  synonyms?: string[];
  domain: string;
  freq: number;
  sources: string[];
  contexts: OldContext[];
  memory?: Memory;
  note?: string;
}
interface LemmaRec {
  lemma: string;
  surfaces: Record<string, number>;
  freq: number;
  sources: string[];
  sids: string[];
}
interface SentenceRec {
  sid: string;
  src: string;
  en: string;
}

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const show = <T>(p: string): T => JSON.parse(git('show', `${REF}:${p}`)) as T;
const ls = (dir: string) => git('ls-tree', '--name-only', REF, `${dir}/`).split('\n').filter(Boolean);
const isKor = (src: string) => src.endsWith('-kor');

// ───── 예전 데이터 읽기
const oldWords = ls('data/words')
  .filter((f) => f.endsWith('.json'))
  .sort()
  .flatMap((f) => show<OldWord[]>(f));
const oldSources = show<{ id: string; name: string }[]>('data/sources.json');
const oldCorpus = show<{ src: string; q: number; en: string; ko?: string }[]>('data/corpus.json');
const lemmas = show<LemmaRec[]>('pipeline/work/lemmas.json');
const sentences = new Map(show<SentenceRec[]>('pipeline/work/sentences.json').map((s) => [s.sid, s]));
const skipped = show<Record<string, string>>('pipeline/work/skipped.json');
const genHead = new Map<string, string>(); // 원형 → 생성 단계에서 정한 표제어
for (const f of ls('pipeline/work/gen').filter((x) => /lexicon-.*\.json$/.test(x))) {
  for (const g of show<{ lemma: string; skip?: string | null; word?: string }[]>(f)) {
    if (!g.skip) genHead.set(g.lemma, (g.word ?? g.lemma).toLowerCase());
  }
}
const levels = JSON.parse(fs.readFileSync(path.resolve('pipeline/work/levels/levels.json'), 'utf8')).levels as Record<string, number>;

// ───── 문제 파일별 출현 횟수
const byHead = new Map(oldWords.map((w) => [w.word.toLowerCase(), w]));
const bySurface = new Map<string, OldWord>();
for (const w of oldWords) for (const s of [w.word, ...(w.forms ?? [])]) if (!bySurface.has(s.toLowerCase())) bySurface.set(s.toLowerCase(), w);

/** total 을 sources 에 나눈다 — 문제 파일마다 최소 1, 나머지는 weight 에 비례 (끝수는 큰 쪽부터) */
function allocate(total: number, sources: string[], weight: (src: string) => number): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(sources.map((s) => [s, 1]));
  let rest = total - sources.length;
  if (rest <= 0 || !sources.length) return out;
  let ws = sources.map((s) => Math.max(0, weight(s) - 1));
  if (!ws.some((x) => x > 0)) ws = sources.map(() => 1);
  const sum = ws.reduce((a, b) => a + b, 0);
  const exact = ws.map((x) => (x * rest) / sum);
  const floor = exact.map(Math.floor);
  sources.forEach((s, i) => (out[s] += floor[i]));
  rest -= floor.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - floor[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < rest; k++) out[sources[order[k % order.length].i]]++;
  return out;
}

/** 이 원형이 문장에 몇 번 나오는지 (extract 의 토큰화와 같은 방식) */
function countIn(l: LemmaRec, en: string): number {
  const masked = maskNonProse(en);
  let n = 0;
  for (const tok of tokenize(masked)) {
    const norm = normalizeToken(tok.text);
    if (!norm) continue;
    const lower = norm.toLowerCase();
    const parts = lower.includes('-') ? lower.split('-') : [lower];
    for (const p of parts) if (l.surfaces[p]) n++;
    if (parts.length > 1 && l.surfaces[lower]) n++;
  }
  const low = masked.toLowerCase();
  for (const s of Object.keys(l.surfaces)) {
    if (!s.includes(' ')) continue;
    n += low.split(s).length - 1;
  }
  return n;
}

const stats = { exact: 0, scaled: 0, fallback: 0 };
const counted = new Map<string, Record<string, number>>(); // 단어 id → 문제 파일 → 횟수 (-kor 포함)
for (const l of lemmas) {
  if (skipped[l.lemma]) continue;
  const head = genHead.get(l.lemma);
  const w = (head ? byHead.get(head) : undefined) ?? bySurface.get(l.lemma) ?? Object.keys(l.surfaces).map((s) => bySurface.get(s.toLowerCase())).find(Boolean);
  if (!w) continue;
  const raw: Record<string, number> = {};
  const perSid: Record<string, number> = {};
  for (const sid of l.sids) {
    const s = sentences.get(sid);
    if (!s) continue;
    raw[s.src] = (raw[s.src] ?? 0) + countIn(l, s.en);
    perSid[s.src] = (perSid[s.src] ?? 0) + 1;
  }
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  const same = sum === l.freq && l.sources.every((s) => raw[s] > 0) && Object.keys(raw).every((s) => !raw[s] || l.sources.includes(s));
  if (same) stats.exact++;
  else stats.scaled++;
  const split = same ? raw : allocate(l.freq, l.sources, (s) => raw[s] || perSid[s] || 1);
  const acc = counted.get(w.id) ?? {};
  for (const [src, n] of Object.entries(split)) if (n > 0) acc[src] = (acc[src] ?? 0) + n;
  counted.set(w.id, acc);
}

const index: ExamData['index'] = {};
for (const w of oldWords) {
  if (!w.sources.length) continue;
  let occ = counted.get(w.id) ?? {};
  const total = Object.values(occ).reduce((a, b) => a + b, 0);
  const sameSources = Object.keys(occ).length === w.sources.length && w.sources.every((s) => occ[s] > 0);
  if (total !== w.freq || !sameSources) {
    // 원형과 단어가 깔끔하게 대응하지 않는 단어: 기록된 freq·sources 를 문장 속 표기 수에 비례해 나눈다
    stats.fallback++;
    const re = new RegExp(wordRegex(w).source, 'gi');
    const hits: Record<string, number> = {};
    for (const s of oldCorpus) hits[s.src] = (hits[s.src] ?? 0) + (s.en.match(re)?.length ?? 0);
    occ = allocate(w.freq, w.sources, (s) => hits[s] ?? 0);
  }
  const kept = Object.fromEntries(w.sources.filter((s) => !isKor(s)).map((s) => [s, occ[s]]));
  if (Object.keys(kept).length) index[w.id] = kept;
}

// ───── 새 구조
const sources = [
  ...oldSources.filter((s) => s.id !== 'vocab' && !isKor(s.id)).map((s) => ({ id: s.id, name: s.name })),
  ...oldSources.filter((s) => s.id === 'vocab').map((s) => ({ id: s.id, name: s.name, kind: 'wordbook' as const })),
];
const exam: ExamData = { id: EXAM_ID, name: EXAM_NAME, order: 1, sources, index, examples: {}, sentences: {}, notes: {} };
for (const w of oldWords) {
  w.contexts.forEach((c, n) => {
    if (isKor(c.src)) return;
    const e: RawExample = { n, q: c.q, en: c.en, surface: c.surface, pos: c.pos, sense: c.sense, ...(c.ko ? { ko: c.ko } : {}) };
    ((exam.examples[c.src] ??= {})[w.id] ??= []).push(e);
  });
  if (w.note) exam.notes[w.id] = w.note.replace(/\r\n/g, '\n');
}
for (const s of oldCorpus) {
  if (isKor(s.src)) continue;
  (exam.sentences[s.src] ??= []).push({ q: s.q, en: s.en, ...(s.ko ? { ko: s.ko } : {}) });
}

const dictWord = (w: OldWord, memory: Memory | undefined): RawWord => ({
  id: w.id,
  word: w.word,
  level: levels[w.id],
  pos: w.pos,
  ...(w.ipa ? { ipa: w.ipa } : {}),
  meaning: w.meaning,
  short: w.short,
  senses: w.senses,
  ...(w.forms?.length ? { forms: w.forms } : {}),
  ...(w.synonyms?.length ? { synonyms: w.synonyms } : {}),
  domain: w.domain,
  ...(memory ? { memory } : {}),
});

if (WRITE) {
  for (const w of oldWords) if (!levels[w.id]) throw new Error(`등급 없음: ${w.id} — 먼저 npx tsx scripts/apply-levels.ts`);
  writeDict(DATA, oldWords.map((w) => dictWord(w, w.memory)));
  writeExam(DATA, exam);
  for (const f of ['sources.json', 'corpus.json']) fs.rmSync(path.join(DATA, f), { force: true });
  console.log(`새 구조로 썼습니다 — data/words, data/exams/${EXAM_ID}`);
}

// ───── 전수 비교: 지금 data/ ↔ 예전 data
const errors: string[] = [];
const fail = (m: string) => errors.push(m);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const nowWords = readDict(DATA);
const nowExams = readExams(DATA);
const nowById = new Map(nowWords.map((w) => [w.id!, w as RawWord & Record<string, unknown>]));
if (nowWords.length !== oldWords.length) fail(`단어 수 ${oldWords.length} → ${nowWords.length}`);
let newMemory = 0;
for (const o of oldWords) {
  const n = nowById.get(o.id);
  if (!n) {
    fail(`${o.id}: 단어가 없어짐`);
    continue;
  }
  const want = dictWord(o, undefined) as Record<string, unknown>;
  for (const k of ['word', 'pos', 'ipa', 'meaning', 'short', 'senses', 'forms', 'synonyms', 'domain']) {
    if (!eq(want[k], n[k])) fail(`${o.id}: ${k} 가 달라짐`);
  }
  if (n.level !== levels[o.id]) fail(`${o.id}: level ${String(n.level)} (levels.json 은 ${levels[o.id]})`);
  if (o.memory && !eq(o.memory, n.memory)) fail(`${o.id}: 예전 memory 가 바뀜`);
  if (!o.memory && n.memory) newMemory++;
  for (const k of ['tier', 'basic', 'freq', 'sources', 'contexts', 'note']) if (k in n) fail(`${o.id}: 예전 필드 ${k} 가 남아 있음`);
}
for (const id of nowById.keys()) if (!oldWords.some((o) => o.id === id)) fail(`${id}: 예전에 없던 단어`);

const nowExam = nowExams.find((e) => e.id === EXAM_ID);
if (!nowExam) fail(`data/exams/${EXAM_ID} 가 없음`);
else {
  for (const k of ['name', 'sources', 'index', 'examples', 'sentences', 'notes'] as const) {
    if (!eq(sortKeys(exam[k]), sortKeys(nowExam[k]))) fail(`exams/${EXAM_ID}: ${k} 가 예전 데이터와 다름`);
  }
}

// 앱이 읽는 방식으로 읽어서 한 번 더 확인
const built = buildWordData(nowWords, nowExams);
const report = { contexts: 0, notes: 0, members: 0, korContexts: 0, korOnlyWords: [] as string[], sentences: 0, freqOld: 0, freqNew: 0 };
for (const o of oldWords) {
  const w = built.WORD_BY_ID.get(o.id);
  if (!w) continue;
  const wantCtx = o.contexts.filter((c) => !isKor(c.src)).map((c) => ({ cat: EXAM_ID, src: c.src, q: c.q, en: c.en, surface: c.surface, pos: c.pos, sense: c.sense, ...(c.ko ? { ko: c.ko } : {}) }));
  if (!eq(wantCtx, w.contexts)) fail(`${o.id}: 예문이 달라짐 (예전 ${wantCtx.length}개, 지금 ${w.contexts.length}개)`);
  report.contexts += w.contexts.length;
  report.korContexts += o.contexts.length - wantCtx.length;
  const wantNote = o.note?.replace(/\r\n/g, '\n');
  const note = w.notes?.find((x) => x.cat === EXAM_ID)?.md;
  if (wantNote !== note) fail(`${o.id}: 노트가 달라짐`);
  if (note) report.notes++;
  const wantSources = o.sources.filter((s) => !isKor(s)).sort();
  const nowSources = Object.keys(w.occ[EXAM_ID] ?? {}).sort();
  if (!eq(wantSources, nowSources)) fail(`${o.id}: 나온 문제 파일이 달라짐 (${wantSources.join(',')} → ${nowSources.join(',')})`);
  if (nowSources.length) report.members++;
  else if (o.sources.length) report.korOnlyWords.push(o.id);
  if (w.freq > o.freq) fail(`${o.id}: 횟수가 늘어남 (${o.freq} → ${w.freq})`);
  if (!o.sources.some(isKor) && w.freq !== o.freq) fail(`${o.id}: 한글 파일에 안 나왔는데 횟수가 바뀜 (${o.freq} → ${w.freq})`);
  report.freqOld += o.freq;
  report.freqNew += w.freq;
}
report.sentences = Object.values(nowExam?.sentences ?? {}).reduce((a, l) => a + l.length, 0);
const wantSentences = oldCorpus.filter((s) => !isKor(s.src)).length;
if (report.sentences !== wantSentences) fail(`문장 색인 ${wantSentences} → ${report.sentences}`);
const allSrc = new Set([...Object.keys(nowExam?.examples ?? {}), ...Object.keys(nowExam?.sentences ?? {}), ...Object.values(nowExam?.index ?? {}).flatMap((o) => Object.keys(o))]);
for (const s of allSrc) if (isKor(s)) fail(`한글 문제 파일 ${s} 가 남아 있음`);

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  return v;
}

const oldCtx = oldWords.reduce((a, w) => a + w.contexts.length, 0);
console.log(`예전 데이터: ${REF}`);
console.log(`단어          ${oldWords.length} → ${nowWords.length}  (공통 필드 일치, 새 외우기 ${newMemory}개)`);
console.log(`예문          ${oldCtx} → ${report.contexts}  (한글 문제 파일 ${report.korContexts}개 제외)`);
console.log(`노트          ${oldWords.filter((w) => w.note).length} → ${report.notes}`);
console.log(`문장 색인     ${oldCorpus.length} → ${report.sentences}  (한글 문제 파일 ${oldCorpus.length - wantSentences}개 제외)`);
console.log(`문제 파일     ${oldSources.length} → ${nowExam?.sources.map((s) => s.id).join(', ')}`);
console.log(`시험 소속     ${oldWords.filter((w) => w.sources.length).length} → ${report.members}  (한글 문제 파일에만 나온 단어 ${report.korOnlyWords.length}개: ${report.korOnlyWords.join(', ')})`);
console.log(`출현 횟수 합  ${report.freqOld} → ${report.freqNew}  (한글 문제 파일 몫 ${report.freqOld - report.freqNew})`);
console.log(`횟수 나누기   원형 ${stats.exact}개는 다시 센 값이 기록과 일치, ${stats.scaled}개는 비례 배분, 단어 ${stats.fallback}개는 표기 수 비례`);
for (const e of errors.slice(0, 50)) console.log(`  오류  ${e}`);
if (errors.length > 50) console.log(`  … 오류 ${errors.length - 50}개 더`);
console.log(errors.length ? `불일치 ${errors.length}건` : '모두 일치');
process.exit(errors.length ? 1 : 0);

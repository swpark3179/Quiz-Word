/**
 * 4단계 — 한 시험의 생성 결과를 앱 데이터에 합친다.
 *
 *   data/words/{a..z,0}.json     공통 사전 — **새 단어만 추가**한다. 이미 있는 단어는 뜻·등급·외우기를 건드리지 않고,
 *                                이 시험에서 새로 확인된 뜻(senses)과 변화형(forms)만 덧붙인다 (경고로 알려 준다)
 *   data/exams/<시험 id>/        그 시험 폴더만 통째로 새로 쓴다 (다른 시험 폴더는 건드리지 않는다)
 *   pipeline/work/<시험 id>/skipped.json        생성 단계에서 뺀 원형 (validate 의 누락 검사용)
 *   pipeline/work/<시험 id>/merge-warnings.txt  확인이 필요한 항목
 *
 * 실행: npm run data:merge -- --exam <시험 id>
 * 입력: pipeline/work/<시험 id>/ 의 lemmas.json·sentences.json (data:extract), gen/lexicon-*.json (생성 A), gen/ko-*.json (생성 B)
 */
import fs from 'node:fs';
import path from 'node:path';
import { slugId } from '../src/lib/exampack';
import type { ExamData, RawExample } from '../src/lib/exams';
import type { VocabEntry } from '../src/lib/matcher';
import { normalizeMemory, type RawWord } from '../src/lib/normalize';
import { DEFAULT_LEVEL, MAX_LEVEL, type Memory, type Sense, type SourceInfo } from '../src/lib/schema';
import { examFiles, examFromArgs, isExcluded, isMain, loadVocabExamples, loadWordbook, QUIZ_DATA_DIR_PATH, readJson, wordbookMdPath, workDirOf, type ExamConfig } from './lib/common';
import { dictFileOf, readDictFiles, writeExam } from './lib/data';

interface LemmaRec {
  lemma: string;
  vocabId?: string;
  known?: string;
  surfaces: Record<string, number>;
  freq: number;
  bySource?: Record<string, number>;
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
  level?: number;
  memory?: Memory;
  contexts?: { sid?: string; vid?: string; surface: string; pos: string; sense: string }[];
}

export interface MergeOptions {
  exam: ExamConfig;
  /** 문제 원본 폴더 (config.json, 단어장) */
  quizDir: string;
  /** pipeline/work/<시험 id> */
  workDir: string;
  /** data 폴더 */
  dataDir: string;
  quiet?: boolean;
}

/** 단어마다 붙일 예문 수 */
const MAX_EXAMPLES = 4;

function findSurface(en: string, surface: string): string | undefined {
  if (en.includes(surface)) return surface;
  const i = en.toLowerCase().indexOf(surface.toLowerCase());
  return i >= 0 ? en.slice(i, i + surface.length) : undefined;
}

export function runMerge({ exam, quizDir, workDir, dataDir, quiet }: MergeOptions) {
  const GEN = path.join(workDir, 'gen');
  const warnings: string[] = [];
  const skipped: Record<string, string> = {};

  // ───── 입력
  const files = examFiles(quizDir, exam);
  const quizIds = new Set(files.map((f) => f.id));
  const vocab: VocabEntry[] = loadWordbook(quizDir, exam);
  const vocabById = new Map(vocab.map((v) => [v.id, v]));
  const vocabByWord = new Map(vocab.map((v) => [v.word.toLowerCase(), v]));
  const exampleByVid = new Map([...loadVocabExamples(quizDir, exam, vocab).values()].flat().map((e) => [e.vid, e]));
  const lemmas = new Map(readJson<LemmaRec[]>(path.join(workDir, 'lemmas.json')).map((l) => [l.lemma, l]));
  const sentences = readJson<SentenceRec[]>(path.join(workDir, 'sentences.json')).filter((s) => quizIds.has(s.src));
  const sentenceBySid = new Map(sentences.map((s) => [s.sid, s]));

  const ko: Record<string, string> = {};
  const gen = new Map<string, GenItem>();
  if (fs.existsSync(GEN)) {
    for (const f of fs.readdirSync(GEN)) {
      if (/^ko-(choices|\d+)\.json$/.test(f)) Object.assign(ko, readJson<Record<string, string>>(path.join(GEN, f)));
    }
    // pilot 을 먼저, 번호 배치가 같은 원형을 덮어쓴다
    const genFiles = fs
      .readdirSync(GEN)
      .filter((f) => /^lexicon-[\w-]+\.json$/.test(f))
      .sort((a, b) => (a.includes('pilot') ? -1 : b.includes('pilot') ? 1 : a.localeCompare(b)));
    for (const f of genFiles) for (const g of readJson<GenItem[]>(path.join(GEN, f))) gen.set(g.lemma, g);
  }

  // ───── 공통 사전 (있는 그대로 읽어 두고, 바뀐 파일만 다시 쓴다)
  const dictFiles = readDictFiles(dataDir);
  const before = new Map([...dictFiles].map(([f, list]) => [f, JSON.stringify(list)]));
  const dict = new Map<string, RawWord>();
  const byHead = new Map<string, RawWord>();
  const claimed = new Map<string, string>(); // 표기(소문자) → 단어 id
  for (const w of [...dictFiles.values()].flat()) {
    if (!w.id || !w.word) continue;
    dict.set(w.id, w);
    byHead.set(w.word.toLowerCase(), w);
  }
  for (const w of dict.values()) claimed.set(w.word!.toLowerCase(), w.id!);
  for (const w of dict.values()) for (const f of w.forms ?? []) if (!claimed.has(f.toLowerCase())) claimed.set(f.toLowerCase(), w.id!);
  const added: RawWord[] = [];
  const touched = new Set<string>();

  // ───── 시험 데이터
  const index: ExamData['index'] = {};
  const examples: ExamData['examples'] = {};
  const notes: ExamData['notes'] = {};
  const exampleCount = new Map<string, number>(); // 단어 id → 붙인 예문 수
  const seenExample = new Set<string>(); // 단어 id + 문장
  let droppedExcluded = 0;

  const addForms = (w: RawWord, forms: string[]) => {
    for (const f of forms.map((x) => x.toLowerCase())) {
      if (f === w.word!.toLowerCase()) continue;
      const owner = claimed.get(f);
      if (owner && owner !== w.id) continue; // 다른 단어의 표기
      if (owner === w.id) continue;
      claimed.set(f, w.id!);
      (w.forms ??= []).push(f);
      if (!added.includes(w)) touched.add(w.id!);
    }
  };

  for (const [lemma, g] of gen) {
    if (g.skip) {
      skipped[lemma] = g.skip;
      continue;
    }
    const lem = lemmas.get(lemma);
    const v = (lem?.vocabId ? vocabById.get(lem.vocabId) : undefined) ?? vocabByWord.get((g.word ?? lemma).toLowerCase()) ?? vocabByWord.get(lemma);
    const headword = v?.word ?? g.word ?? lemma;
    const surfaces = Object.keys(lem?.surfaces ?? {});

    // 사전에서 찾는다: 추출 때 찾아 둔 단어 → 같은 표제어 → 같은 표기
    let w = (lem?.known ? dict.get(lem.known) : undefined) ?? byHead.get(headword.toLowerCase()) ?? dict.get(claimed.get(lemma) ?? '');
    if (!w) {
      const senses: Sense[] = (g.senses ?? []).filter((s) => s.ko);
      const pos = v?.pos ? v.pos.split('·').map((p) => p.trim()) : (g.pos ?? []);
      let id = v?.id ?? slugId(headword);
      const base = id;
      for (let n = 2; dict.has(id); n++) id = `${base}-${n}`;
      if (id !== base) warnings.push(`id 중복: ${base} → ${id}`);
      let level = g.level;
      if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
        warnings.push(`${lemma}: level 이 없어 ${DEFAULT_LEVEL}단계로 넣음 — 확인`);
        level = DEFAULT_LEVEL;
      }
      const memory = normalizeMemory(g.memory);
      if (!memory && level >= 2) warnings.push(`${lemma}: 외우기(memory) 없음`);
      w = {
        id,
        word: headword,
        level,
        pos,
        ...((v?.ipa ?? g.ipa) ? { ipa: v?.ipa ?? g.ipa } : {}),
        meaning: v?.meaning ?? g.meaning ?? senses.map((s) => s.ko).join(', '),
        short: g.short ?? senses[0]?.ko ?? '',
        senses,
        ...(g.synonyms?.length ? { synonyms: g.synonyms } : {}),
        domain: g.domain ?? '일반',
        ...(memory ? { memory } : {}),
      };
      dict.set(id, w);
      byHead.set(headword.toLowerCase(), w);
      claimed.set(headword.toLowerCase(), id);
      added.push(w);
    }
    const wid = w.id!;
    addForms(w, [...(v?.forms ?? []), ...(added.includes(w) ? (g.forms ?? []) : []), ...surfaces]);
    if (w.forms && !w.forms.length) delete w.forms;

    // 출현 횟수
    if (lem) {
      if (!lem.bySource) throw new Error(`${path.join(workDir, 'lemmas.json')} 에 문제 파일별 횟수(bySource)가 없습니다 — data:extract 를 다시 실행하세요`);
      for (const [src, n] of Object.entries(lem.bySource)) {
        if (!quizIds.has(src) || !(n > 0)) continue;
        (index[wid] ??= {})[src] = (index[wid][src] ?? 0) + n;
      }
    }

    // 예문
    w.senses ??= [];
    for (const raw of g.contexts ?? []) {
      if ((exampleCount.get(wid) ?? 0) >= MAX_EXAMPLES) break;
      // 단어장 예문 id 를 sid 칸에 적은 경우도 받아 준다
      const bookPrefix = exam.wordbook ? `${exam.wordbook.id}:` : undefined;
      const c = bookPrefix && raw.sid?.startsWith(bookPrefix) ? { ...raw, vid: raw.sid, sid: undefined } : raw;
      let src: string, q: number, en: string, cko: string | undefined;
      if (c.sid) {
        const s = sentenceBySid.get(c.sid);
        if (!s) {
          if (isExcluded(exam, c.sid.split('#')[0])) droppedExcluded++;
          else warnings.push(`${lemma}: 없는 sid ${c.sid}`);
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
        src = exam.wordbook!.id;
        q = 0;
        en = e.en;
        cko = e.ko;
      } else continue;
      const surface = findSurface(en, c.surface);
      if (!surface) {
        warnings.push(`${lemma}: 문장에 "${c.surface}" 없음 (${c.sid ?? c.vid})`);
        continue;
      }
      if (!w.senses.some((s) => s.ko === c.sense)) {
        warnings.push(`${w.word}: 뜻 "${c.sense}" 를 senses 에 추가`);
        w.senses.push({ pos: c.pos, ko: c.sense });
        if (!added.includes(w)) touched.add(wid);
      }
      const seenKey = `${wid}\n${en}`;
      if (seenExample.has(seenKey)) continue;
      seenExample.add(seenKey);
      const n = exampleCount.get(wid) ?? 0;
      exampleCount.set(wid, n + 1);
      const e: RawExample = { n, q, en, surface, pos: c.pos, sense: c.sense, ...(cko ? { ko: cko } : {}) };
      ((examples[src] ??= {})[wid] ??= []).push(e);
    }
    // 생성 결과가 알려 준 새 뜻 (사전에 있던 단어에는 예문에 실제로 쓰인 뜻만 위에서 추가된다)
    if (added.includes(w)) for (const s of g.senses ?? []) if (s.ko && !w.senses.some((x) => x.ko === s.ko)) w.senses.push(s);
  }

  // ───── 기존 단어장: 생성 결과가 없는 항목도 사전에 넣고, 항목의 .md 는 그 시험의 노트로
  for (const v of vocab) {
    const key = v.word.toLowerCase();
    let w = byHead.get(key);
    if (!w) {
      warnings.push(`단어장 ${v.id}: 생성 결과 없음 — 단어장 정보만으로 추가 (${DEFAULT_LEVEL}단계, 확인)`);
      const pos = (v.pos ?? '').split('·').map((p) => p.trim()).filter(Boolean);
      let id = v.id;
      for (let n = 2; dict.has(id); n++) id = `${v.id}-${n}`;
      w = {
        id,
        word: v.word,
        level: DEFAULT_LEVEL,
        pos,
        ...(v.ipa ? { ipa: v.ipa } : {}),
        meaning: v.meaning,
        short: v.meaning.replace(/[①-⑨]\s*/g, '').split(/[—(]/)[0].trim(),
        senses: [{ pos: pos[0] ?? '명사', ko: v.meaning }],
        domain: '일반',
      };
      dict.set(id, w);
      byHead.set(key, w);
      claimed.set(key, id);
      added.push(w);
      addForms(w, v.forms ?? []);
    }
    const md = wordbookMdPath(quizDir, exam, v.id);
    if (fs.existsSync(md)) notes[w.id!] = fs.readFileSync(md, 'utf8').replace(/\r\n/g, '\n').trim();
  }

  // ───── 쓰기: 사전은 바뀐 파일만
  for (const w of added) {
    const f = dictFileOf(w.id!);
    if (!dictFiles.has(f)) dictFiles.set(f, []);
    dictFiles.get(f)!.push(w);
  }
  const wordsDir = path.join(dataDir, 'words');
  fs.mkdirSync(wordsDir, { recursive: true });
  let rewritten = 0;
  for (const [f, list] of dictFiles) {
    list.sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));
    if (JSON.stringify(list) === before.get(f)) continue;
    fs.writeFileSync(path.join(wordsDir, f), JSON.stringify(list, null, 2) + '\n');
    rewritten++;
  }

  const sources: SourceInfo[] = [...files, ...(exam.wordbook ? [{ id: exam.wordbook.id, name: exam.wordbook.name, kind: 'wordbook' as const }] : [])];
  const sentenceFiles: ExamData['sentences'] = {};
  for (const s of sentences) (sentenceFiles[s.src] ??= []).push({ q: s.q, en: s.en, ...(s.lang === 'en' && ko[s.sid] ? { ko: ko[s.sid] } : {}) });
  const data: ExamData = { id: exam.id, name: exam.name, ...(exam.order !== undefined ? { order: exam.order } : {}), sources, index, examples, sentences: sentenceFiles, notes };
  writeExam(dataDir, data);

  fs.writeFileSync(path.join(workDir, 'skipped.json'), JSON.stringify(skipped, null, 1));
  fs.writeFileSync(path.join(workDir, 'merge-warnings.txt'), warnings.join('\n'));

  const result = {
    added: added.map((w) => w.id!),
    touched: [...touched],
    members: Object.keys(index).length,
    examples: [...exampleCount.values()].reduce((a, b) => a + b, 0),
    notes: Object.keys(notes).length,
    sentences: sentences.length,
    skipped: Object.keys(skipped).length,
    warnings,
  };
  if (!quiet) {
    console.log(`${exam.name} (data/exams/${exam.id}): 문제 파일 ${files.length}개 · 나온 단어 ${result.members}개 · 예문 ${result.examples}개 · 문장 ${result.sentences}개 · 노트 ${result.notes}개`);
    console.log(`사전: 새 단어 ${added.length}개 추가, 기존 단어 ${touched.size}개에 뜻·변화형 추가 (파일 ${rewritten}개 고침) — 그 밖의 단어는 그대로`);
    if (droppedExcluded) console.log(`뺀 문제 파일(${(exam.exclude ?? []).join(', ')})의 예문 ${droppedExcluded}개는 넣지 않음`);
    console.log(`제외 ${result.skipped}개 · 경고 ${warnings.length}개 (${path.relative(process.cwd(), path.join(workDir, 'merge-warnings.txt'))})`);
    console.log(`생성 A 반영 ${gen.size}개 원형 / 전체 원형 ${lemmas.size}개 · 해석 ${Object.keys(ko).length}문장`);
  }
  return result;
}

if (isMain(import.meta.url)) {
  const exam = examFromArgs();
  runMerge({ exam, quizDir: QUIZ_DATA_DIR_PATH, workDir: workDirOf(exam), dataDir: path.resolve('data') });
}

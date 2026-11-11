/**
 * 시험(카테고리) 데이터 — 웹·앱 공용.
 *
 * 단어의 뜻·품사·외우기는 공통 사전(data/words)에 있고, 시험에 딸린 것은 시험 폴더(data/exams/<id>)에 따로 있다:
 *   exam.json                 시험 이름과 문제 파일 목록
 *   index.json                단어 → 문제 파일별 나온 횟수 (그 시험에 속하는지, 얼마나 자주 나오는지)
 *   examples/<문제 파일>.json  단어 → 뜻이 정해진 예문
 *   sentences/<문제 파일>.json 문제 문장 전체 (예문이 없는 단어에 자동으로 붙이고, "더 보기"에 쓴다)
 *   notes.json                단어 → 그 시험용 노트
 *
 * buildWordData 가 사전과 시험 데이터를 합쳐 화면이 쓰는 목록·색인을 만든다.
 */
import { createCorpusIndex, type CorpusSentence, type ExamplePref } from './corpus';
import { normalizeWord, type RawWord } from './normalize';
import type { Context, ExamInfo, SourceInfo, Word } from './schema';
import { sortByWord } from './text';

/** 예문 파일의 한 항목. n 은 그 단어의 예문을 보여 줄 순서(없으면 문제 파일 순서 뒤) */
export interface RawExample {
  n?: number;
  q?: number;
  en: string;
  surface: string;
  pos: string;
  sense: string;
  ko?: string;
}

export interface ExamSentence {
  q?: number;
  en: string;
  ko?: string;
}

/** 시험 하나의 데이터 전체 — 단어 세트 파일에도 이 모양 그대로 담는다 */
export interface ExamData {
  id: string;
  name: string;
  /** 시험을 보여 줄 순서 (작은 것부터, 없으면 id 순) */
  order?: number;
  sources: SourceInfo[];
  index: Record<string, Record<string, number>>;
  examples: Record<string, Record<string, RawExample[]>>;
  sentences: Record<string, ExamSentence[]>;
  notes: Record<string, string>;
}

/** 단어장 시험 선택의 "어느 시험 문제에도 안 나온 단어" */
export const NO_EXAM = '-';

/** 문제 파일인지 (예문만 있는 단어장 파일 제외) */
export const isQuizSource = (s: SourceInfo) => s.kind !== 'wordbook';

export function sortExams<T extends { id: string; order?: number }>(exams: readonly T[]): T[] {
  return [...exams].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * 파일 경로와 내용의 목록을 시험 데이터로 묶는다.
 * 경로는 ".../<시험 id>/exam.json", ".../<시험 id>/examples/<문제 파일 id>.json" 처럼 끝나면 된다
 * (웹은 import.meta.glob 의 키, 앱은 sync 스크립트가 만든 목록, 스크립트는 실제 파일 경로).
 */
export function assembleExams(files: Iterable<readonly [path: string, data: unknown]>): ExamData[] {
  const exams = new Map<string, ExamData>();
  const get = (id: string) => {
    let e = exams.get(id);
    if (!e) exams.set(id, (e = { id, name: id, sources: [], index: {}, examples: {}, sentences: {}, notes: {} }));
    return e;
  };
  for (const [p, data] of files) {
    const parts = p.replace(/\\/g, '/').replace(/\.json$/, '').split('/');
    const leaf = parts[parts.length - 1];
    const dir = parts[parts.length - 2];
    if (!data || typeof data !== 'object') continue;
    if (dir === 'examples' || dir === 'sentences') {
      const exam = get(parts[parts.length - 3]);
      if (dir === 'examples') exam.examples[leaf] = data as Record<string, RawExample[]>;
      else exam.sentences[leaf] = data as ExamSentence[];
    } else if (leaf === 'exam') {
      const meta = data as Partial<ExamData>;
      const exam = get(dir);
      exam.name = meta.name || dir;
      if (typeof meta.order === 'number') exam.order = meta.order;
      exam.sources = Array.isArray(meta.sources) ? meta.sources : [];
    } else if (leaf === 'index') get(dir).index = data as ExamData['index'];
    else if (leaf === 'notes') get(dir).notes = data as ExamData['notes'];
  }
  return sortExams([...exams.values()]);
}

/** 이 시험(·이 문제 파일)에 나온 단어인지. 시험을 정하지 않으면 모든 단어 */
export function inExam(w: Word, cat?: string, file?: string): boolean {
  if (!cat) return true;
  const occ = w.occ[cat];
  if (!occ) return false;
  return file ? (occ[file] ?? 0) > 0 : true;
}

const totals = new WeakMap<Word, Record<string, number>>();

/** 이 시험(·이 문제 파일)에 나온 횟수. 시험을 정하지 않으면 모든 시험의 합 */
export function freqIn(w: Word, cat?: string, file?: string): number {
  if (!cat) return w.freq;
  const occ = w.occ[cat];
  if (!occ) return 0;
  if (file) return occ[file] ?? 0;
  let t = totals.get(w);
  if (!t) totals.set(w, (t = {}));
  return (t[cat] ??= Object.values(occ).reduce((a, b) => a + b, 0));
}

/** 어느 시험 문제에도 안 나온 단어 ("확장") */
export const isExtra = (w: Word) => w.freq === 0;

export function buildWordData(rawWords: readonly RawWord[], examsIn: readonly ExamData[]) {
  const exams = sortExams(examsIn);
  const words = rawWords.filter((r) => r && r.id && r.word).map(normalizeWord);
  const byId = new Map(words.map((w) => [w.id, w]));
  const corpus: CorpusSentence[] = [];

  for (const exam of exams) {
    const quiz = new Set(exam.sources.filter(isQuizSource).map((s) => s.id));
    for (const [id, bySrc] of Object.entries(exam.index ?? {})) {
      const w = byId.get(id);
      if (!w || !bySrc) continue;
      const occ: Record<string, number> = {};
      for (const [src, n] of Object.entries(bySrc)) {
        if (!quiz.has(src) || !(n > 0)) continue;
        occ[src] = n;
        w.freq += n;
      }
      if (Object.keys(occ).length) w.occ[exam.id] = occ;
    }

    // 예문: 단어마다 정해 둔 순서(n)대로, 순서가 없으면 문제 파일 순서대로
    const perWord = new Map<string, { c: Context; n: number; i: number }[]>();
    let i = 0;
    for (const s of exam.sources) {
      for (const [id, list] of Object.entries(exam.examples?.[s.id] ?? {})) {
        if (!byId.has(id) || !Array.isArray(list)) continue;
        let bucket = perWord.get(id);
        if (!bucket) perWord.set(id, (bucket = []));
        for (const e of list) {
          if (!e || typeof e.en !== 'string') continue;
          const c: Context = { cat: exam.id, src: s.id, q: e.q ?? 0, en: e.en, surface: e.surface ?? '', pos: e.pos ?? '', sense: e.sense ?? '', ...(e.ko ? { ko: e.ko } : {}) };
          bucket.push({ c, n: typeof e.n === 'number' ? e.n : 1e9, i: i++ });
        }
      }
      if (isQuizSource(s)) {
        for (const sen of exam.sentences?.[s.id] ?? []) {
          if (sen && typeof sen.en === 'string') corpus.push({ cat: exam.id, src: s.id, q: sen.q ?? 0, en: sen.en, ...(sen.ko ? { ko: sen.ko } : {}) });
        }
      }
    }
    for (const [id, list] of perWord) {
      byId.get(id)!.contexts.push(...list.sort((a, b) => a.n - b.n || a.i - b.i).map((x) => x.c));
    }
    for (const [id, md] of Object.entries(exam.notes ?? {})) {
      const w = byId.get(id);
      if (w && typeof md === 'string' && md.trim()) (w.notes ??= []).push({ cat: exam.id, md });
    }
  }

  /** 표제어 순 */
  const WORDS = sortByWord(words);
  /** 자주 나온 순 (같으면 표제어 순) — 단어장이 필터만 해서 쓰도록 미리 한 번 정렬해 둔다 */
  const WORDS_BY_FREQ = WORDS.map((w, i) => ({ w, i }))
    .sort((a, b) => b.w.freq - a.w.freq || a.i - b.i)
    .map((x) => x.w);
  const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));
  /** 소문자 표기(표제어·forms) → 단어 */
  const WORD_BY_SURFACE = new Map<string, Word>();
  for (const w of WORDS) {
    for (const s of [w.word, ...(w.forms ?? [])]) {
      const k = s.toLowerCase();
      if (!WORD_BY_SURFACE.has(k)) WORD_BY_SURFACE.set(k, w);
    }
  }

  const EXAMS: ExamInfo[] = exams.map((e) => ({ id: e.id, name: e.name, sources: e.sources }));
  const examById = new Map(EXAMS.map((e) => [e.id, e]));
  const examName = (id: string | undefined) => (id ? (examById.get(id)?.name ?? id) : '');
  /** 그 시험의 문제 파일 목록 (예문 전용 파일 제외) */
  const quizSources = (cat: string | undefined): SourceInfo[] => (cat ? (examById.get(cat)?.sources.filter(isQuizSource) ?? []) : []);
  const sourceInfo = (cat: string, src: string) => examById.get(cat)?.sources.find((s) => s.id === src);
  const sourceName = (cat: string, src: string) => sourceInfo(cat, src)?.name ?? src;

  /** 예문의 출처 표시 — "샘플문제1 · 문제 3". 시험이 여럿이고 보고 있는 시험의 예문이 아니면 시험 이름을 앞에 붙인다 */
  function sourceLabel(c: { cat: string; src: string; q: number }, pref?: ExamplePref): string {
    const s = sourceInfo(c.cat, c.src);
    const label = !s ? c.src : !isQuizSource(s) || !c.q ? s.name : `${s.name} · 문제 ${c.q}`;
    return EXAMS.length > 1 && c.cat !== pref?.cat ? `${examName(c.cat)} · ${label}` : label;
  }

  const { corpusExamples, contextsOf } = createCorpusIndex(corpus);

  return { WORDS, WORDS_BY_FREQ, WORD_BY_ID, WORD_BY_SURFACE, EXAMS, examName, quizSources, sourceName, sourceLabel, corpusExamples, contextsOf };
}

export type WordData = ReturnType<typeof buildWordData>;

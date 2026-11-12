/**
 * 시험 팩 — 시험 하나와 그 시험이 쓰는 단어를 담은 독립 파일 (*.exampack.json).
 *
 * 단어 세트 파일(wordset.ts)이 사전과 모든 시험을 통째로 바꾸는 것과 달리, 시험 팩은 지금 있는 단어·시험 위에 **얹는다**.
 * 그래서 이 저장소(기존 사전)를 모르는 사람·에이전트도 문제 파일만 보고 만들 수 있다.
 * 형식과 작성법은 docs/exam-pack-guide.md, 검사 규칙은 이 파일의 validateExamPack (docs/validate-exampack.mjs 가 이 코드를 그대로 묶은 것).
 *
 * 합치는 규칙 (mergeExamPack)
 *   1. 팩의 단어를 id → 표제어 → (다른 단어의 변화형으로 등록된 표기) 순으로 사전에서 찾는다
 *   2. 있으면 사전의 것을 그대로 쓴다 (뜻·단계·외우기 유지). 팩의 예문이 쓰는 뜻이 사전에 없을 때만 그 뜻을 덧붙인다
 *   3. 없으면 팩의 항목을 사전에 넣는다
 *   4. 같은 id 의 시험이 있으면 팩의 것으로 바꾸고, 없으면 추가한다
 */
import { checkExam, checkWord, type ExamLabels, type Issues } from './checks';
import { wordRegex } from './corpus';
import { isQuizSource, type ExamData, type RawExample } from './exams';
import { normalizeMemory, type RawWord } from './normalize';
import type { Sense, Word } from './schema';
import { koCore } from './text';

export const EXAMPACK_APP = 'quiz-word';
export const EXAMPACK_KIND = 'exampack';
export const EXAMPACK_VERSION = 1;

export interface ExamPackFile {
  app: typeof EXAMPACK_APP;
  kind: typeof EXAMPACK_KIND;
  version: typeof EXAMPACK_VERSION;
  /** 이 파일을 만든 시각 (ISO 8601) */
  builtAt: string;
  exam: ExamData;
  /** 시험이 가리키는 모든 단어의 사전 항목 */
  words: RawWord[];
}

/**
 * 단어 id 규칙 — 표제어를 소문자로 바꾸고, 아포스트로피는 지우고, 영문자·숫자가 아닌 것은 하이픈 하나로.
 *   "lay out" → "lay-out", "SLA" → "sla", "don't" → "dont", "read-only" → "read-only"
 * 같은 표제어는 누가 만들어도 같은 id 가 되므로, 사전을 모르고 만든 시험 팩의 단어가 사전의 단어와 맞는다.
 */
export function slugId(word: string): string {
  return word
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const examPackFileName = (examId: string) => `${examId}.exampack.json`;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const WORD_KEYS = ['id', 'word', 'level', 'pos', 'ipa', 'meaning', 'short', 'senses', 'forms', 'synonyms', 'domain', 'memory'];
const TOP_KEYS = ['app', 'kind', 'version', 'builtAt', 'exam', 'words', '$schema'];
const EXAM_KEYS = ['id', 'name', 'order', 'sources', 'index', 'examples', 'sentences', 'notes'];

const packLabels: ExamLabels = {
  exam: 'exam',
  index: 'exam.index',
  examples: (src) => `exam.examples.${src}`,
  sentences: (src) => `exam.sentences.${src}`,
  notes: 'exam.notes',
};

/** 사전 항목에서 정해진 필드만, 정해진 순서로 */
function cleanWord(r: Record<string, unknown>): RawWord {
  const out: Record<string, unknown> = {};
  for (const k of WORD_KEYS) if (r[k] !== undefined) out[k] = k === 'memory' ? normalizeMemory(r[k] as RawWord['memory']) : r[k];
  if (out.memory === undefined) delete out.memory;
  return out as RawWord;
}

export interface ExamPackCheck extends Issues {
  /** 오류가 없을 때만 — 정해진 필드만 남긴 시험 팩 */
  pack?: ExamPackFile;
}

/**
 * 시험 팩인지, 형식이 맞는지 검사한다. errors 가 비어 있으면 앱이 불러올 수 있는 파일이다.
 * warns 는 불러올 수는 있지만 확인이 필요한 것.
 */
export function validateExamPack(data: unknown): ExamPackCheck {
  const errors: string[] = [];
  const warns: string[] = [];
  const out = { errors, warns };
  if (!isObj(data)) return { errors: ['시험 팩이 아닙니다 (JSON 객체가 아님)'], warns };
  if (data.app === EXAMPACK_APP && isObj(data.cards)) return { errors: ['진행 기록 파일이에요. 진행 기록은 설정 → 진행 기록 → 가져오기에서 불러오세요.'], warns };
  if (data.app === EXAMPACK_APP && data.kind === 'wordset') return { errors: ['단어 세트 파일이에요 (사전 전체를 바꾸는 파일). 설정 → 단어 세트 → 파일에서 불러오기로 여세요.'], warns };
  if (data.app !== EXAMPACK_APP) errors.push(`app 은 "${EXAMPACK_APP}"`);
  if (data.kind !== EXAMPACK_KIND) errors.push(`kind 는 "${EXAMPACK_KIND}"`);
  if (typeof data.version !== 'number') errors.push(`version 은 숫자 ${EXAMPACK_VERSION}`);
  else if (data.version > EXAMPACK_VERSION) errors.push(`이 앱이 모르는 시험 팩 형식이에요 (버전 ${data.version}). 앱을 먼저 업데이트하세요.`);
  else if (data.version < 1) errors.push(`version 은 ${EXAMPACK_VERSION}`);
  if (typeof data.builtAt !== 'string' || Number.isNaN(new Date(data.builtAt).getTime())) errors.push('builtAt 은 만든 시각 (ISO 8601 문자열, 예: "2026-11-12T09:00:00.000Z")');
  for (const k of Object.keys(data)) if (!TOP_KEYS.includes(k)) warns.push(`모르는 필드 "${k}" — 쓰이지 않습니다`);

  // 단어
  const dict = new Map<string, Word>();
  const cleaned: RawWord[] = [];
  if (!Array.isArray(data.words) || !data.words.length) errors.push('words 는 단어 항목의 배열 (하나 이상)');
  else {
    const seenIds = new Set<string>();
    const heads = new Map<string, string>();
    const surfaces = new Map<string, string>();
    data.words.forEach((r: unknown, i: number) => {
      const id = isObj(r) && typeof r.id === 'string' ? r.id : '';
      const where = `words[${i}]${id ? ` (${id})` : ''}`;
      const w = checkWord(r, where, out, { strict: true });
      if (!isObj(r) || typeof r.id !== 'string' || typeof r.word !== 'string') return;
      if (r.id && r.word && r.id !== slugId(r.word)) errors.push(`${where}: id 는 "${slugId(r.word)}" 여야 함 (표제어 "${r.word}" 를 소문자·하이픈으로 바꾼 값)`);
      for (const k of Object.keys(r)) if (!WORD_KEYS.includes(k) && !['tier', 'basic', 'freq', 'sources', 'contexts', 'note'].includes(k)) warns.push(`${where}: 모르는 필드 "${k}" — 쓰이지 않습니다`);
      if (seenIds.has(r.id)) errors.push(`${where}: 같은 id 가 두 번 이상 있음`);
      seenIds.add(r.id);
      const head = r.word.toLowerCase();
      if (heads.has(head) && heads.get(head) !== r.id) errors.push(`${where}: 표제어 "${r.word}" 가 ${heads.get(head)} 와 겹침`);
      heads.set(head, r.id);
      if (!w) return;
      for (const s of [w.word, ...(w.forms ?? [])].map((x) => x.toLowerCase())) {
        const owner = surfaces.get(s);
        if (owner && owner !== w.id) errors.push(`${where}: 표현 "${s}" 가 ${owner} 에도 등록됨 (forms 는 한 단어에만)`);
        surfaces.set(s, w.id);
      }
      dict.set(w.id, w);
      cleaned.push(cleanWord(r));
    });
  }

  // 시험
  let exam: ExamData | undefined;
  if (!isObj(data.exam)) errors.push('exam 은 시험 객체 { id, name, sources, index, examples, sentences, notes }');
  else {
    const e = data.exam as unknown as ExamData;
    for (const k of Object.keys(data.exam)) if (!EXAM_KEYS.includes(k)) warns.push(`exam: 모르는 필드 "${k}" — 쓰이지 않습니다`);
    const before = errors.length;
    checkExam(e, dict, out, packLabels);
    if (!isObj(e.index) || !Object.keys(e.index).length) errors.push('exam.index 가 비어 있음 — 문제에 나온 단어와 문제 파일별 횟수를 적어야 함');
    if (errors.length === before) {
      exam = {
        id: e.id,
        name: e.name,
        ...(typeof e.order === 'number' ? { order: e.order } : {}),
        sources: e.sources.map((s) => ({ id: s.id, name: s.name, ...(s.kind ? { kind: s.kind } : {}) })),
        index: e.index,
        examples: e.examples ?? {},
        sentences: e.sentences ?? {},
        notes: e.notes ?? {},
      };
      softChecks(exam, dict, warns);
    }
  }

  if (errors.length || !exam) return { errors, warns };
  return {
    errors,
    warns,
    pack: { app: EXAMPACK_APP, kind: EXAMPACK_KIND, version: EXAMPACK_VERSION, builtAt: data.builtAt as string, exam, words: cleaned },
  };
}

/** 불러올 수는 있지만 확인이 필요한 것 (경고) */
function softChecks(exam: ExamData, dict: ReadonlyMap<string, Word>, warns: string[]) {
  const used = new Set<string>([...Object.keys(exam.index), ...Object.keys(exam.notes)]);
  for (const byWord of Object.values(exam.examples)) for (const id of Object.keys(byWord)) used.add(id);
  const unused = [...dict.keys()].filter((id) => !used.has(id));
  if (unused.length) warns.push(`시험에서 쓰이지 않는 단어 ${unused.length}개 (index·examples·notes 어디에도 없음): ${unused.slice(0, 10).join(', ')}${unused.length > 10 ? ' …' : ''}`);

  const quiz = exam.sources.filter(isQuizSource);
  for (const s of quiz) if (!exam.sentences[s.id]?.length) warns.push(`exam.sentences.${s.id}: 문제 문장이 없음 — 예문이 없는 단어에 자동으로 붙일 문장이 없다`);

  const withExample = new Set<string>();
  const noKo: string[] = [];
  const notInSentences: string[] = [];
  for (const [src, byWord] of Object.entries(exam.examples)) {
    const sentences = new Set((exam.sentences[src] ?? []).map((x) => x.en));
    for (const [id, list] of Object.entries(byWord)) {
      withExample.add(id);
      const ns = list.map((x) => x.n).filter((n) => n !== undefined);
      if (new Set(ns).size !== ns.length) warns.push(`exam.examples.${src}.${id}: n(보여 줄 순서)이 겹침`);
      list.forEach((x, i) => {
        if (!x.ko) noKo.push(`${src}.${id}[${i}]`);
        if (sentences.size && !sentences.has(x.en)) notInSentences.push(`${src}.${id}[${i}]`);
      });
    }
  }
  if (noKo.length) warns.push(`해석(ko)이 없는 예문 ${noKo.length}개: ${noKo.slice(0, 5).join(', ')}${noKo.length > 5 ? ' …' : ''}`);
  if (notInSentences.length) warns.push(`예문의 en 이 그 문제 파일의 sentences 에 없음 ${notInSentences.length}개 (문장을 그대로 옮겼는지 확인): ${notInSentences.slice(0, 5).join(', ')}${notInSentences.length > 5 ? ' …' : ''}`);
  const noExample = Object.keys(exam.index).filter((id) => !withExample.has(id));
  if (noExample.length) warns.push(`예문이 없는 단어 ${noExample.length}개 (문장 색인에서 자동으로 찾아 보여 준다): ${noExample.slice(0, 10).join(', ')}${noExample.length > 10 ? ' …' : ''}`);

  // 횟수: 그 문제 파일의 문장에서 실제로 센 값과 같은지 (세는 방법은 가이드의 "횟수 세기")
  const missing: string[] = [];
  const different: string[] = [];
  for (const [id, bySrc] of Object.entries(exam.index)) {
    const w = dict.get(id);
    if (!w) continue;
    const re = new RegExp(wordRegex(w).source, 'gi');
    for (const [src, n] of Object.entries(bySrc)) {
      const list = exam.sentences[src];
      if (!list?.length) continue;
      const counted = list.reduce((sum, x) => sum + (x.en.match(re)?.length ?? 0), 0);
      if (!counted) missing.push(`${id}@${src}`);
      else if (counted !== n) different.push(`${id}@${src} (적힌 값 ${n}, 센 값 ${counted})`);
    }
  }
  if (missing.length) warns.push(`횟수는 적혀 있는데 그 문제 파일의 문장에서 찾지 못한 단어 ${missing.length}개 (forms 에 변화형을 넣었는지 확인): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`);
  if (different.length) warns.push(`횟수가 문장에서 센 값과 다른 항목 ${different.length}개: ${different.slice(0, 10).join(', ')}${different.length > 10 ? ' …' : ''}`);
}

/** 시험 팩을 읽는다. 형식이 틀리면 사람이 읽을 수 있는 메시지로 throw (앱의 불러오기용) */
export function parseExamPack(data: unknown): ExamPackFile {
  const { errors, pack } = validateExamPack(data);
  if (errors.length || !pack) {
    const shown = errors.slice(0, 5).join('\n');
    throw new Error(errors.length > 5 ? `${shown}\n… 오류 ${errors.length - 5}개 더` : shown || '시험 팩을 읽지 못했어요');
  }
  return pack;
}

export interface MergeReport {
  examId: string;
  examName: string;
  /** 같은 id 의 시험이 있어서 바꿨는지 */
  replacedExam: boolean;
  /** 사전에 새로 넣은 단어 id */
  addedWords: string[];
  /** 사전에 이미 있어서 그대로 둔 단어 id */
  keptWords: string[];
  /** 이미 있던 단어에 덧붙인 뜻 */
  addedSenses: { id: string; ko: string }[];
  examples: number;
  sources: number;
}

export interface WordBase {
  words: readonly RawWord[];
  exams: readonly ExamData[];
}

/** 괄호 속 보충 설명을 뺀 뜻 — "(데이터·시스템을) 옮기다, 이전하다" → "옮기다, 이전하다" */
const bare = (ko: string) => ko.replace(/\([^)]*\)/g, ' ');

/**
 * 사전의 뜻 가운데 팩의 뜻과 같은 말로 볼 수 있는 것.
 * 글자 그대로 같거나, 괄호 보충·기호만 다르거나, 같은 품사이면서 쉼표로 나눈 뜻 조각이 하나라도 같은 것.
 * (사전을 모르고 만든 팩은 같은 뜻을 조금 다르게 적기 마련이라, 이런 뜻은 새로 덧붙이지 않고 사전의 뜻에 맞춘다)
 */
function sameSense(senses: readonly Sense[], pos: string, ko: string): Sense | undefined {
  return (
    senses.find((s) => s.ko === ko) ??
    senses.find((s) => koCore(s.ko) === koCore(ko)) ??
    senses.find((s) => s.pos === pos && sharesPiece(s.ko, ko))
  );
}

/** 쉼표로 나눈 뜻 조각 (괄호 보충은 빼고) */
const pieces = (ko: string) =>
  bare(ko)
    .split(/[,，;]/)
    .map(koCore)
    .filter(Boolean);
const sharesPiece = (a: string, b: string) => {
  const pb = pieces(b);
  return pieces(a).some((x) => pb.includes(x));
};

/**
 * 시험 팩을 지금의 사전·시험 위에 얹는다. base 는 건드리지 않고 새 목록을 돌려준다.
 * 팩은 validateExamPack 을 통과한 것이어야 한다.
 */
export function mergeExamPack(base: WordBase, pack: ExamPackFile): { words: RawWord[]; exams: ExamData[]; report: MergeReport } {
  const words: RawWord[] = [...base.words];
  const at = new Map<string, number>(); // 단어 id → words 의 자리
  const byHead = new Map<string, string>(); // 표제어(소문자) → id
  const claimed = new Map<string, string>(); // 표기(소문자) → id
  words.forEach((w, i) => {
    if (!w.id || !w.word) return;
    at.set(w.id, i);
    byHead.set(w.word.toLowerCase(), w.id);
    claimed.set(w.word.toLowerCase(), w.id);
  });
  for (const w of words) for (const f of w.forms ?? []) if (w.id && !claimed.has(f.toLowerCase())) claimed.set(f.toLowerCase(), w.id);

  /** 고칠 단어는 복사해서 고친다 (base 의 객체를 바꾸지 않는다) */
  const own = new Set<string>(); // 이미 복사했거나 새로 넣은 단어
  const editable = (id: string): RawWord => {
    const i = at.get(id)!;
    if (!own.has(id)) {
      own.add(id);
      words[i] = { ...words[i], ...(words[i].senses ? { senses: [...words[i].senses!] } : {}), ...(words[i].forms ? { forms: [...words[i].forms!] } : {}) };
    }
    return words[i];
  };

  const report: MergeReport = { examId: pack.exam.id, examName: pack.exam.name, replacedExam: false, addedWords: [], keptWords: [], addedSenses: [], examples: 0, sources: pack.exam.sources.length };
  const idMap = new Map<string, string>(); // 팩의 id → 사전의 id
  for (const pw of pack.words) {
    if (!pw.id || !pw.word) continue;
    // id → 표제어 → 다른 단어의 변화형으로 이미 등록된 표기 (사전의 mitigation 이 mitigate 를 변화형으로 갖고 있는 경우)
    const head = pw.word.toLowerCase();
    const existing = at.has(pw.id) ? pw.id : (byHead.get(head) ?? claimed.get(head));
    if (existing) {
      idMap.set(pw.id, existing);
      report.keptWords.push(existing);
      // 다른 단어가 쓰지 않는 변화형은 덧붙인다 (그 시험 문장에서 단어를 찾는 데 쓴다)
      const extra = (pw.forms ?? []).filter((f) => !claimed.has(f.toLowerCase()));
      if (extra.length) {
        const w = editable(existing);
        w.forms = [...(w.forms ?? []), ...extra];
        for (const f of extra) claimed.set(f.toLowerCase(), existing);
      }
    } else {
      const forms = (pw.forms ?? []).filter((f) => !claimed.has(f.toLowerCase()) && f.toLowerCase() !== pw.word!.toLowerCase());
      const { forms: _drop, ...rest } = pw;
      const w: RawWord = { ...rest, ...(pw.senses ? { senses: [...pw.senses] } : {}), ...(forms.length ? { forms } : {}) };
      // 사전의 필드 순서(…, senses, forms, synonyms, domain, memory)를 지킨다
      const ordered: Record<string, unknown> = {};
      for (const k of WORD_KEYS) if ((w as Record<string, unknown>)[k] !== undefined) ordered[k] = (w as Record<string, unknown>)[k];
      at.set(pw.id, words.length);
      own.add(pw.id);
      words.push(ordered as RawWord);
      byHead.set(pw.word.toLowerCase(), pw.id);
      claimed.set(pw.word.toLowerCase(), pw.id);
      for (const f of forms) claimed.set(f.toLowerCase(), pw.id);
      idMap.set(pw.id, pw.id);
      report.addedWords.push(pw.id);
    }
  }
  const mapId = (id: string) => idMap.get(id) ?? id;

  // 시험 데이터의 단어 id 를 사전의 id 로 맞추고, 예문의 뜻을 사전의 뜻에 맞춘다
  const index: ExamData['index'] = {};
  for (const [id, bySrc] of Object.entries(pack.exam.index)) {
    const to = (index[mapId(id)] ??= {});
    for (const [src, n] of Object.entries(bySrc)) to[src] = (to[src] ?? 0) + n;
  }
  const examples: ExamData['examples'] = {};
  for (const [src, byWord] of Object.entries(pack.exam.examples)) {
    for (const [pid, list] of Object.entries(byWord)) {
      const id = mapId(pid);
      if (!at.has(id)) continue;
      const mapped: RawExample[] = [];
      for (const ex of list) {
        report.examples++;
        const senses = words[at.get(id)!].senses ?? [];
        const same = sameSense(senses, ex.pos, ex.sense);
        if (same) mapped.push(same.ko === ex.sense ? ex : { ...ex, sense: same.ko });
        else {
          const w = editable(id);
          w.senses = [...(w.senses ?? []), { pos: ex.pos, ko: ex.sense }];
          report.addedSenses.push({ id, ko: ex.sense });
          mapped.push(ex);
        }
      }
      ((examples[src] ??= {})[id] ??= []).push(...mapped);
    }
  }
  const notes: ExamData['notes'] = {};
  for (const [id, md] of Object.entries(pack.exam.notes)) notes[mapId(id)] = md;

  const exam: ExamData = { ...pack.exam, index, examples, notes };
  const exams = [...base.exams];
  const i = exams.findIndex((e) => e.id === exam.id);
  if (i >= 0) {
    exams[i] = exam;
    report.replacedExam = true;
  } else exams.push(exam);
  return { words, exams, report };
}

/** 시험 하나와 그 시험이 가리키는 단어를 시험 팩으로 (사전에 있는 순서대로) */
export function packExam(words: readonly RawWord[], exam: ExamData, builtAt: string = new Date().toISOString()): ExamPackFile {
  const used = new Set<string>([...Object.keys(exam.index ?? {}), ...Object.keys(exam.notes ?? {})]);
  for (const byWord of Object.values(exam.examples ?? {})) for (const id of Object.keys(byWord)) used.add(id);
  return {
    app: EXAMPACK_APP,
    kind: EXAMPACK_KIND,
    version: EXAMPACK_VERSION,
    builtAt,
    exam,
    words: words.filter((w) => w.id && used.has(w.id)),
  };
}

/**
 * 단어·시험 데이터 검사 규칙 — 저장소 검사(npm run data:validate)와 시험 팩 검사(exampack.ts)가 함께 쓴다.
 * 같은 규칙을 두 곳에 따로 적지 않으려고 여기 한 곳에 둔다. 파일을 읽지 않는 순수 함수다.
 */
import { isQuizSource, type ExamData } from './exams';
import { normalizeWord, type RawWord } from './normalize';
import { DOMAINS, MAX_LEVEL, POS_LIST, type Word } from './schema';

export interface Issues {
  errors: string[];
  warns: string[];
}

/** 단어·시험·문제 파일 id — 소문자·숫자를 하이픈으로 이은 것 */
export const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** 시험 폴더로 옮긴 필드 — 사전의 단어에 남아 있으면 안 된다 */
export const LEGACY_WORD_FIELDS = ['tier', 'basic', 'freq', 'sources', 'contexts', 'note'];
/** 외우기 글자 수 제한 */
export const MEMORY_LIMITS = { story: 80, hook: 60, origin: 50 } as const;
/** 단어마다 붙이는 예문 수 */
export const MAX_EXAMPLES = 4;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const strList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const POS = POS_LIST as readonly string[];

export interface WordCheckOptions {
  /**
   * 시험 팩처럼 처음부터 만드는 데이터에 쓰는 엄격한 검사:
   * short·senses·domain 필수, 2단계 이상은 외우기 필수, 외우기 길이 초과도 오류
   */
  strict?: boolean;
}

/**
 * 사전의 단어 한 항목을 검사한다. 모양이 맞으면 정규화한 Word 를 돌려준다 (틀려서 쓸 수 없으면 undefined).
 * where: 오류 메시지 앞에 붙일 위치 (예: "a.json › abandon", "words[3] (abandon)")
 */
export function checkWord(r: unknown, where: string, out: Issues, opts: WordCheckOptions = {}): Word | undefined {
  const err = (m: string) => out.errors.push(`${where}: ${m}`);
  const warn = (m: string) => out.warns.push(`${where}: ${m}`);
  const strict = !!opts.strict;
  if (!isObj(r)) {
    err('단어 항목은 객체');
    return undefined;
  }
  for (const f of ['id', 'word', 'pos', 'meaning']) {
    const v = r[f];
    if (!v || (Array.isArray(v) && !v.length)) err(`필수 필드 "${f}" 없음`);
  }
  if (!isStr(r.id) || !r.id || !isStr(r.word) || !r.word) return undefined;

  // 모양(형) 검사 — 여기서 걸리면 더 볼 수 없다
  let broken = false;
  const bad = (m: string) => {
    err(m);
    broken = true;
  };
  if (r.pos !== undefined && !isStr(r.pos) && !strList(r.pos)) bad('pos 는 문자열 또는 문자열 배열');
  else if (strict && r.pos !== undefined && !Array.isArray(r.pos)) err('pos 는 문자열 배열 (예: ["동사", "명사"])');
  if (r.meaning !== undefined && !isStr(r.meaning)) bad('meaning 은 문자열');
  if (r.short !== undefined && !isStr(r.short)) bad('short 는 문자열');
  if (r.ipa !== undefined && !isStr(r.ipa)) bad('ipa 는 문자열');
  if (r.domain !== undefined && !isStr(r.domain)) bad('domain 은 문자열');
  if (r.forms !== undefined && !strList(r.forms)) bad('forms 는 문자열 배열');
  if (r.synonyms !== undefined && !strList(r.synonyms)) bad('synonyms 는 문자열 배열');
  if (r.senses !== undefined && (!Array.isArray(r.senses) || r.senses.some((s) => !isObj(s) || !isStr(s.pos) || !isStr(s.ko) || !s.ko.trim()))) {
    bad('senses 는 [{ pos, ko }] 배열');
  }
  const m = r.memory;
  if (m !== undefined) {
    if (!isObj(m)) bad('memory 는 객체');
    else {
      for (const k of ['origin', 'story', 'hook']) if (m[k] !== undefined && !isStr(m[k])) bad(`memory.${k} 는 문자열`);
      if (m.roots !== undefined && !Array.isArray(m.roots)) bad('memory.roots 는 배열');
      else if (Array.isArray(m.roots) && m.roots.some((x) => !isObj(x) || !isStr(x.part) || !isStr(x.ko) || !x.part.trim() || !x.ko.trim())) bad('memory.roots 항목에 part·ko 가 다 있어야 함');
      if (m.family !== undefined && !strList(m.family)) bad('memory.family 는 문자열 배열');
    }
  }
  if (!ID_RE.test(r.id)) err('id 는 소문자·숫자·하이픈만');
  if (r.level === undefined) err(`level(1~${MAX_LEVEL}) 없음`);
  else if (typeof r.level !== 'number' || !Number.isInteger(r.level) || r.level < 1 || r.level > MAX_LEVEL) err(`level 은 1~${MAX_LEVEL} 의 정수`);
  for (const k of LEGACY_WORD_FIELDS) if (k in r) err(`"${k}" 는 사전에 적지 않는다 — 시험 폴더(data/exams)로`);
  if (broken) return undefined;

  const raw = r as RawWord;
  const w = normalizeWord(raw);
  for (const p of w.pos) if (!POS.includes(p)) err(`알 수 없는 품사 "${p}"`);
  for (const s of w.senses) if (!POS.includes(s.pos)) err(`senses 품사 "${s.pos}"`);
  if (!(DOMAINS as readonly string[]).includes(w.domain)) err(`알 수 없는 domain "${w.domain}"`);
  if (strict && !raw.domain) err('domain 없음');
  if (strict && !raw.senses?.length) err('senses 없음 (뜻을 하나 이상)');
  if (!raw.short) (strict ? err : warn)(strict ? 'short 없음 (객관식 보기에 쓰는 짧은 뜻)' : 'short 없음 (객관식 보기에 meaning 을 줄여 씀)');
  else if (/[A-Za-z]/.test(raw.short)) warn('short 에 영어가 있음 — 보기에서 정답이 드러날 수 있음');
  if (w.short.length > 26) warn(`short 가 김 (${w.short.length}자)`);
  const dupSense = w.senses.map((s) => s.ko).filter((ko, i, all) => all.indexOf(ko) !== i);
  if (dupSense.length) (strict ? err : warn)(`senses 에 같은 뜻이 두 번: "${dupSense[0]}"`);

  if (raw.memory !== undefined) {
    if (!w.memory) err('memory 에 story(어원 장면)나 hook(발음 연상) 중 하나는 있어야 함');
    if (raw.memory.family?.some((f) => f.toLowerCase() === w.word.toLowerCase())) (strict ? err : warn)('memory.family 에 자기 자신이 있음');
    for (const [k, max] of Object.entries(MEMORY_LIMITS) as [keyof typeof MEMORY_LIMITS, number][]) {
      const v = w.memory?.[k];
      if (v && v.length > max) (strict ? err : warn)(`memory.${k} 가 김 (${v.length}자, ${max}자 이하)`);
    }
  } else if (strict && typeof r.level === 'number' && r.level >= 2) err('2단계 이상인 단어에는 memory(외우기)가 있어야 함'); // level 이 틀렸으면 그 오류만 낸다
  return w;
}

/** 오류 메시지에 쓸 위치 이름 */
export interface ExamLabels {
  exam: string;
  index: string;
  examples: (src: string) => string;
  sentences: (src: string) => string;
  notes: string;
}

/** 저장소의 시험 폴더 기준 이름 */
export const folderLabels = (id: string): ExamLabels => ({
  exam: `exams/${id}`,
  index: `exams/${id}/index.json`,
  examples: (src) => `exams/${id}/examples/${src}.json`,
  sentences: (src) => `exams/${id}/sentences/${src}.json`,
  notes: `exams/${id}/notes.json`,
});

/**
 * 시험 하나를 검사한다. dict: 사전(단어 id → 단어). 붙은 예문 수를 돌려준다.
 * 모양이 틀린 값이 들어와도 죽지 않는다 (시험 팩은 바깥에서 만든 파일이다).
 */
export function checkExam(exam: ExamData, dict: ReadonlyMap<string, Word>, out: Issues, labels: ExamLabels = folderLabels(exam.id)): number {
  const { errors, warns } = out;
  const at = labels.exam;
  if (!isStr(exam.id) || !ID_RE.test(exam.id)) errors.push(`${at}: 시험 id 는 소문자·숫자·하이픈만`);
  if (!isStr(exam.name) || !exam.name.trim()) errors.push(`${at}: name 없음`);
  if (exam.order !== undefined && typeof exam.order !== 'number') errors.push(`${at}: order 는 숫자`);

  const srcIds = new Set<string>();
  const quiz = new Set<string>();
  if (!Array.isArray(exam.sources)) errors.push(`${at}: sources 는 [{ id, name }] 배열`);
  else {
    for (const s of exam.sources) {
      if (!isObj(s)) {
        errors.push(`${at}: sources 항목은 { id, name }`);
        continue;
      }
      if (!isStr(s.id) || !ID_RE.test(s.id)) errors.push(`${at}: 문제 파일 id "${String(s.id)}" 는 소문자·숫자·하이픈만`);
      else if (srcIds.has(s.id)) errors.push(`${at}: 문제 파일 id 중복 "${s.id}"`);
      if (!isStr(s.name) || !s.name.trim()) errors.push(`${at}: 문제 파일 ${String(s.id)} 에 name 없음`);
      if (s.kind !== undefined && s.kind !== 'quiz' && s.kind !== 'wordbook') errors.push(`${at}: 문제 파일 ${String(s.id)} 의 kind 는 quiz / wordbook`);
      if (isStr(s.id)) {
        srcIds.add(s.id);
        if (isQuizSource(s)) quiz.add(s.id);
      }
    }
    if (!quiz.size) warns.push(`${at}: 문제 파일이 하나도 없음`);
  }

  if (exam.index !== undefined && !isObj(exam.index)) errors.push(`${labels.index}: { 단어 id: { 문제 파일 id: 횟수 } } 객체가 아님`);
  else {
    for (const [id, bySrc] of Object.entries(exam.index ?? {})) {
      if (!dict.has(id)) errors.push(`${labels.index}: 사전에 없는 단어 "${id}"`);
      if (!isObj(bySrc) || !Object.keys(bySrc).length) errors.push(`${labels.index} › ${id}: { 문제 파일: 횟수 } 가 비어 있음`);
      else {
        for (const [src, n] of Object.entries(bySrc)) {
          if (!quiz.has(src)) errors.push(`${labels.index} › ${id}: 문제 파일 목록에 없는 "${src}"`);
          if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) errors.push(`${labels.index} › ${id}: ${src} 의 횟수는 1 이상의 정수`);
        }
      }
    }
  }

  let exampleCount = 0;
  if (exam.examples !== undefined && !isObj(exam.examples)) errors.push(`${at}: examples 는 { 문제 파일 id: { 단어 id: [예문] } } 객체`);
  else {
    const perWord = new Map<string, number>();
    for (const [src, byWord] of Object.entries(exam.examples ?? {})) {
      const file = labels.examples(src);
      if (!srcIds.has(src)) errors.push(`${file}: sources 에 없는 문제 파일`);
      if (!isObj(byWord)) {
        errors.push(`${file}: { 단어 id: [예문] } 객체가 아님`);
        continue;
      }
      for (const [id, list] of Object.entries(byWord)) {
        const w = dict.get(id);
        if (!w) {
          errors.push(`${file}: 사전에 없는 단어 "${id}"`);
          continue;
        }
        if (!Array.isArray(list)) {
          errors.push(`${file} › ${id}: 예문 목록이 배열이 아님`);
          continue;
        }
        perWord.set(id, (perWord.get(id) ?? 0) + list.length);
        for (const c of list as unknown[]) {
          exampleCount++;
          if (!isObj(c) || !isStr(c.en) || !isStr(c.surface) || !isStr(c.sense) || !isStr(c.pos) || !c.surface) {
            errors.push(`${file} › ${id}: 예문에 en·surface·pos·sense 가 다 있어야 함`);
            continue;
          }
          if (!c.en.toLowerCase().includes(c.surface.toLowerCase())) errors.push(`${file} › ${id}: 예문에 "${c.surface}" 없음`);
          if (!w.senses.some((s) => s.ko === c.sense)) errors.push(`${file} › ${id}: 문맥 뜻 "${c.sense}" 가 senses 에 없음`);
          if (!POS.includes(c.pos)) errors.push(`${file} › ${id}: 알 수 없는 품사 "${c.pos}"`);
          if (c.q !== undefined && (typeof c.q !== 'number' || !Number.isInteger(c.q) || c.q < 0)) errors.push(`${file} › ${id}: q 는 0 이상의 정수`);
          if (c.n !== undefined && typeof c.n !== 'number') errors.push(`${file} › ${id}: n 은 숫자`);
          if (c.ko !== undefined && !isStr(c.ko)) errors.push(`${file} › ${id}: ko 는 문자열`);
        }
      }
    }
    for (const [id, n] of perWord) if (n > MAX_EXAMPLES) warns.push(`${at}: ${id} 의 예문이 ${n}개 — 단어마다 ${MAX_EXAMPLES}개까지가 기준`);
  }

  if (exam.sentences !== undefined && !isObj(exam.sentences)) errors.push(`${at}: sentences 는 { 문제 파일 id: [문장] } 객체`);
  else {
    for (const [src, list] of Object.entries(exam.sentences ?? {})) {
      const file = labels.sentences(src);
      if (!quiz.has(src)) errors.push(`${file}: 문제 파일 목록에 없는 파일`);
      if (!Array.isArray(list) || (list as unknown[]).some((x) => !isObj(x) || !isStr(x.en) || (x.ko !== undefined && !isStr(x.ko)) || (x.q !== undefined && (typeof x.q !== 'number' || !Number.isInteger(x.q) || x.q < 0)))) {
        errors.push(`${file}: [{ q, en, ko? }] 형식이 아님`);
      }
    }
  }

  if (exam.notes !== undefined && !isObj(exam.notes)) errors.push(`${labels.notes}: { 단어 id: 마크다운 } 객체가 아님`);
  else {
    for (const [id, md] of Object.entries(exam.notes ?? {})) {
      if (!dict.has(id)) errors.push(`${labels.notes}: 사전에 없는 단어 "${id}"`);
      if (!isStr(md)) errors.push(`${labels.notes} › ${id}: 노트는 문자열`);
    }
  }
  return exampleCount;
}

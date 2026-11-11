/**
 * 단어 세트 파일 — 웹(또는 npm run data:pack)에서 내려받아 iPhone 앱에서 불러오면 앱의 단어 전체가 바뀐다.
 * OTA 없이 단어를 갱신하는 방법이다. 공통 사전(data/words/*.json 원본 그대로)과 시험 데이터(data/exams)를 한 파일에 담는다.
 * 진행 기록은 단어 id 기준이라 세트를 바꿔도 그대로 이어진다.
 *
 * 버전 2: 단어에서 시험 전용 정보가 빠지고 exams 가 생겼다. 버전 1 파일은 읽지 않는다(새로 내려받으면 된다).
 */
import type { ExamData } from './exams';
import type { RawWord } from './normalize';

export const WORDSET_APP = 'quiz-word';
export const WORDSET_KIND = 'wordset';
export const WORDSET_VERSION = 2;

export interface WordSetFile {
  app: typeof WORDSET_APP;
  kind: typeof WORDSET_KIND;
  version: typeof WORDSET_VERSION;
  /** 이 파일을 만든 시각 (ISO) */
  builtAt: string;
  count: number;
  words: RawWord[];
  exams: ExamData[];
}

export function packWordSet(input: { words: readonly RawWord[]; exams: readonly ExamData[]; builtAt?: string }): WordSetFile {
  const words = input.words.filter((w) => w && w.id && w.word);
  return {
    app: WORDSET_APP,
    kind: WORDSET_KIND,
    version: WORDSET_VERSION,
    builtAt: input.builtAt ?? new Date().toISOString(),
    count: words.length,
    words,
    exams: [...input.exams],
  };
}

/** 내려받을 파일 이름 — quiz-word-words-20261110.json */
export function wordSetFileName(builtAt: string): string {
  const d = new Date(builtAt);
  const ymd = Number.isNaN(d.getTime())
    ? 'set'
    : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `quiz-word-words-${ymd}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * 불러온 JSON 이 단어 세트 파일인지 검사한다. 문제가 있으면 사람이 읽을 수 있는 메시지로 throw.
 * (품사·분류 같은 내용 검사는 npm run data:validate 가 한다 — 여기서는 앱이 깨지지 않을 만큼만 본다)
 */
export function parseWordSet(data: unknown): WordSetFile {
  if (!isObj(data)) throw new Error('단어 세트 파일이 아닙니다 (JSON 객체가 아님)');
  if (data.app === WORDSET_APP && isObj(data.cards)) throw new Error('진행 기록 파일이에요. 진행 기록은 설정 → 진행 기록 → 가져오기에서 불러오세요.');
  if (data.app !== WORDSET_APP || data.kind !== WORDSET_KIND) throw new Error('단어 세트 파일이 아닙니다. 웹 설정의 "단어 세트 파일 내려받기"로 만든 파일을 고르세요.');
  if (typeof data.version !== 'number' || data.version > WORDSET_VERSION) throw new Error(`이 앱이 모르는 단어 세트 형식이에요 (버전 ${String(data.version)}). 앱을 먼저 업데이트하세요.`);
  if (data.version < WORDSET_VERSION) throw new Error('예전 형식의 단어 세트 파일이에요. 웹 설정의 "단어 세트 파일 내려받기"로 새로 만들어 주세요.');
  if (!Array.isArray(data.words) || !data.words.length) throw new Error('단어가 하나도 없는 파일이에요');

  const seen = new Set<string>();
  const dup: string[] = [];
  data.words.forEach((w, i) => {
    if (!isObj(w) || !isStr(w.id) || !isStr(w.word)) throw new Error(`${i + 1}번째 단어에 id 나 word 가 없어요`);
    if (w.senses !== undefined && !Array.isArray(w.senses)) throw new Error(`${w.id}: senses 가 배열이 아니에요`);
    if (seen.has(w.id)) dup.push(w.id);
    seen.add(w.id);
  });
  if (dup.length) throw new Error(`같은 id 가 두 번 이상 있어요: ${dup.slice(0, 5).join(', ')}${dup.length > 5 ? ` 외 ${dup.length - 5}개` : ''}`);

  const exams = data.exams ?? [];
  if (!Array.isArray(exams)) throw new Error('시험 목록(exams) 형식이 올바르지 않아요');
  const examIds = new Set<string>();
  for (const e of exams) {
    if (!isObj(e) || !isStr(e.id) || typeof e.name !== 'string') throw new Error('시험(exams) 항목에 id 나 name 이 없어요');
    if (examIds.has(e.id)) throw new Error(`같은 시험이 두 번 있어요: ${e.id}`);
    examIds.add(e.id);
    if (!Array.isArray(e.sources) || e.sources.some((s) => !isObj(s) || !isStr(s.id) || typeof s.name !== 'string')) throw new Error(`${e.id}: 문제 파일 목록(sources) 형식이 올바르지 않아요`);
    for (const k of ['index', 'examples', 'sentences', 'notes'] as const) {
      if (e[k] !== undefined && !isObj(e[k])) throw new Error(`${e.id}: ${k} 형식이 올바르지 않아요`);
    }
    for (const [src, byWord] of Object.entries((e.examples ?? {}) as Record<string, unknown>)) {
      if (!isObj(byWord) || Object.values(byWord).some((list) => !Array.isArray(list) || list.some((x) => !isObj(x) || typeof x.en !== 'string'))) throw new Error(`${e.id}: 예문(${src}) 형식이 올바르지 않아요`);
    }
    for (const [src, list] of Object.entries((e.sentences ?? {}) as Record<string, unknown>)) {
      if (!Array.isArray(list) || list.some((x) => !isObj(x) || typeof x.en !== 'string')) throw new Error(`${e.id}: 문제 문장(${src}) 형식이 올바르지 않아요`);
    }
  }

  return {
    app: WORDSET_APP,
    kind: WORDSET_KIND,
    version: WORDSET_VERSION,
    builtAt: typeof data.builtAt === 'string' ? data.builtAt : '',
    count: data.words.length,
    words: data.words as RawWord[],
    exams: (exams as Record<string, unknown>[]).map((e) => ({
      id: e.id as string,
      name: e.name as string,
      ...(typeof e.order === 'number' ? { order: e.order } : {}),
      sources: e.sources as ExamData['sources'],
      index: (e.index ?? {}) as ExamData['index'],
      examples: (e.examples ?? {}) as ExamData['examples'],
      sentences: (e.sentences ?? {}) as ExamData['sentences'],
      notes: (e.notes ?? {}) as ExamData['notes'],
    })),
  };
}

/** 지금 단어 세트와 새 세트의 차이 — 불러오기 전 확인 창에 보여 준다 */
export function diffWordSets(oldIds: Iterable<string>, newIds: Iterable<string>): { added: string[]; removed: string[] } {
  const before = new Set(oldIds);
  const after = new Set(newIds);
  return {
    added: [...after].filter((id) => !before.has(id)),
    removed: [...before].filter((id) => !after.has(id)),
  };
}

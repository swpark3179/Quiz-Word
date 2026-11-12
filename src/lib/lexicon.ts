/**
 * 단어 목록 내보내기 (lexicon) — 다른 앱(문제은행)이 단어장 앱에 등록된 단어를 알 수 있게 하는 파일.
 *
 * 모바일 OS 는 앱끼리 보이지 않게 함수 호출·리턴을 할 수 없으므로, 단어장 앱이 켜질 때 이 파일을
 * 두 앱이 함께 읽을 수 있는 곳에 써 둔다 (iOS: App Group 공유 폴더, Android: ContentProvider).
 * 문제은행은 문제 속 단어 배열을 이 목록과 맞춰 등록된 단어만 강조한다.
 * 표제어·변화형·한 줄 뜻만 담는다 — 진행 기록 같은 개인 데이터는 넣지 않는다.
 */
import type { Word } from './schema';

export const LEXICON_FORMAT = 'quiz-word-lexicon';
export const LEXICON_VERSION = 1;
/** 공유 위치 안의 파일 이름 */
export const LEXICON_FILE = 'lexicon.json';

export interface LexiconWord {
  id: string;
  /** 표제어 */
  word: string;
  /** 한 줄 뜻 */
  short: string;
  pos: string[];
  ipa?: string;
  /** 변화형·구 (문장에서 함께 찾을 표현) */
  forms?: string[];
}

export interface LexiconFile {
  format: typeof LEXICON_FORMAT;
  version: typeof LEXICON_VERSION;
  /** 단어 세트가 바뀌었는지 가리는 표시 — 같으면 다시 쓰지 않는다 */
  sig: string;
  exportedAt: string;
  count: number;
  words: LexiconWord[];
}

/** 단어 세트가 바뀌었는지 가리는 표시 (세트 출처·만든 시각·얹은 시험 팩·단어 수) */
export function lexiconSig(info: { origin: string; builtAt: string; packs: { id: string; builtAt: string }[] }, count: number): string {
  const packs = info.packs.map((p) => `${p.id}@${p.builtAt}`).join(',');
  return `v${LEXICON_VERSION}|${info.origin}|${info.builtAt}|${packs}|${count}`;
}

export function buildLexicon(words: Word[], sig: string, exportedAt = new Date().toISOString()): LexiconFile {
  const out: LexiconWord[] = words.map((w) => ({
    id: w.id,
    word: w.word,
    short: w.short,
    pos: w.pos,
    ...(w.ipa ? { ipa: w.ipa } : {}),
    ...(w.forms?.length ? { forms: w.forms } : {}),
  }));
  return { format: LEXICON_FORMAT, version: LEXICON_VERSION, sig, exportedAt, count: out.length, words: out };
}

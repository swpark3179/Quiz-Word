/**
 * 단어 데이터 로드 — data/words/*.json 을 모두 읽어 하나의 목록으로 만든다.
 * 파일을 고치면 Vite 가 바로 다시 읽는다.
 */
import { normalizeWord, type RawWord } from '../lib/normalize';
import type { Word } from '../lib/schema';
import { createCorpusIndex, wordRegex, type CorpusSentence } from '../lib/corpus';
import sourcesJson from '../../data/sources.json';
import corpusJson from '../../data/corpus.json';

const modules = import.meta.glob<RawWord[]>('../../data/words/*.json', { eager: true, import: 'default' });

export const WORDS: Word[] = Object.values(modules)
  .flat()
  .filter((r) => r && r.id && r.word)
  .map(normalizeWord)
  .sort((a, b) => a.word.localeCompare(b.word));

export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));

/** 소문자 표기(표제어·forms) → 단어 */
export const WORD_BY_SURFACE = new Map<string, Word>();
for (const w of WORDS) {
  for (const s of [w.word, ...(w.forms ?? [])]) {
    const k = s.toLowerCase();
    if (!WORD_BY_SURFACE.has(k)) WORD_BY_SURFACE.set(k, w);
  }
}

export interface SourceInfo {
  id: string;
  name: string;
}
export const SOURCES: SourceInfo[] = sourcesJson as SourceInfo[];
const sourceNames = new Map(SOURCES.map((s) => [s.id, s.name]));
export const sourceName = (id: string) => sourceNames.get(id) ?? id;
/** 문제 파일이 실제로 문제 세트인지 (vocab 예문 제외) */
export const QUIZ_SOURCES = SOURCES.filter((s) => s.id !== 'vocab');

export const CORPUS = corpusJson as CorpusSentence[];
export const { corpusExamples, contextsOf } = createCorpusIndex(CORPUS);
export { wordRegex };

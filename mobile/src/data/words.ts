/** 단어 데이터 — 앱에 내장(오프라인). 단어를 고치면 OTA(npm run ota)로 갱신한다 */
import { DATA_BUILT_AT, WORD_FILES } from '@/generated/wordFiles';
import corpusJson from '@/generated/data/corpus.json';
import sourcesJson from '@/generated/data/sources.json';
import { createCorpusIndex, type CorpusSentence } from '@shared/corpus';
import { normalizeWord } from '@shared/normalize';
import type { Word } from '@shared/schema';

export const WORDS: Word[] = WORD_FILES.flat()
  .filter((r) => r && r.id && r.word)
  .map(normalizeWord)
  .sort((a, b) => a.word.localeCompare(b.word));

export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));

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
export const SOURCES = sourcesJson as SourceInfo[];
const sourceNames = new Map(SOURCES.map((s) => [s.id, s.name]));
export const sourceName = (id: string) => sourceNames.get(id) ?? id;
export const QUIZ_SOURCES = SOURCES.filter((s) => s.id !== 'vocab');

export const { corpusExamples, contextsOf } = createCorpusIndex(corpusJson as CorpusSentence[]);

export { DATA_BUILT_AT };

/** 예문 출처 표시 */
export const sourceLabel = (c: { src: string; q: number }) =>
  c.src === 'vocab' ? '기존 단어장 예문' : `${sourceName(c.src)} · 문제 ${c.q}`;

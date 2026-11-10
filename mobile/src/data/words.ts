/**
 * 단어 데이터 — 앱에 내장(오프라인)되어 있고, 설정에서 단어 세트 파일을 불러오면 그 세트로 바뀐다.
 * 어느 쪽이든 앱이 켜질 때 한 번 만들어 두는 모듈 상수다 (세트를 바꾸면 앱을 다시 시작한다 — lib/wordSet.ts).
 */
import { createCorpusIndex } from '@shared/corpus';
import { normalizeWord } from '@shared/normalize';
import type { SourceInfo, Word } from '@shared/schema';
import { sortByWord } from '@shared/text';
import { loadActiveWordSet, type WordSetInfo } from '@/lib/wordSet';

const active = loadActiveWordSet();

/** 표제어 순 */
export const WORDS: Word[] = sortByWord(active.words.filter((r) => r && r.id && r.word).map(normalizeWord));

/** 자주 나온 순 (같으면 표제어 순) — 단어장이 필터만 해서 쓰도록 미리 한 번 정렬해 둔다 */
export const WORDS_BY_FREQ: Word[] = WORDS.map((w, i) => ({ w, i }))
  .sort((a, b) => b.w.freq - a.w.freq || a.i - b.i)
  .map((x) => x.w);

export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));

export const WORD_BY_SURFACE = new Map<string, Word>();
for (const w of WORDS) {
  for (const s of [w.word, ...(w.forms ?? [])]) {
    const k = s.toLowerCase();
    if (!WORD_BY_SURFACE.has(k)) WORD_BY_SURFACE.set(k, w);
  }
}

export type { SourceInfo };
export const SOURCES: SourceInfo[] = active.sources;
const sourceNames = new Map(SOURCES.map((s) => [s.id, s.name]));
export const sourceName = (id: string) => sourceNames.get(id) ?? id;
export const QUIZ_SOURCES = SOURCES.filter((s) => s.id !== 'vocab');

export const { corpusExamples, contextsOf } = createCorpusIndex(active.corpus);

/** 지금 쓰는 단어 세트 (설정 화면에 표시) */
export const WORD_SET_INFO: WordSetInfo & { count: number } = { ...active.info, count: WORDS.length };

/** 예문 출처 표시 */
export const sourceLabel = (c: { src: string; q: number }) =>
  c.src === 'vocab' ? '기존 단어장 예문' : `${sourceName(c.src)} · 문제 ${c.q}`;

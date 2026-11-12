/**
 * 단어 데이터 — 앱에 내장(오프라인)되어 있고, 설정에서 단어 세트 파일을 불러오면 그 세트로 바뀐다.
 * 어느 쪽이든 앱이 켜질 때 한 번 만들어 두는 모듈 상수다 (세트를 바꾸면 앱을 다시 시작한다 — lib/wordSet.ts).
 * 공통 사전과 시험 데이터를 합치는 일은 웹과 같은 buildWordData(@shared/exams)가 한다.
 */
import { buildWordData } from '@shared/exams';
import { loadActiveWordSet, type WordSetInfo } from '@/lib/wordSet';

const active = loadActiveWordSet();

export const {
  /** 표제어 순 */
  WORDS,
  /** 자주 나온 순 (같으면 표제어 순) — 단어장이 필터만 해서 쓰도록 미리 한 번 정렬해 둔다 */
  WORDS_BY_FREQ,
  WORD_BY_ID,
  WORD_BY_SURFACE,
  /** 시험(카테고리) 목록 — 보여 줄 순서대로 */
  EXAMS,
  examName,
  /** 그 시험의 문제 파일 목록 (예문 전용 파일 제외) */
  quizSources,
  sourceName,
  /** 예문 출처 표시 */
  sourceLabel,
  corpusExamples,
  contextsOf,
} = buildWordData(active.words, active.exams);

/** 지금 쓰는 사전·시험 원본 — 시험 팩을 불러오기 전에 무엇이 바뀔지 미리 따져 보는 데 쓴다 */
export const ACTIVE_RAW = { words: active.words, exams: active.exams };

/** 주 시험 — 설정에 없거나 없어진 시험이면 첫 시험 */
export const mainExam = (id: string | undefined) => EXAMS.find((e) => e.id === id)?.id ?? EXAMS[0]?.id;

/** 지금 쓰는 단어 세트 (설정 화면에 표시) */
export const WORD_SET_INFO: WordSetInfo & { count: number } = { ...active.info, count: WORDS.length };

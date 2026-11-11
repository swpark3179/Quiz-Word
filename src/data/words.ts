/**
 * 단어 데이터 로드 — 공통 사전(data/words/*.json)과 시험 데이터(data/exams/**)를 읽어 하나로 만든다.
 * 파일을 고치면 Vite 가 바로 다시 읽는다.
 */
import { assembleExams, buildWordData, type ExamData } from '../lib/exams';
import type { RawWord } from '../lib/normalize';
import { wordRegex } from '../lib/corpus';

const wordModules = import.meta.glob<RawWord[]>('../../data/words/*.json', { eager: true, import: 'default' });
const examModules = import.meta.glob<unknown>('../../data/exams/**/*.json', { eager: true, import: 'default' });

/** data/words/*.json 원본 그대로 (파일 이름 순) — 단어 세트 파일(앱으로 보내기)에 이대로 담는다 */
export const RAW_WORDS: RawWord[] = Object.keys(wordModules)
  .sort()
  .flatMap((k) => wordModules[k])
  .filter((r) => r && r.id && r.word);

/** data/exams/<시험>/ 원본 그대로 — 단어 세트 파일에 이대로 담는다 */
export const RAW_EXAMS: ExamData[] = assembleExams(Object.keys(examModules).sort().map((k) => [k, examModules[k]] as const));

export const {
  /** 표제어 순 */
  WORDS,
  /** 자주 나온 순 (같으면 표제어 순) */
  WORDS_BY_FREQ,
  WORD_BY_ID,
  /** 소문자 표기(표제어·forms) → 단어 */
  WORD_BY_SURFACE,
  /** 시험(카테고리) 목록 — 보여 줄 순서대로 */
  EXAMS,
  examName,
  /** 그 시험의 문제 파일 목록 (예문 전용 파일 제외) */
  quizSources,
  sourceName,
  sourceLabel,
  corpusExamples,
  contextsOf,
} = buildWordData(RAW_WORDS, RAW_EXAMS);

/** 주 시험 — 설정에 없거나 없어진 시험이면 첫 시험 */
export const mainExam = (id: string | undefined) => EXAMS.find((e) => e.id === id)?.id ?? EXAMS[0]?.id;

export { wordRegex };

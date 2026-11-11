/** 단어 데이터 스키마 — data/words/*.json 의 한 항목 */

export interface Sense {
  pos: string;
  ko: string;
}

export interface Context {
  /** 시험(카테고리) id (예: ccar-f) */
  cat: string;
  /** 문제 파일 id (예: mock04). 예문 전용 파일이면 그 id (예: vocab) */
  src: string;
  /** 문제 번호 (문제가 아닌 예문이면 0) */
  q: number;
  /** 원문 문장 */
  en: string;
  /** 문장 속 실제 표기 (강조용) */
  surface: string;
  /** 이 문장에서의 품사 */
  pos: string;
  /** 이 문장에서의 뜻 — senses[].ko 중 하나 */
  sense: string;
  /** 문장 한글 해석 */
  ko?: string;
  /** 문장 색인에서 자동으로 찾은 예문 — 뜻(sense)은 대표 뜻일 뿐이라 뜻 표시·문맥 문제에 쓰지 않는다 */
  auto?: boolean;
}

/** 어원 조각 하나 — 접두사·어근·접미사 */
export interface Root {
  part: string;
  ko: string;
}

/** 외우기 — 어원으로 그린 장면(story)이나 발음 연상(hook) 중 하나는 있다 */
export interface Memory {
  roots?: Root[];
  /** "라틴어 differre (따로 나르다)" */
  origin?: string;
  /** 어원으로 그린 장면 → 뜻 */
  story?: string;
  /** 발음 연상 */
  hook?: string;
  /** 같은 어근 단어 */
  family?: string[];
}

/** 난이도 등급 — 1(가장 쉬움) ~ 6. 교육과정 이름은 대략의 눈금이다 */
export type Level = 1 | 2 | 3 | 4 | 5 | 6;

export const LEVELS: readonly { level: Level; name: string }[] = [
  { level: 1, name: '초등' },
  { level: 2, name: '중학' },
  { level: 3, name: '고등 기본' },
  { level: 4, name: '수능' },
  { level: 5, name: '대학·공인영어' },
  { level: 6, name: '전문·기술' },
];
export const MAX_LEVEL = LEVELS.length;
/** level 을 적지 않은 단어(직접 추가한 단어)에 쓰는 값 */
export const DEFAULT_LEVEL: Level = 4;
export const levelName = (level: number) => LEVELS.find((l) => l.level === level)?.name ?? '';

/** 시험별 노트 */
export interface ExamNote {
  cat: string;
  md: string;
}

/**
 * 단어 하나.
 * 위쪽은 공통 사전(data/words) 에 적힌 값이고, 아래 freq·occ·contexts·notes 는
 * 시험 데이터(data/exams)를 읽어 붙인 값이다 (src/lib/exams.ts 의 buildWordData).
 */
export interface Word {
  id: string;
  word: string;
  level: Level;
  pos: string[];
  ipa?: string;
  meaning: string;
  short: string;
  senses: Sense[];
  forms?: string[];
  synonyms?: string[];
  domain: string;
  memory?: Memory;
  /** 모든 시험에서 나온 횟수의 합 */
  freq: number;
  /** 시험 id → 문제 파일 id → 나온 횟수. 그 시험 문제에 나온 단어만 키가 있다 */
  occ: Record<string, Record<string, number>>;
  /** 모든 시험의 예문 (시험 순서, 시험 안에서는 정해 둔 순서) */
  contexts: Context[];
  notes?: ExamNote[];
}

export const POS_LIST = [
  '명사',
  '동사',
  '형용사',
  '부사',
  '전치사',
  '접속사',
  '대명사',
  '한정사',
  '감탄사',
  '약어',
  '명사구',
  '동사구',
  '형용사구',
  '부사구',
  '전치사구',
] as const;

/** 의미 분류 — 오답 보기를 비슷한 뜻에서 고르는 데 쓴다 */
export const DOMAINS = [
  '생성·추가',
  '삭제·제거',
  '변경·수정',
  '확인·검증',
  '실행·처리',
  '이동·전달',
  '저장·기록',
  '검색·조회',
  '비교·평가·판단',
  '제어·제한·관리',
  '연결·통합',
  '요청·소통',
  '시작·종료',
  '오류·실패·위험',
  '원인·결과·영향',
  '정도·양·크기',
  '시간·순서·빈도',
  '구조·구성·부분',
  '데이터·정보·문서',
  '시스템·도구·기술',
  '사람·조직·역할',
  '상태·성질',
  '정확·품질·신뢰',
  '계획·목표·전략',
  '비즈니스·업무',
  '논리·관계·연결어',
  '일반',
] as const;

/** 문제 파일. kind 가 wordbook 이면 예문만 있는 파일(기존 단어장 등)이라 문제 파일 목록에는 나오지 않는다 */
export interface SourceInfo {
  id: string;
  name: string;
  kind?: 'quiz' | 'wordbook';
}

/** 시험(카테고리) */
export interface ExamInfo {
  id: string;
  name: string;
  sources: SourceInfo[];
}

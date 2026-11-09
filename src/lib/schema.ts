/** 단어 데이터 스키마 — data/words/*.json 의 한 항목 */

export interface Sense {
  pos: string;
  ko: string;
}

export interface Context {
  /** 출처 파일 id (예: mock04). vocab 상세 예문이면 "vocab" */
  src: string;
  /** 문제 번호 (vocab 예문이면 0) */
  q: number;
  /** 원문 문장 */
  en: string;
  /** 문장 속 실제 표기 (강조 표시용) */
  surface: string;
  /** 이 문장에서의 품사 */
  pos: string;
  /** 이 문장에서의 뜻 — senses[].ko 중 하나 */
  sense: string;
  /** 문장 한글 해석 */
  ko?: string;
}

export interface Word {
  id: string;
  word: string;
  tier: 'core' | 'extra';
  basic?: boolean;
  pos: string[];
  ipa?: string;
  meaning: string;
  short: string;
  senses: Sense[];
  forms?: string[];
  synonyms?: string[];
  domain: string;
  freq: number;
  sources: string[];
  contexts: Context[];
  note?: string;
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

export const SOURCE_VOCAB = 'vocab';

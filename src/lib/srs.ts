/**
 * SRS — ts-fsrs(FSRS) 래퍼.
 * 평가: 모른다·오답 → again, 안다·정답 → good, (쉬움) → easy
 * 시험일이 있으면 최대 간격을 남은 일수로 제한해 시험 전에 모든 단어를 한 번 더 보게 한다.
 */
import { createEmptyCard, fsrs, Rating, State, type Card, type CardInput, type Grade } from 'ts-fsrs';
import { daysUntil } from './text';

export type Grade3 = 'again' | 'good' | 'easy';

/** localStorage 에 저장되는 카드 (날짜는 ISO 문자열) */
export interface StoredCard {
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export type WordStatus = 'new' | 'learning' | 'mastered';

const GRADE: Record<Grade3, Grade> = { again: Rating.Again, good: Rating.Good, easy: Rating.Easy };

/** 시험일 기준 최대 간격 (일). 시험일이 없거나 지났으면 기본값 */
export function maxIntervalFor(examDate?: string, now: Date = new Date()): number {
  if (!examDate) return 36500;
  const left = daysUntil(examDate, now);
  return left >= 1 ? left : 36500;
}

export function toCard(s: StoredCard): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    ...(s.last_review ? { last_review: new Date(s.last_review) } : {}),
  };
}

export function toStored(c: Card): StoredCard {
  return {
    due: new Date(c.due).toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    ...(c.last_review ? { last_review: new Date(c.last_review).toISOString() } : {}),
  };
}

export function review(
  stored: StoredCard | undefined,
  grade: Grade3,
  opts: { now?: Date; examDate?: string } = {},
): StoredCard {
  const now = opts.now ?? new Date();
  const maxInterval = maxIntervalFor(opts.examDate, now);
  const f = fsrs({ request_retention: 0.9, maximum_interval: maxInterval, enable_fuzz: true });
  const card: Card | CardInput = stored ? toCard(stored) : createEmptyCard(now);
  const { card: next } = f.next(card, now, GRADE[grade]);
  // 새 카드의 첫 평가는 라이브러리가 최대 간격을 적용하지 않는 경우가 있어 직접 한 번 더 제한한다
  if (next.scheduled_days > maxInterval) {
    next.scheduled_days = maxInterval;
    next.due = new Date(now.getTime() + maxInterval * 86_400_000);
  }
  return toStored(next);
}

export function statusOf(c: StoredCard | undefined): WordStatus {
  if (!c) return 'new';
  return c.state === State.Review && c.stability >= 7 ? 'mastered' : 'learning';
}

export function isDue(c: StoredCard | undefined, now: Date = new Date()): boolean {
  return !!c && new Date(c.due).getTime() <= now.getTime();
}

export const STATUS_LABEL: Record<WordStatus, string> = {
  new: '새 단어',
  learning: '학습 중',
  mastered: '익힘',
};

/**
 * 오늘의 복습 계획 — 웹·앱 공용.
 * 기한이 지난 카드(기한 순) + 남은 하루 새 단어 한도만큼 새 단어(주 시험에 나온 단어, 학습 단계 이상, 자주 나온 순)
 */
import { freqIn, inExam } from './exams';
import type { Word } from './schema';
import { isDue, type StoredCard } from './srs';

export interface ReviewPlan {
  due: string[];
  fresh: string[];
}

/** 새 단어를 고르는 기준 — 설정의 주 시험과 학습 단계 */
export interface FreshPick {
  /** 이 시험 문제에 나온 단어에서 (없으면 사전 전체) */
  cat?: string;
  /** 이 단계 이상만 */
  minLevel?: number;
}

export function reviewPlan(
  words: Word[],
  cards: Record<string, StoredCard>,
  newPerDay: number,
  todayNew: number,
  now: Date = new Date(),
  pick: FreshPick = {},
): ReviewPlan {
  const known = new Set(words.map((w) => w.id));
  const due = Object.entries(cards)
    .filter(([id, c]) => known.has(id) && isDue(c, now))
    .sort((a, b) => new Date(a[1].due).getTime() - new Date(b[1].due).getTime())
    .map(([id]) => id);
  const left = Math.max(0, newPerDay - todayNew);
  const fresh = words
    .filter((w) => inExam(w, pick.cat) && w.level >= (pick.minLevel ?? 2) && !cards[w.id])
    .sort((a, b) => freqIn(b, pick.cat) - freqIn(a, pick.cat))
    .slice(0, left)
    .map((w) => w.id);
  return { due, fresh };
}

/** 앞으로 n일 동안 날짜별 복습 예정 수 (오늘 칸에는 이미 기한이 지난 카드도 포함) */
export function dueForecast(cards: Record<string, StoredCard>, days = 7, now: Date = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const out: { date: Date; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const from = new Date(start.getTime() + i * 86_400_000);
    const to = new Date(from.getTime() + 86_400_000);
    const count = Object.values(cards).filter((c) => {
      const d = new Date(c.due).getTime();
      return i === 0 ? d < to.getTime() : d >= from.getTime() && d < to.getTime();
    }).length;
    out.push({ date: from, count });
  }
  return out;
}

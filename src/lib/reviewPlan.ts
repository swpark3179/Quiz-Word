/**
 * 오늘의 복습 계획 — 웹·앱 공용.
 * 기한이 지난 카드(기한 순) + 남은 하루 새 단어 한도만큼 새 단어(CCAR-F 핵심, 기초 제외, 자주 나온 순)
 */
import type { Word } from './schema';
import { isDue, type StoredCard } from './srs';

export interface ReviewPlan {
  due: string[];
  fresh: string[];
}

export function reviewPlan(
  words: Word[],
  cards: Record<string, StoredCard>,
  newPerDay: number,
  todayNew: number,
  now: Date = new Date(),
): ReviewPlan {
  const known = new Set(words.map((w) => w.id));
  const due = Object.entries(cards)
    .filter(([id, c]) => known.has(id) && isDue(c, now))
    .sort((a, b) => new Date(a[1].due).getTime() - new Date(b[1].due).getTime())
    .map(([id]) => id);
  const left = Math.max(0, newPerDay - todayNew);
  const fresh = words
    .filter((w) => w.tier === 'core' && !w.basic && !cards[w.id])
    .sort((a, b) => b.freq - a.freq)
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

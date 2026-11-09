/**
 * 플래시카드 대기열 — "모른다" 카드를 몇 장 뒤에 다시 끼워 넣는다.
 * - 처음 모르면 4~6장 뒤, 연속으로 모르면 3장 뒤 (남은 카드가 적으면 맨 뒤)
 * - 다시 나왔을 때 "안다" 를 고르면 통과
 * - first: 카드별 첫 판정 (SRS·요약에는 이것만 반영)
 */

export interface FlashQueue {
  order: string[];
  misses: Record<string, number>;
  first: Record<string, boolean>;
  done: string[];
  /** 지금까지 본 카드 수 (재등장 포함) */
  shown: number;
}

export function createQueue(ids: string[]): FlashQueue {
  return { order: [...ids], misses: {}, first: {}, done: [], shown: 0 };
}

export const currentId = (q: FlashQueue): string | undefined => q.order[0];

export const isFinished = (q: FlashQueue): boolean => q.order.length === 0;

/** 지금 카드가 다시 나온 카드인지 */
export const isRepeat = (q: FlashQueue): boolean => {
  const id = currentId(q);
  return !!id && id in q.first;
};

export function answer(q: FlashQueue, known: boolean, rng: () => number = Math.random): FlashQueue {
  const [id, ...rest] = q.order;
  if (!id) return q;
  const first = id in q.first ? q.first : { ...q.first, [id]: known };
  if (known) {
    return { ...q, order: rest, first, done: [...q.done, id], shown: q.shown + 1 };
  }
  const misses = (q.misses[id] ?? 0) + 1;
  const gap = misses >= 2 ? 3 : 4 + Math.floor(rng() * 3); // 4~6
  const pos = Math.min(gap - 1, rest.length);
  const order = [...rest.slice(0, pos), id, ...rest.slice(pos)];
  return { ...q, order, first, misses: { ...q.misses, [id]: misses }, shown: q.shown + 1 };
}

export function summary(q: FlashQueue) {
  const ids = Object.keys(q.first);
  const unknown = ids.filter((id) => !q.first[id]);
  return { total: ids.length, known: ids.length - unknown.length, unknown };
}

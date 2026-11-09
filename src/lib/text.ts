/** 한글 뜻 비교·날짜 등 작은 도우미 */

/** 비교용으로 괄호 보충·기호·공백을 걷어낸다 */
export function koCore(s: string): string {
  return s
    .replace(/\([^)]*\)/g, '')
    .replace(/[^가-힣a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function bigrams(s: string): string[] {
  const t = koCore(s);
  if (t.length < 2) return t ? [t] : [];
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** 문자 bigram Dice 계수 (0~1) — 두 한글 뜻이 얼마나 겹치는지 */
export function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const counts = new Map<string, number>();
  for (const x of A) counts.set(x, (counts.get(x) ?? 0) + 1);
  let inter = 0;
  for (const x of B) {
    const c = counts.get(x);
    if (c) {
      inter++;
      counts.set(x, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

/** 쉼표로 나뉜 뜻 조각 중 하나라도 같으면 사실상 같은 뜻 */
export function sharesGloss(a: string, b: string): boolean {
  const pa = a.split(/[,，;·]/).map(koCore).filter((x) => x.length >= 2);
  const pb = new Set(b.split(/[,，;·]/).map(koCore).filter((x) => x.length >= 2));
  return pa.some((x) => pb.has(x));
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(arr: T[], n: number, rng: () => number = Math.random): T[] {
  return shuffle(arr, rng).slice(0, n);
}

/** 로컬 날짜 YYYY-MM-DD */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 오늘부터 날짜까지 남은 일수 (오늘이면 0) */
export function daysUntil(date: string, now: Date = new Date()): number {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function relativeDue(due: Date, now: Date = new Date()): string {
  const diff = due.getTime() - now.getTime();
  if (diff <= 0) return '지금 복습';
  const min = Math.round(diff / 60_000);
  if (min < 60) return `${min}분 후`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 후`;
  const d = Math.round(h / 24);
  return `${d}일 후`;
}

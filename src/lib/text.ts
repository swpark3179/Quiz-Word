/** 한글 뜻 비교·날짜 등 작은 도우미 */

/**
 * 오답 보기를 고를 때 같은 뜻 문자열을 수천 번 비교하므로 정리 결과를 문자열별로 기억해 둔다.
 * 뜻 문자열의 종류는 단어 수 × 뜻 수 정도(수천 개)라 지우지 않아도 된다.
 */
const coreCache = new Map<string, string>();
const bigramCache = new Map<string, string[]>();
const glossCache = new Map<string, string[]>();

/** 비교용으로 괄호 보충·기호·공백을 걷어낸다 */
export function koCore(s: string): string {
  let t = coreCache.get(s);
  if (t === undefined) {
    t = s
      .replace(/\([^)]*\)/g, '')
      .replace(/[^가-힣a-zA-Z0-9]/g, '')
      .toLowerCase();
    coreCache.set(s, t);
  }
  return t;
}

function bigrams(s: string): string[] {
  let out = bigramCache.get(s);
  if (!out) {
    const t = koCore(s);
    if (t.length < 2) out = t ? [t] : [];
    else {
      out = [];
      for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
    }
    bigramCache.set(s, out);
  }
  return out;
}

/** 문자 bigram Dice 계수 (0~1) — 두 한글 뜻이 얼마나 겹치는지 */
export function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;
  // 뜻 문자열은 짧아(bigram 20개 안팎) Map 보다 배열 두 겹 비교가 빠르다 — 같은 bigram 은 한 번씩만 센다
  const used = new Uint8Array(A.length);
  let inter = 0;
  for (const x of B) {
    for (let i = 0; i < A.length; i++) {
      if (!used[i] && A[i] === x) {
        used[i] = 1;
        inter++;
        break;
      }
    }
  }
  return (2 * inter) / (A.length + B.length);
}

/** 쉼표 등으로 나눈 뜻 조각 (비교용으로 정리, 2글자 이상) */
function glosses(s: string): string[] {
  let out = glossCache.get(s);
  if (!out) {
    out = s.split(/[,，;·]/).map(koCore).filter((x) => x.length >= 2);
    glossCache.set(s, out);
  }
  return out;
}

/** 쉼표로 나뉜 뜻 조각 중 하나라도 같으면 사실상 같은 뜻 */
export function sharesGloss(a: string, b: string): boolean {
  const pa = glosses(a);
  if (!pa.length) return false;
  const pb = glosses(b);
  return pa.some((x) => pb.includes(x));
}

/**
 * 표제어 정렬 — 대소문자를 무시하고 비교, 같으면 원문으로.
 * localeCompare 는 iPhone(Hermes)에서 호출마다 비용이 커서 2천 개 정렬이 눈에 띄게 느려진다.
 */
export function compareWord(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 목록을 표제어 순으로 (비교 키를 한 번만 만든다) */
export function sortByWord<T extends { word: string }>(list: readonly T[]): T[] {
  return list
    .map((item) => ({ item, key: item.word.toLowerCase() }))
    .sort((a, b) => (a.key !== b.key ? (a.key < b.key ? -1 : 1) : a.item.word < b.item.word ? -1 : a.item.word > b.item.word ? 1 : 0))
    .map((x) => x.item);
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

/** "방금", "5분 전", "3시간 전", "2일 전" */
export function timeAgo(ts: number, now: number = Date.now()): string {
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

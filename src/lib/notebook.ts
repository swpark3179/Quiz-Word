/**
 * 학습장 — 직접 고른 단어만 모아 두고 반복해서 학습하는 목록.
 * 진행 기록 스토어(progressStore)에 함께 저장되어 내보내기/가져오기에 들어간다. 웹·앱 공용.
 */

export interface Notebook {
  id: string;
  name: string;
  /** 단어 id — 최근에 넣은 단어가 앞 */
  ids: string[];
  createdAt: number;
  updatedAt: number;
}

export function newNotebookId(now = Date.now()): string {
  return `nb-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** "학습장 1", "학습장 2" … 중 아직 안 쓴 이름 */
export function defaultNotebookName(existing: { name: string }[]): string {
  const used = new Set(existing.map((n) => n.name.trim()));
  let i = 1;
  while (used.has(`학습장 ${i}`)) i++;
  return `학습장 ${i}`;
}

/** 오답노트를 복사해 만든 학습장 이름 — "오답노트 11/10" */
export function wrongNotebookName(date: Date = new Date()): string {
  return `오답노트 ${date.getMonth() + 1}/${date.getDate()}`;
}

/** 학습장 이름 최대 길이 */
export const NOTEBOOK_NAME_MAX = 40;

/**
 * 플래시카드를 어디서 시작했는지 — 하다 만 단어로 만드는 학습장 이름의 앞부분.
 * 학습장에서 시작했으면 그 이름, 오답노트면 "오답노트 11/11", 그 밖에는 "플래시카드 11/11"
 */
export function flashSourceName(
  scope: { set: string; notebook?: string },
  notebooks: { id: string; name: string }[],
  date: Date = new Date(),
): string {
  if (scope.set === 'notebook') {
    const nb = notebooks.find((n) => n.id === scope.notebook);
    if (nb) return nb.name;
  }
  if (scope.set === 'wrong') return wrongNotebookName(date);
  return `플래시카드 ${date.getMonth() + 1}/${date.getDate()}`;
}

/** 하다 만 플래시카드를 나눠 만드는 학습장 이름 — "오답노트 11/11 · 남은 단어". 길면 앞부분을 줄여 뒷말이 남게 한다 */
export function flashSplitNotebookName(part: 'done' | 'left', source: string): string {
  const suffix = part === 'done' ? ' · 진행한 단어' : ' · 남은 단어';
  return (source.trim() || '플래시카드').slice(0, NOTEBOOK_NAME_MAX - suffix.length).trimEnd() + suffix;
}

/** 중복 없이 (처음 나온 순서 유지) */
export const uniqueIds = (ids: string[]) => [...new Set(ids)];

/** 학습장 합치기 — 넘겨준 학습장 순서대로, 각 학습장 안의 순서는 그대로 두고 겹치는 단어는 처음 나온 자리만 남긴다 */
export const mergeNotebookIds = (books: { ids: string[] }[]) => uniqueIds(books.flatMap((b) => b.ids));

/** 합친 학습장의 기본 이름 — "시험 직전 + 자주 틀림". 길면 "시험 직전 외 2개" (앞 이름을 줄여 뒷말이 남게) */
export function mergedNotebookName(books: { name: string }[]): string {
  const names = books.map((b) => b.name.trim()).filter(Boolean);
  if (!names.length) return '합친 학습장';
  const joined = names.join(' + ');
  if (joined.length <= NOTEBOOK_NAME_MAX) return joined;
  const suffix = ` 외 ${names.length - 1}개`;
  return names[0].slice(0, NOTEBOOK_NAME_MAX - suffix.length).trimEnd() + suffix;
}

/** 가져온 파일의 학습장 목록을 검사한다 — 형식이 맞지 않는 항목은 버린다 */
export function sanitizeNotebooks(raw: unknown): Notebook[] {
  if (!Array.isArray(raw)) return [];
  const out: Notebook[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const n = r as Partial<Notebook>;
    if (typeof n.id !== 'string' || !n.id || seen.has(n.id)) continue;
    if (typeof n.name !== 'string' || !Array.isArray(n.ids)) continue;
    seen.add(n.id);
    const now = Date.now();
    const createdAt = typeof n.createdAt === 'number' ? n.createdAt : now;
    out.push({
      id: n.id,
      name: n.name.trim() || '학습장',
      ids: uniqueIds(n.ids.filter((x): x is string => typeof x === 'string' && !!x)),
      createdAt,
      updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : createdAt,
    });
  }
  return out;
}

/** 이름 입력값 정리 — 비우면 기본 이름 */
export function cleanNotebookName(name: string, fallback: string): string {
  return name.trim().slice(0, NOTEBOOK_NAME_MAX) || fallback;
}

/** 오답노트 단어 id — 많이 틀린 순(같으면 최근 순), 오답노트 화면의 기본 순서. known 으로 지금 데이터에 있는 단어만 남긴다 */
export function wrongIdsByCount(wrong: Record<string, { count: number; lastAt: number }>, known: (id: string) => boolean = () => true): string[] {
  return Object.entries(wrong)
    .filter(([id]) => known(id))
    .sort(([, a], [, b]) => b.count - a.count || b.lastAt - a.lastAt)
    .map(([id]) => id);
}

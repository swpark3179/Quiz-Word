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

/** 중복 없이 (처음 나온 순서 유지) */
export const uniqueIds = (ids: string[]) => [...new Set(ids)];

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
  return name.trim().slice(0, 40) || fallback;
}

/** 오답노트 단어 id — 많이 틀린 순(같으면 최근 순), 오답노트 화면의 기본 순서. known 으로 지금 데이터에 있는 단어만 남긴다 */
export function wrongIdsByCount(wrong: Record<string, { count: number; lastAt: number }>, known: (id: string) => boolean = () => true): string[] {
  return Object.entries(wrong)
    .filter(([id]) => known(id))
    .sort(([, a], [, b]) => b.count - a.count || b.lastAt - a.lastAt)
    .map(([id]) => id);
}

/**
 * 단어 상세의 이전·다음 — 마지막으로 보던 목록(단어장 검색 결과, 오답노트)의 순서를 기억한다.
 * 화면 사이에서만 쓰는 값이라 저장하지 않는다 (새로고침하면 사라지고, 그때는 이전·다음 버튼이 숨는다).
 */
import type { ExamplePref } from '../lib/corpus';

let ids: string[] = [];
let back = '';
let pref: ExamplePref | undefined;

/**
 * backLabel: 상세 화면의 돌아가기 버튼에 쓸 말 (예: "단어장으로")
 * examPref: 목록에서 고른 시험·문제 파일 — 상세에서 그쪽 예문을 먼저 보여 준다
 */
export function setWordNav(list: string[], backLabel: string, examPref?: ExamplePref) {
  ids = list;
  back = backLabel;
  pref = examPref;
}

export function wordNeighbors(id: string) {
  const index = ids.indexOf(id);
  if (index < 0) return undefined;
  return { index, total: ids.length, prev: ids[index - 1], next: ids[index + 1], back, pref };
}

/** 단어장으로 돌아왔을 때 보던 위치 — 검색·필터 조건이 같을 때만 되살린다 */
let listView = { key: '', offset: 0 };

export const saveListView = (key: string, offset: number) => {
  listView = { key, offset };
};

export const savedListOffset = (key: string) => (listView.key === key ? listView.offset : 0);

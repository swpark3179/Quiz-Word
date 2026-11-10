import { describe, expect, it } from 'vitest';
import { defaultNotebookName, sanitizeNotebooks } from '../notebook';
import { createProgressStore, exportProgress } from '../progressStore';

/** 웹 localStorage / 앱 kv-store 대신 쓰는 메모리 저장소 (동기) */
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

describe('progressStore (웹·앱 공용)', () => {
  it('정답·오답을 기록하면 SRS 카드·오답노트·통계가 갱신되고 저장소에 쓰인다', () => {
    const storage = memoryStorage();
    const store = createProgressStore(() => storage);
    store.getState().record('escalate', false);
    store.getState().record('address', true);
    const s = store.getState();
    expect(Object.keys(s.cards).sort()).toEqual(['address', 'escalate']);
    expect(s.wrong.escalate.count).toBe(1);
    expect(s.wrong.address).toBeUndefined();
    expect(Object.values(s.days)[0]).toMatchObject({ reviews: 2, newWords: 2, correct: 1, wrong: 1 });
    expect(storage.raw.get('quiz-word:v1')).toContain('escalate');
  });

  it('오답노트 단어는 연속으로 기준 횟수만큼 맞히면 빠진다', () => {
    const store = createProgressStore(() => memoryStorage());
    store.getState().record('issue', false);
    store.getState().record('issue', true);
    expect(store.getState().wrong.issue.streak).toBe(1);
    store.getState().record('issue', true);
    expect(store.getState().wrong.issue).toBeUndefined();
  });

  it('저장소를 바꿔 끼워도 같은 JSON 으로 내보내고 가져온다 (웹 ↔ 앱)', () => {
    const web = createProgressStore(() => memoryStorage());
    web.getState().record('surface', false);
    web.getState().updateSettings({ examDate: '2026-11-21', newPerDay: 50 });
    const json = exportProgress(web);

    const app = createProgressStore(() => memoryStorage());
    app.getState().importData(JSON.parse(json));
    expect(app.getState().cards.surface).toEqual(web.getState().cards.surface);
    expect(app.getState().wrong.surface.count).toBe(1);
    expect(app.getState().settings).toMatchObject({ examDate: '2026-11-21', newPerDay: 50, ttsRate: 0.9 });
  });

  it('저장된 기록이 있으면 새로 만든 스토어가 바로 이어서 읽는다', () => {
    const storage = memoryStorage();
    createProgressStore(() => storage).getState().record('robust', true);
    const reopened = createProgressStore(() => storage);
    expect(reopened.getState().cards.robust).toBeDefined();
  });

  it('학습장: 만들기·추가(중복 무시, 최근 것이 앞)·빼기·이름 바꾸기·삭제', () => {
    const store = createProgressStore(() => memoryStorage());
    const id = store.getState().createNotebook('  시험 직전  ');
    store.getState().addToNotebook(id, 'escalate');
    store.getState().addToNotebook(id, 'address');
    store.getState().addToNotebook(id, 'escalate');
    let nb = store.getState().notebooks.find((n) => n.id === id)!;
    expect(nb.name).toBe('시험 직전');
    expect(nb.ids).toEqual(['address', 'escalate']);

    store.getState().removeFromNotebook(id, 'address');
    store.getState().renameNotebook(id, '자주 틀림');
    store.getState().renameNotebook(id, '   '); // 빈 이름은 무시
    nb = store.getState().notebooks.find((n) => n.id === id)!;
    expect(nb).toMatchObject({ name: '자주 틀림', ids: ['escalate'] });

    const second = store.getState().createNotebook('둘째');
    expect(store.getState().notebooks.map((n) => n.id)).toEqual([second, id]); // 새로 만든 것이 앞
    store.getState().deleteNotebook(id);
    expect(store.getState().notebooks.map((n) => n.id)).toEqual([second]);
  });

  it('오답노트를 통째로 학습장으로 — 이후 오답노트가 바뀌어도 학습장은 그대로', () => {
    const store = createProgressStore(() => memoryStorage());
    store.getState().record('issue', false);
    store.getState().record('surface', false);
    const id = store.getState().createNotebook('오답노트 11/10', Object.keys(store.getState().wrong));
    store.getState().removeWrong('issue');
    expect(store.getState().notebooks[0]).toMatchObject({ id, ids: ['issue', 'surface'] });
  });

  it('학습장도 내보내기 JSON 에 들어가고 가져오면 그대로 옮겨진다', () => {
    const web = createProgressStore(() => memoryStorage());
    const id = web.getState().createNotebook('웹 학습장', ['robust', 'latency']);
    const json = exportProgress(web);
    expect(JSON.parse(json).notebooks).toHaveLength(1);

    const app = createProgressStore(() => memoryStorage());
    app.getState().createNotebook('앱에만 있던 학습장');
    app.getState().importData(JSON.parse(json));
    expect(app.getState().notebooks).toEqual(web.getState().notebooks);
    expect(app.getState().notebooks[0].id).toBe(id);
  });

  it('학습장이 없는 예전 파일을 가져오면 학습장은 빈 목록이 된다', () => {
    const store = createProgressStore(() => memoryStorage());
    store.getState().createNotebook('지금 학습장');
    store.getState().importData({ app: 'quiz-word', version: 1, cards: {}, settings: {} });
    expect(store.getState().notebooks).toEqual([]);
  });

  it('기록 초기화를 해도 학습장은 남고, 다시 열어도 이어서 읽는다', () => {
    const storage = memoryStorage();
    const store = createProgressStore(() => storage);
    store.getState().record('robust', false);
    store.getState().createNotebook('남는 학습장', ['robust']);
    store.getState().resetProgress();
    expect(store.getState().cards).toEqual({});
    expect(store.getState().notebooks[0]).toMatchObject({ name: '남는 학습장', ids: ['robust'] });
    expect(createProgressStore(() => storage).getState().notebooks).toHaveLength(1);
  });

  it('가져온 학습장 형식 검사 — 잘못된 항목은 버리고 중복 단어는 뺀다', () => {
    const out = sanitizeNotebooks([
      { id: 'nb-a', name: 'A', ids: ['x', 'y', 'x', 3], createdAt: 1, updatedAt: 2 },
      { id: 'nb-a', name: '같은 id', ids: [] },
      { id: 'nb-b', name: 'B' },
      { name: 'id 없음', ids: [] },
      null,
      'text',
    ]);
    expect(out).toEqual([{ id: 'nb-a', name: 'A', ids: ['x', 'y'], createdAt: 1, updatedAt: 2 }]);
    expect(sanitizeNotebooks({ not: 'array' })).toEqual([]);
  });

  it('기본 학습장 이름은 아직 안 쓴 번호', () => {
    expect(defaultNotebookName([])).toBe('학습장 1');
    expect(defaultNotebookName([{ name: '학습장 1' }, { name: '학습장 3' }])).toBe('학습장 2');
  });
});

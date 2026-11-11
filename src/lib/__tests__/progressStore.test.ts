import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultNotebookName, flashSourceName, flashSplitNotebookName, mergedNotebookName, NOTEBOOK_NAME_MAX, sanitizeNotebooks } from '../notebook';
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

  describe('저장 모아 쓰기 (writeDelayMs)', () => {
    afterEach(() => vi.useRealTimers());

    function countingStorage() {
      const base = memoryStorage();
      let writes = 0;
      return { ...base, setItem: (k: string, v: string) => (writes++, base.setItem(k, v)), writes: () => writes };
    }

    it('여러 번 기록해도 시간이 지난 뒤 한 번만 쓴다', () => {
      vi.useFakeTimers();
      const storage = countingStorage();
      const store = createProgressStore(() => storage, { writeDelayMs: 500 });
      store.getState().record('escalate', false);
      store.getState().record('address', true);
      store.getState().addWrong('robust');
      expect(storage.writes()).toBe(0);
      vi.advanceTimersByTime(499);
      expect(storage.writes()).toBe(0);
      vi.advanceTimersByTime(1);
      expect(storage.writes()).toBe(1);
      const saved = JSON.parse(storage.raw.get('quiz-word:v1')!);
      expect(Object.keys(saved.state.cards).sort()).toEqual(['address', 'escalate']);
      expect(saved.state.wrong.robust).toBeDefined();
    });

    it('flush() 하면 기다리지 않고 바로 쓰고, 다시 열면 그대로 읽는다', () => {
      vi.useFakeTimers();
      const storage = countingStorage();
      const store = createProgressStore(() => storage, { writeDelayMs: 10_000 });
      store.getState().record('latency', true);
      store.flush();
      expect(storage.writes()).toBe(1);
      store.flush(); // 쓸 것이 없으면 다시 쓰지 않는다
      expect(storage.writes()).toBe(1);
      expect(createProgressStore(() => storage).getState().cards.latency).toBeDefined();
    });
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

  it('학습장 합치기: 겹치는 단어는 한 번만, 새 학습장이 맨 앞, 기존 학습장은 남겨 둔다', () => {
    const store = createProgressStore(() => memoryStorage());
    const a = store.getState().createNotebook('A', ['robust', 'latency', 'issue']);
    const b = store.getState().createNotebook('B', ['issue', 'surface', 'robust']);
    const c = store.getState().createNotebook('C', ['address']);
    // 고른 순서와 상관없이 학습장 목록 순서(B → A)대로, 각 학습장 안의 순서는 그대로
    const id = store.getState().mergeNotebooks([a, b], '  합본  ')!;
    const s = store.getState();
    expect(s.notebooks.map((n) => n.id)).toEqual([id, c, b, a]);
    expect(s.notebooks[0]).toMatchObject({ name: '합본', ids: ['issue', 'surface', 'robust', 'latency'] });
    expect(s.notebooks.find((n) => n.id === a)!.ids).toEqual(['robust', 'latency', 'issue']);
  });

  it('학습장 합치기: 기존 학습장 삭제를 고르면 합친 학습장만 지운다', () => {
    const store = createProgressStore(() => memoryStorage());
    const a = store.getState().createNotebook('시험 직전', ['robust']);
    const b = store.getState().createNotebook('자주 틀림', ['latency', 'robust']);
    const c = store.getState().createNotebook('남는 학습장', ['address']);
    const id = store.getState().mergeNotebooks([a, b], '', { deleteSources: true })!;
    const s = store.getState();
    expect(s.notebooks.map((n) => n.id)).toEqual([id, c]);
    // 이름을 비우면 기본 이름
    expect(s.notebooks[0]).toMatchObject({ name: '자주 틀림 + 시험 직전', ids: ['latency', 'robust'] });
  });

  it('학습장 합치기: 있는 학습장이 2개 미만이면 아무것도 하지 않는다', () => {
    const store = createProgressStore(() => memoryStorage());
    const a = store.getState().createNotebook('A', ['robust']);
    const before = store.getState().notebooks;
    expect(store.getState().mergeNotebooks([a], '하나', { deleteSources: true })).toBeNull();
    expect(store.getState().mergeNotebooks([a, 'nb-없음'], '없는 것', { deleteSources: true })).toBeNull();
    expect(store.getState().notebooks).toBe(before);
  });

  it('합친 학습장 기본 이름 — 짧으면 이어 붙이고 길면 "… 외 N개"', () => {
    expect(mergedNotebookName([{ name: '시험 직전' }, { name: '자주 틀림' }])).toBe('시험 직전 + 자주 틀림');
    const long = [{ name: '오답노트 11/11 · 진행한 단어' }, { name: '오답노트 11/11 · 남은 단어' }, { name: 'C' }];
    expect(mergedNotebookName(long)).toBe('오답노트 11/11 · 진행한 단어 외 2개');
    const huge = mergedNotebookName([{ name: '가'.repeat(NOTEBOOK_NAME_MAX) }, { name: 'B' }]);
    expect(huge.length).toBeLessThanOrEqual(NOTEBOOK_NAME_MAX);
    expect(huge.endsWith(' 외 1개')).toBe(true);
    expect(mergedNotebookName([])).toBe('합친 학습장');
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

  it('플래시카드를 하다 만 단어로 만드는 학습장 이름', () => {
    const d = new Date('2026-11-11T09:00:00');
    const notebooks = [{ id: 'nb-a', name: '시험 직전' }];
    expect(flashSourceName({ set: 'notebook', notebook: 'nb-a' }, notebooks, d)).toBe('시험 직전');
    expect(flashSourceName({ set: 'notebook', notebook: 'nb-없음' }, notebooks, d)).toBe('플래시카드 11/11');
    expect(flashSourceName({ set: 'wrong' }, notebooks, d)).toBe('오답노트 11/11');
    expect(flashSourceName({ set: 'core' }, notebooks, d)).toBe('플래시카드 11/11');
    expect(flashSplitNotebookName('done', '오답노트 11/11')).toBe('오답노트 11/11 · 진행한 단어');
    expect(flashSplitNotebookName('left', '오답노트 11/11')).toBe('오답노트 11/11 · 남은 단어');
    // 긴 학습장 이름이어도 뒷말은 남고 길이 제한 안
    const long = flashSplitNotebookName('left', '가'.repeat(NOTEBOOK_NAME_MAX));
    expect(long.length).toBeLessThanOrEqual(NOTEBOOK_NAME_MAX);
    expect(long.endsWith(' · 남은 단어')).toBe(true);
  });
});

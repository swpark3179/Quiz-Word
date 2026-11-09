import { describe, expect, it } from 'vitest';
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
});

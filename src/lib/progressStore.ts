/**
 * 학습 진행 기록 스토어 — 웹(localStorage)과 iOS 앱(expo-sqlite kv-store)이 함께 쓴다.
 * 저장소만 바꿔 끼우므로 저장 형식(키 quiz-word:v1)과 내보내기 JSON 이 같고, 서로 가져올 수 있다.
 * 단어 id 기준이므로 data/words 에서 id 를 바꾸면 그 단어의 기록이 끊긴다.
 */
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { review, type Grade3, type StoredCard } from './srs';
import { dayKey } from './text';

export interface WrongEntry {
  count: number;
  /** 오답노트에 들어온 뒤 연속으로 맞힌 횟수 */
  streak: number;
  lastAt: number;
  addedAt: number;
}

export interface DayLog {
  reviews: number;
  newWords: number;
  correct: number;
  wrong: number;
}

export interface WordHistory {
  ok: number;
  ng: number;
  last: number;
}

export interface Settings {
  examDate?: string;
  newPerDay: number;
  ttsVoice?: string;
  ttsRate: number;
  autoSpeak: boolean;
  wrongAutoAdd: boolean;
  wrongGraduate: number;
  theme: 'system' | 'light' | 'dark';
  quizChoices: 4 | 5;
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 30,
  ttsRate: 0.9,
  autoSpeak: true,
  wrongAutoAdd: true,
  wrongGraduate: 2,
  theme: 'system',
  quizChoices: 4,
};

export type Source = 'flash' | 'quiz' | 'review';

export interface ProgressState {
  cards: Record<string, StoredCard>;
  wrong: Record<string, WrongEntry>;
  days: Record<string, DayLog>;
  history: Record<string, WordHistory>;
  settings: Settings;

  /** 학습 결과 기록 — SRS 갱신 + 오답노트 + 날짜별 통계 */
  record: (id: string, correct: boolean, opts?: { grade?: Grade3; srs?: boolean; source?: Source }) => void;
  addWrong: (id: string) => void;
  removeWrong: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  importData: (data: unknown) => void;
  resetProgress: () => void;
}

const emptyDay = (): DayLog => ({ reviews: 0, newWords: 0, correct: 0, wrong: 0 });

export const PROGRESS_KEY = 'quiz-word:v1';

export function createProgressStore(getStorage: () => StateStorage) {
  return create<ProgressState>()(
  persist(
    (set, get) => ({
      cards: {},
      wrong: {},
      days: {},
      history: {},
      settings: DEFAULT_SETTINGS,

      record(id, correct, opts = {}) {
        const { cards, wrong, days, history, settings } = get();
        const now = Date.now();
        const today = dayKey();
        const day = { ...(days[today] ?? emptyDay()) };
        const isNew = !cards[id];
        let nextCards = cards;
        if (opts.srs !== false) {
          const grade = opts.grade ?? (correct ? 'good' : 'again');
          nextCards = { ...cards, [id]: review(cards[id], grade, { examDate: settings.examDate }) };
          day.reviews++;
          if (isNew) day.newWords++;
        }
        if (correct) day.correct++;
        else day.wrong++;

        const h = history[id] ?? { ok: 0, ng: 0, last: 0 };
        const nextHistory = { ...history, [id]: { ok: h.ok + (correct ? 1 : 0), ng: h.ng + (correct ? 0 : 1), last: now } };

        let nextWrong = wrong;
        const w = wrong[id];
        if (!correct) {
          if (w || settings.wrongAutoAdd) {
            nextWrong = {
              ...wrong,
              [id]: { count: (w?.count ?? 0) + 1, streak: 0, lastAt: now, addedAt: w?.addedAt ?? now },
            };
          }
        } else if (w) {
          const streak = w.streak + 1;
          if (streak >= settings.wrongGraduate) {
            nextWrong = { ...wrong };
            delete nextWrong[id];
          } else {
            nextWrong = { ...wrong, [id]: { ...w, streak } };
          }
        }
        set({ cards: nextCards, wrong: nextWrong, days: { ...days, [today]: day }, history: nextHistory });
      },

      addWrong(id) {
        const { wrong } = get();
        if (wrong[id]) return;
        const now = Date.now();
        set({ wrong: { ...wrong, [id]: { count: 0, streak: 0, lastAt: now, addedAt: now } } });
      },

      removeWrong(id) {
        const next = { ...get().wrong };
        delete next[id];
        set({ wrong: next });
      },

      updateSettings(s) {
        set({ settings: { ...get().settings, ...s } });
      },

      importData(data) {
        const d = data as Partial<ProgressState> & { app?: string };
        if (!d || typeof d !== 'object' || !d.cards || !d.settings) throw new Error('진행 기록 파일이 아닙니다');
        set({
          cards: d.cards ?? {},
          wrong: d.wrong ?? {},
          days: d.days ?? {},
          history: d.history ?? {},
          settings: { ...DEFAULT_SETTINGS, ...d.settings },
        });
      },

      resetProgress() {
        set({ cards: {}, wrong: {}, days: {}, history: {} });
      },
    }),
    {
      name: PROGRESS_KEY,
      version: 1,
      storage: createJSONStorage(getStorage),
      partialize: (s) => ({ cards: s.cards, wrong: s.wrong, days: s.days, history: s.history, settings: s.settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } };
      },
    },
  ),
  );
}

export type ProgressStore = ReturnType<typeof createProgressStore>;

/** 진행 기록을 내보내기 JSON 문자열로 (웹·앱 공통 형식) */
export function exportProgress(store: ProgressStore): string {
  const { cards, wrong, days, history, settings } = store.getState();
  return JSON.stringify({ app: 'quiz-word', version: 1, exportedAt: new Date().toISOString(), cards, wrong, days, history, settings }, null, 1);
}

/**
 * 웹: 진행 기록을 브라우저 localStorage 에 저장 (스토어 로직은 src/lib/progressStore.ts 공용)
 * 저장은 0.4초 동안 모아서 한 번에 쓰고, 탭을 숨기거나 닫을 때 남은 것을 바로 쓴다.
 */
import { createProgressStore, exportProgress as exportFrom } from '../lib/progressStore';

export { DEFAULT_SETTINGS, PROGRESS_KEY } from '../lib/progressStore';
export type { DayLog, Notebook, ProgressState, ProgressStore, Settings, Source, WordHistory, WrongEntry } from '../lib/progressStore';

export const useProgress = createProgressStore(() => localStorage, { writeDelayMs: 400 });

if (typeof window !== 'undefined') {
  const flush = () => useProgress.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export const exportProgress = () => exportFrom(useProgress);

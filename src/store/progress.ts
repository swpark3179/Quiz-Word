/** 웹: 진행 기록을 브라우저 localStorage 에 저장 (스토어 로직은 src/lib/progressStore.ts 공용) */
import { createProgressStore, exportProgress as exportFrom } from '../lib/progressStore';

export { DEFAULT_SETTINGS, PROGRESS_KEY } from '../lib/progressStore';
export type { DayLog, ProgressState, ProgressStore, Settings, Source, WordHistory, WrongEntry } from '../lib/progressStore';

export const useProgress = createProgressStore(() => localStorage);

export const exportProgress = () => exportFrom(useProgress);

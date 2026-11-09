/**
 * 앱: 진행 기록을 기기 안 SQLite(kv-store)에 저장한다.
 * 스토어 로직과 저장 형식은 웹과 같은 공용 코드(src/lib/progressStore.ts)라서 웹에서 내보낸 JSON 을 그대로 가져올 수 있다.
 * 동기 API 를 써서 앱이 켜질 때 기록이 바로 채워진다(로딩 깜빡임 없음).
 */
import { createProgressStore, exportProgress as exportFrom } from '@shared/progressStore';
import { syncStorage } from '@/lib/kv';

export { DEFAULT_SETTINGS, PROGRESS_KEY } from '@shared/progressStore';
export type { DayLog, ProgressState, ProgressStore, Settings, Source, WordHistory, WrongEntry } from '@shared/progressStore';

export const useProgress = createProgressStore(() => syncStorage);

export const exportProgress = () => exportFrom(useProgress);

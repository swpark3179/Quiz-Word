/**
 * 앱: 진행 기록을 기기 안 SQLite(kv-store)에 저장한다.
 * 스토어 로직과 저장 형식은 웹과 같은 공용 코드(src/lib/progressStore.ts)라서 웹에서 내보낸 JSON 을 그대로 가져올 수 있다.
 * 동기 API 를 써서 앱이 켜질 때 기록이 바로 채워진다(로딩 깜빡임 없음).
 * 저장은 0.8초 동안 모아서 한 번에 쓴다 — 판정할 때마다 기록 전체를 직렬화해 쓰면 카드가 넘어가는 순간 끊긴다.
 * 앱이 백그라운드로 가면 남은 것을 바로 쓴다.
 */
import { AppState } from 'react-native';
import { createProgressStore, exportProgress as exportFrom } from '@shared/progressStore';
import { syncStorage } from '@/lib/kv';

export { DEFAULT_SETTINGS, PROGRESS_KEY } from '@shared/progressStore';
export type { DayLog, Notebook, ProgressState, ProgressStore, Settings, Source, WordHistory, WrongEntry } from '@shared/progressStore';

export const useProgress = createProgressStore(() => syncStorage, { writeDelayMs: 800 });

AppState.addEventListener('change', (state) => {
  if (state !== 'active') useProgress.flush();
});

export const exportProgress = () => exportFrom(useProgress);

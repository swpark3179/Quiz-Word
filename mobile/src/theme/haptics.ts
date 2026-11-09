/** 진동 매핑 — 모든 판정에 촉각 피드백을 준다 */
import * as Haptics from 'expo-haptics';

const safe = (p: Promise<void>) => p.catch(() => undefined);

export const haptic = {
  /** 칩·탭 선택 */
  select: () => safe(Haptics.selectionAsync()),
  /** 스와이프가 판정 임계점을 넘는 순간 */
  threshold: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** 안다·정답 */
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** 모른다 */
  warning: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** 오답 */
  error: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** 세션 완료 */
  done: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
};

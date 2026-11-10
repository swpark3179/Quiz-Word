/**
 * 다음 화면 프레임이 그려진 뒤에 실행한다 — 카드가 넘어가는 애니메이션이 시작되는 프레임에
 * 진행 기록 갱신(SRS 계산·스토어 알림) 같은 일을 겹치지 않게 한다.
 */
export function afterFrame(fn: () => void): void {
  requestAnimationFrame(() => setTimeout(fn, 0));
}

/** 플래시카드·객관식 진행 화면이 함께 쓰는 조각 */
import { X } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './Dialog';
import { ProgressBar } from './ui';

/**
 * 그만하기 — 한 장이라도 답했으면 실수로 나가지 않게 한 번 묻는다.
 * (답한 결과는 그때그때 저장되므로 잃는 것은 남은 카드 순서뿐이다)
 * extra: 확인창 설명 아래에 붙일 내용 (플래시카드의 "학습장으로 남기기")
 */
export function useExitGuard(onExit: () => void, hasProgress: boolean, extra?: ReactNode) {
  const [asking, setAsking] = useState(false);
  const requestExit = useCallback(() => {
    if (hasProgress) setAsking(true);
    else onExit();
  }, [hasProgress, onExit]);
  const dialog = (
    <ConfirmDialog
      open={asking}
      title="학습을 그만할까요?"
      desc={
        <>
          지금까지 답한 결과는 저장돼 있어요. 남은 단어는 다음에 다시 나옵니다.
          {extra}
        </>
      }
      confirmLabel="그만하기"
      cancelLabel="계속하기"
      onConfirm={() => {
        setAsking(false);
        onExit();
      }}
      onCancel={() => setAsking(false)}
    />
  );
  return { requestExit, dialog };
}

export function SessionHeader({ onExit, value, max, label }: { onExit: () => void; value: number; max: number; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <button onClick={onExit} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" title="그만하기 (Esc)" aria-label="그만하기">
        <X size={18} />
      </button>
      <ProgressBar value={value} max={max} className="flex-1" />
      <span className="text-[13px] tabular-nums text-muted">{label}</span>
    </div>
  );
}

/**
 * 카드 맨 아래의 "다음" 줄 — 뜻·예문이 길어 카드가 화면보다 길어져도 화면 아래에 붙어 있어
 * 스크롤하지 않고 바로 누를 수 있다. (카드에 overflow-hidden 이 있으면 붙지 않으니 주의)
 */
export function StickyActions({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-surface/95 py-3.5 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

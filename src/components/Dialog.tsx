/** 모달 — 브라우저 기본 <dialog> 를 써서 포커스 가두기·Esc 닫기·뒤 화면 막기를 맡긴다 */
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './ui';

/** 모달이 떠 있는 동안에는 화면 단축키(세션의 1~5, Space 등)를 받지 않게 할 때 쓴다 */
export const isModalOpen = () => !!document.querySelector('dialog[open]');

/** 글자를 입력하는 중인지 — 단축키를 가로채면 안 되는 곳 */
export const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  width,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** CSS 길이 (기본 26rem) */
  width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // 기본 버튼이 정해져 있으면 거기에, 아니면 창 자체에 포커스를 둔다 (닫기 버튼에 테두리가 생기지 않게)
      (el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      tabIndex={-1}
      style={width ? ({ '--modal-width': width } as React.CSSProperties) : undefined}
      aria-label={title}
      onClose={onClose}
      // 바깥(어두운 부분)을 누르면 닫는다
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <div className="p-6">
          <div className="mb-3 flex items-start justify-between gap-4">
            <h2 className="text-[17px] font-bold leading-snug">{title}</h2>
            <button onClick={onClose} aria-label="닫기" className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink">
              <X size={17} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  desc,
  confirmLabel,
  cancelLabel = '취소',
  tone = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  desc?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger 는 되돌릴 수 없는 동작 — 실수로 Enter 를 눌러도 실행되지 않게 취소 쪽에 포커스를 둔다 */
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      {desc && <div className="text-[14px] leading-relaxed text-ink-2">{desc}</div>}
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel} {...(tone === 'danger' ? { 'data-autofocus': true } : {})}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} {...(tone === 'primary' ? { 'data-autofocus': true } : {})}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

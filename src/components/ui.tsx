/** 작은 공용 UI 조각 */
import { Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProgress } from '../store/progress';
import { speak } from '../lib/tts';
import { STATUS_LABEL, type WordStatus } from '../lib/srs';

const POS_STYLE: Record<string, string> = {
  명사: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  동사: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  형용사: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  부사: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  전치사: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  접속사: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  약어: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};
const PHRASE_STYLE = 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300';
const DEFAULT_STYLE = 'bg-surface-3 text-ink-2';

export function PosBadge({ pos, size = 'sm' }: { pos: string; size?: 'xs' | 'sm' }) {
  const style = POS_STYLE[pos] ?? (pos.endsWith('구') ? PHRASE_STYLE : DEFAULT_STYLE);
  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold ${style} ${
        size === 'xs' ? 'px-1.5 py-px text-[10.5px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      {pos}
    </span>
  );
}

export function SpeakButton({ text, size = 18, className = '', label }: { text: string; size?: number; className?: string; label?: string }) {
  const { ttsVoice, ttsRate } = useProgress((s) => s.settings);
  return (
    <button
      type="button"
      title={`발음 듣기${label ? '' : ' (P)'}`}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, { voiceURI: ttsVoice, rate: ttsRate });
      }}
      className={`inline-flex items-center justify-center gap-1 rounded-full text-muted transition hover:bg-primary-soft hover:text-primary active:scale-95 ${
        label ? 'px-2.5 py-1 text-xs font-medium' : 'h-8 w-8'
      } ${className}`}
    >
      <Volume2 size={size} />
      {label}
    </button>
  );
}

const STATUS_STYLE: Record<WordStatus, string> = {
  new: 'bg-surface-3 text-muted',
  learning: 'bg-warning-soft text-warning',
  mastered: 'bg-success-soft text-success',
};

export function StatusBadge({ status }: { status: WordStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function StatusDot({ status }: { status: WordStatus }) {
  const c = status === 'mastered' ? 'bg-success' : status === 'learning' ? 'bg-warning' : 'bg-line';
  return <span title={STATUS_LABEL[status]} className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="text-[13px] font-bold tracking-wide text-muted">{children}</h3>
      {right}
    </div>
  );
}

export function PageHeader({ title, desc, right }: { title: string; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-primary text-white hover:brightness-110 shadow-sm dark:text-[#0e1018]',
  secondary: 'bg-surface border border-line text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-110 dark:text-[#0e1018]',
  success: 'bg-success text-white hover:brightness-110 dark:text-[#0e1018]',
};

export function Button({
  variant = 'secondary',
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${BTN[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">{icon}</div>
      <div className="font-semibold">{title}</div>
      {desc && <p className="mt-1 max-w-sm text-sm text-muted">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

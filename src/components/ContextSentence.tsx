/** 예문 — 단어를 형광펜으로 강조하고 `코드` 를 표시한다 */
import { Fragment, type ReactNode } from 'react';
import type { Context } from '../lib/schema';
import { sourceLabel } from '../data/words';
import { useExamPref } from './ExamPref';
import { SpeakButton } from './ui';

function renderCode(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
      <code key={`${keyPrefix}-${i}`} className="inline">
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
    ),
  );
}

export function Highlighted({ text, surface }: { text: string; surface: string }) {
  if (!surface) return <>{renderCode(text, 'p')}</>;
  const i = text.toLowerCase().indexOf(surface.toLowerCase());
  if (i < 0) return <>{renderCode(text, 'p')}</>;
  return (
    <>
      {renderCode(text.slice(0, i), 'a')}
      <mark className="hl">{text.slice(i, i + surface.length)}</mark>
      {renderCode(text.slice(i + surface.length), 'b')}
    </>
  );
}

export function ContextSentence({
  c,
  showSense = true,
  showKo = true,
  compact = false,
}: {
  c: Context;
  showSense?: boolean;
  showKo?: boolean;
  compact?: boolean;
}) {
  const isKoSentence = /[가-힣]/.test(c.en);
  const pref = useExamPref();
  return (
    <div className={`group rounded-xl border border-line bg-surface-2/60 ${compact ? 'px-3.5 py-3' : 'px-4 py-3.5'}`}>
      {showSense && c.sense && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="font-semibold text-primary-text">{c.sense}</span>
          {c.pos && <span className="text-muted">· {c.pos}</span>}
        </div>
      )}
      <div className="flex items-start gap-1.5">
        <p className={`flex-1 leading-relaxed ${compact ? 'text-[14.5px]' : 'text-[15.5px]'}`}>
          <Highlighted text={c.en} surface={c.surface} />
        </p>
        {!isKoSentence && <SpeakButton text={c.en} size={15} className="-mr-1.5 -mt-1 opacity-60 group-hover:opacity-100" />}
      </div>
      {showKo && c.ko && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{renderCode(c.ko, 'k')}</p>}
      <div className="mt-2 text-[11.5px] text-muted">{sourceLabel(c, pref)}</div>
    </div>
  );
}

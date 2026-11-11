/** 단어 정보 블록 — 상세 화면·플래시카드 뒷면·퀴즈 해설에서 함께 쓴다 */
import { Lightbulb } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { Word } from '../lib/schema';
import { contextsOf, WORD_BY_SURFACE } from '../data/words';
import { useExamPref } from './ExamPref';
import { ContextSentence } from './ContextSentence';
import { PosBadge, SectionTitle, SpeakButton } from './ui';

export function WordHead({ w, size = 'lg', speakable = true }: { w: Word; size?: 'md' | 'lg' | 'xl'; speakable?: boolean }) {
  const cls = size === 'xl' ? 'text-5xl' : size === 'lg' ? 'text-[34px]' : 'text-2xl';
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className={`${cls} font-bold tracking-tight`}>{w.word}</h2>
        {speakable && <SpeakButton text={w.word} size={size === 'md' ? 17 : 20} />}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {w.ipa && <span className="ipa text-[15px] text-muted">/{w.ipa}/</span>}
        {w.pos.map((p) => (
          <PosBadge key={p} pos={p} />
        ))}
      </div>
    </div>
  );
}

export function SenseList({ w, highlight }: { w: Word; highlight?: string }) {
  if (w.senses.length <= 1 && w.senses[0]?.ko === w.short) return null;
  return (
    <ol className="space-y-1.5">
      {w.senses.map((s, i) => (
        <li key={i} className="flex items-baseline gap-2.5 text-[15px]">
          <span className="w-4 shrink-0 text-right text-xs font-bold text-muted">{i + 1}</span>
          <span className={highlight === s.ko ? 'font-semibold text-primary-text' : 'text-ink'}>{s.ko}</span>
          <PosBadge pos={s.pos} size="xs" />
        </li>
      ))}
    </ol>
  );
}

/** 문제 속 뜻 — 뜻별로 예문을 묶는다 */
export function ContextsBySense({ w, limit = 4, compact = false }: { w: Word; limit?: number; compact?: boolean }) {
  const pref = useExamPref();
  const contexts = contextsOf(w, limit, pref);
  if (!contexts.length) return <p className="text-sm text-muted">문제에 나온 예문이 없습니다.</p>;
  return (
    <div className="space-y-2.5">
      {contexts.map((c, i) => (
        <ContextSentence key={i} c={c} compact={compact} showSense={!c.auto} />
      ))}
    </div>
  );
}

/**
 * 외우기 — 어원 조각(de- + fer) → 어원으로 그린 장면, 어원 출처, 발음 연상, 같은 어근 단어.
 * linkFamily: 같은 어근 단어가 단어장에 있으면 상세로 잇는다 (플래시카드 안에서는 세션을 지키려고 끈다)
 */
export function MemoryAid({ w, linkFamily = false }: { w: Word; linkFamily?: boolean }) {
  const m = w.memory;
  if (!m) return null;
  const hasEtym = !!(m.roots?.length || m.story || m.origin);
  return (
    <div className="space-y-3 rounded-2xl bg-surface-2 px-4 py-3.5">
      {hasEtym && (
        <div className="space-y-2">
          {!!m.roots?.length && (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="어원 조각">
              {m.roots.map((r, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <span className="text-[13px] text-muted" aria-hidden>
                      +
                    </span>
                  )}
                  <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-surface px-2 py-1 ring-1 ring-line">
                    <span lang="en" className="text-[14px] font-bold text-primary-text">
                      {r.part}
                    </span>
                    <span className="text-[12.5px] text-ink-2">{r.ko}</span>
                  </span>
                </Fragment>
              ))}
            </div>
          )}
          {m.story && <p className="break-keep text-[15px] leading-relaxed text-ink">{m.story}</p>}
          {m.origin && <p className="text-[12.5px] text-muted">{m.origin}</p>}
        </div>
      )}
      {m.hook && (
        <p className={`flex items-start gap-2 break-keep text-[14.5px] leading-relaxed text-ink ${hasEtym ? 'border-t border-line pt-3' : ''}`}>
          <Lightbulb size={16} className="mt-[3px] shrink-0 text-warning" aria-hidden />
          <span>
            <span className="sr-only">발음 연상: </span>
            {m.hook}
          </span>
        </p>
      )}
      {!!m.family?.length && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[12px] font-semibold text-muted">같은 어근</span>
          {m.family.map((f) => {
            const target = linkFamily ? WORD_BY_SURFACE.get(f.toLowerCase()) : undefined;
            return target && target.id !== w.id ? (
              <Link key={f} to={`/word/${target.id}`} lang="en" className="rounded-md bg-primary-soft px-2 py-0.5 text-[13px] font-medium text-primary-text hover:underline">
                {f}
              </Link>
            ) : (
              <span key={f} lang="en" className="rounded-md bg-surface px-2 py-0.5 text-[13px] text-ink-2 ring-1 ring-line">
                {f}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 뜻 요약 (+ 외우기) + 문제 속 뜻 — 플래시카드 뒷면, 퀴즈 해설 */
export function WordBrief({
  w,
  contextLimit = 2,
  highlightSense,
  memory = false,
}: {
  w: Word;
  contextLimit?: number;
  highlightSense?: string;
  /** 어원·연상을 뜻 바로 아래에 보여 준다 (플래시카드) */
  memory?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[22px] font-bold leading-snug text-primary-text">{w.short}</div>
        {w.senses.length <= 1 && w.meaning !== w.short && <div className="mt-1 text-[14px] leading-relaxed text-ink-2">{w.meaning}</div>}
      </div>
      {w.senses.length > 1 && (
        <div>
          <SectionTitle>뜻</SectionTitle>
          <SenseList w={w} highlight={highlightSense} />
        </div>
      )}
      {memory && w.memory && (
        <div>
          <SectionTitle>외우기</SectionTitle>
          <MemoryAid w={w} />
        </div>
      )}
      <div>
        <SectionTitle>문제 속 쓰임</SectionTitle>
        <ContextsBySense w={w} limit={contextLimit} compact />
      </div>
    </div>
  );
}

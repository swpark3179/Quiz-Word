/** 단어 정보 블록 — 상세 화면·플래시카드 뒷면·퀴즈 해설에서 함께 쓴다 */
import type { Word } from '../lib/schema';
import { contextsOf } from '../data/words';
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
  const contexts = contextsOf(w, limit);
  if (!contexts.length) return <p className="text-sm text-muted">문제에 나온 예문이 없습니다.</p>;
  return (
    <div className="space-y-2.5">
      {contexts.map((c, i) => (
        <ContextSentence key={i} c={c} compact={compact} showSense={w.contexts.length > 0} />
      ))}
    </div>
  );
}

/** 뜻 요약 + 문제 속 뜻 — 플래시카드 뒷면, 퀴즈 해설 */
export function WordBrief({ w, contextLimit = 2, highlightSense }: { w: Word; contextLimit?: number; highlightSense?: string }) {
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
      <div>
        <SectionTitle>문제 속 쓰임</SectionTitle>
        <ContextsBySense w={w} limit={contextLimit} compact />
      </div>
    </div>
  );
}

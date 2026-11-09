/** 단어장 — 검색·필터·목록 */
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PosBadge, StatusDot } from '../components/ui';
import { QUIZ_SOURCES, WORDS } from '../data/words';
import { searchWords } from '../lib/search';
import { statusOf, type WordStatus } from '../lib/srs';
import { useProgress } from '../store/progress';

const POS_FILTERS = ['명사', '동사', '형용사', '부사', '구'];

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border px-2.5 py-1.5 text-[13px] outline-none transition ${
        value ? 'border-primary bg-primary-soft text-primary-text' : 'border-line bg-surface text-ink-2'
      }`}
    >
      {children}
    </select>
  );
}

export function WordsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') ?? '';
  const src = params.get('src') ?? '';
  const pos = params.get('pos') ?? '';
  const status = (params.get('status') ?? '') as WordStatus | 'wrong' | '';
  const tier = params.get('tier') ?? '';
  const inputRef = useRef<HTMLInputElement>(null);
  const cards = useProgress((s) => s.cards);
  const wrong = useProgress((s) => s.wrong);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete('focus');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [params.get('focus')]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    let base = WORDS;
    if (src) base = base.filter((w) => w.sources.includes(src));
    if (pos) base = base.filter((w) => (pos === '구' ? w.pos.some((p) => p.endsWith('구')) : w.pos.includes(pos)));
    if (tier) base = base.filter((w) => (tier === 'basic' ? w.basic : w.tier === tier && !w.basic));
    if (status === 'wrong') base = base.filter((w) => wrong[w.id]);
    else if (status) base = base.filter((w) => statusOf(cards[w.id]) === status);
    const found = searchWords(base, q);
    return q ? found : [...found].sort((a, b) => b.freq - a.freq || a.word.localeCompare(b.word));
  }, [q, src, pos, tier, status, cards, wrong]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 12,
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && list[0]) navigate(`/word/${list[0].id}`);
    if (e.key === 'Escape') setParam('q', '');
  };

  const filtersOn = !!(src || pos || status || tier);

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col md:h-[calc(100vh-5rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">단어장</h1>
        <p className="mt-1 text-sm text-muted">영어 단어나 한글 뜻으로 찾아보세요. Enter 를 누르면 첫 번째 단어를 엽니다.</p>
      </div>

      <div className="relative mb-3">
        <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="escalate, 해결하다 …"
          className="w-full rounded-2xl border border-line bg-surface py-3.5 pl-12 pr-11 text-[16px] shadow-card outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        {q && (
          <button
            onClick={() => setParam('q', '')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-surface-2"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterSelect value={src} onChange={(v) => setParam('src', v)}>
          <option value="">모든 문제 파일</option>
          {QUIZ_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={pos} onChange={(v) => setParam('pos', v)}>
          <option value="">모든 품사</option>
          {POS_FILTERS.map((p) => (
            <option key={p} value={p}>
              {p === '구' ? '구(여러 단어)' : p}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={status} onChange={(v) => setParam('status', v)}>
          <option value="">모든 상태</option>
          <option value="new">새 단어</option>
          <option value="learning">학습 중</option>
          <option value="mastered">익힘</option>
          <option value="wrong">오답노트</option>
        </FilterSelect>
        <FilterSelect value={tier} onChange={(v) => setParam('tier', v)}>
          <option value="">핵심 + 확장</option>
          <option value="core">핵심 (CCAR-F)</option>
          <option value="extra">확장 (다른 회차)</option>
          <option value="basic">기초 단어</option>
        </FilterSelect>
        {filtersOn && (
          <button
            onClick={() => setParams(q ? { q } : {}, { replace: true })}
            className="text-[13px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            필터 초기화
          </button>
        )}
        <span className="ml-auto text-[13px] text-muted">{list.length.toLocaleString()}개</span>
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line bg-surface shadow-card">
        {list.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">찾는 단어가 없습니다.</div>
        ) : (
          <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
            {virtual.getVirtualItems().map((row) => {
              const w = list[row.index];
              const st = statusOf(cards[w.id]);
              return (
                <button
                  key={w.id}
                  onClick={() => navigate(`/word/${w.id}`)}
                  className="absolute left-0 top-0 flex w-full items-center gap-3.5 border-b border-line px-5 text-left transition last:border-0 hover:bg-surface-2"
                  style={{ height: row.size, transform: `translateY(${row.start}px)` }}
                >
                  <StatusDot status={st} />
                  <div className="w-44 shrink-0 truncate sm:w-52">
                    <span className="text-[15.5px] font-semibold">{w.word}</span>
                    {w.ipa && <span className="ipa ml-2 hidden text-[12.5px] text-muted lg:inline">/{w.ipa}/</span>}
                  </div>
                  <div className="hidden w-16 shrink-0 sm:block">
                    {w.pos[0] && <PosBadge pos={w.pos[0]} size="xs" />}
                  </div>
                  <div className="min-w-0 flex-1 truncate text-[14px] text-ink-2">{w.short}</div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {wrong[w.id] && <span className="rounded-full bg-danger-soft px-1.5 py-px text-[10.5px] font-bold text-danger">오답</span>}
                    {w.tier === 'extra' && <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-semibold text-muted">확장</span>}
                    {w.freq > 0 && <span className="w-10 text-right text-[11.5px] tabular-nums text-muted">{w.freq}회</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

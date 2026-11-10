/** 단어장 — 검색·필터·목록 */
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, SearchX, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { Button, Kbd, PosBadge, StatusDot } from '../components/ui';
import { QUIZ_SOURCES, WORDS_BY_FREQ } from '../data/words';
import { searchWords } from '../lib/search';
import { statusOf, type WordStatus } from '../lib/srs';
import { useProgress } from '../store/progress';
import { savedListOffset, saveListView, setWordNav } from './wordNav';

const ROW_HEIGHT = 64;
const POS_FILTERS = ['명사', '동사', '형용사', '부사', '구'];

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`max-w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none transition ${
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
  const urlQ = params.get('q') ?? '';
  const src = params.get('src') ?? '';
  const pos = params.get('pos') ?? '';
  const status = (params.get('status') ?? '') as WordStatus | 'wrong' | '';
  const tier = params.get('tier') ?? '';
  const inputRef = useRef<HTMLInputElement>(null);
  const cards = useProgress((s) => s.cards);
  const wrong = useProgress((s) => s.wrong);
  const navType = useNavigationType();
  /** ↑↓ 로 고른 줄 — Enter 를 누르면 이 단어를 연다 */
  const [active, setActive] = useState(0);
  const [moved, setMoved] = useState(false);

  /**
   * 검색어는 화면 상태(q)로 바로 반영하고 주소에는 잠깐 뒤에 적는다.
   * 주소가 바뀌는 것은 한 박자 늦게 반영되므로, 입력칸을 주소에 직접 묶으면 빠르게 칠 때 글자가 빠진다.
   */
  const [q, setQ] = useState(urlQ);
  /** 마지막으로 주소에 적은 검색어 — 주소가 이것과 다르면 밖에서 바뀐 것(뒤로 가기, 다른 화면의 링크) */
  const written = useRef(urlQ);
  const writeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (urlQ !== written.current) {
      written.current = urlQ;
      setQ(urlQ);
    }
  }, [urlQ]);

  /** 주소의 조건을 바꾼다 — 검색어는 항상 지금 화면의 값으로 맞춘다 */
  const writeParams = (change?: (p: URLSearchParams) => void, query = q) => {
    clearTimeout(writeTimer.current);
    const next = new URLSearchParams(params);
    next.delete('focus');
    if (query) next.set('q', query);
    else next.delete('q');
    change?.(next);
    written.current = query;
    setParams(next, { replace: true });
  };
  const writeLatest = useRef(writeParams);
  writeLatest.current = writeParams;
  useEffect(() => () => clearTimeout(writeTimer.current), []);

  const setQuery = (value: string) => {
    setQ(value);
    clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => writeLatest.current(undefined, value), 250);
  };
  const setParam = (k: string, v: string) => writeParams((p) => (v ? p.set(k, v) : p.delete(k)));
  const resetFilters = () => writeParams((p) => ['src', 'pos', 'status', 'tier'].forEach((k) => p.delete(k)));
  const clearQuery = () => {
    setQ('');
    writeParams(undefined, '');
    inputRef.current?.focus();
  };

  /** 검색·필터 조건 — 보던 위치를 되살릴 때 조건이 같은지 확인하는 데 쓴다 */
  const viewKey = [q, src, pos, status, tier].join('|');

  // 들어오면 바로 입력할 수 있게 검색창에 포커스를 둔다.
  // 터치 기기에서는 화면 키보드가 목록을 가리므로 검색을 누르고 들어왔을 때(focus=1)만 한다.
  useEffect(() => {
    if (params.get('focus') || window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
  }, [params.get('focus')]); // eslint-disable-line react-hooks/exhaustive-deps

  // 학습 상태로 거를 때만 진행 기록이 목록에 영향을 준다 (그 밖에는 기록이 바뀌어도 목록을 다시 만들지 않는다)
  const statusData = status === 'wrong' ? wrong : status ? cards : null;
  const list = useMemo(() => {
    let base = WORDS_BY_FREQ;
    if (src) base = base.filter((w) => w.sources.includes(src));
    if (pos) base = base.filter((w) => (pos === '구' ? w.pos.some((p) => p.endsWith('구')) : w.pos.includes(pos)));
    if (tier) base = base.filter((w) => (tier === 'basic' ? w.basic : w.tier === tier && !w.basic));
    if (status === 'wrong') base = base.filter((w) => wrong[w.id]);
    else if (status) base = base.filter((w) => statusOf(cards[w.id]) === status);
    return q.trim() ? searchWords(base, q) : base;
  }, [q, src, pos, tier, status, statusData]); // eslint-disable-line react-hooks/exhaustive-deps

  const parentRef = useRef<HTMLDivElement>(null);
  // 단어 상세에서 뒤로 돌아왔으면 보던 위치에서 이어서 본다
  const [restoreOffset] = useState(() => (navType === 'POP' ? savedListOffset(viewKey) : 0));
  const virtual = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    initialOffset: restoreOffset,
  });

  useLayoutEffect(() => {
    if (restoreOffset && parentRef.current) parentRef.current.scrollTop = restoreOffset;
  }, [restoreOffset]);

  // 떠날 때 지금 조건과 위치를 기억해 둔다.
  // (화면이 사라진 뒤에는 scrollTop 을 읽을 수 없으므로 스크롤할 때마다 적어 둔다)
  const view = useRef({ key: viewKey, offset: restoreOffset });
  view.current.key = viewKey;
  useEffect(() => () => saveListView(view.current.key, view.current.offset), []);

  // 조건이 바뀌면 목록 맨 위부터 다시 고른다
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setActive(0);
    setMoved(false);
    if (parentRef.current) parentRef.current.scrollTop = 0;
  }, [viewKey]);

  const open = (index: number) => {
    const w = list[index];
    if (!w) return;
    // 돌아왔을 때 같은 검색 결과가 나오도록 아직 주소에 적지 않은 검색어를 먼저 적는다
    if (q !== written.current) writeParams();
    setWordNav(
      list.map((x) => x.id),
      '단어장으로',
    );
    navigate(`/word/${w.id}`);
  };

  const move = (to: number) => {
    const next = Math.max(0, Math.min(list.length - 1, to));
    setActive(next);
    setMoved(true);
    virtual.scrollToIndex(next, { align: 'auto' });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // 한글 조합 중의 Enter·화살표는 글자 입력의 일부다
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') open(active);
    else if (e.key === 'Escape') clearQuery();
    else if (e.key === 'ArrowDown') move(active + 1);
    else if (e.key === 'ArrowUp') move(active - 1);
    else if (e.key === 'PageDown') move(active + 8);
    else if (e.key === 'PageUp') move(active - 8);
    else return;
    e.preventDefault();
  };

  const filtersOn = !!(src || pos || status || tier);
  const showActive = moved || q !== '';

  return (
    // 높이 = 화면 − 위아래 여백 (좁은 화면: 위 1.5rem + 하단 탭 6rem · 넓은 화면: 위아래 2.5rem)
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col md:h-[calc(100dvh-5rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">단어장</h1>
        <p className="mt-1 text-sm text-muted">
          영어 단어나 한글 뜻으로 찾아보세요.
          <span className="hidden md:inline">
            {' '}
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> 로 고르고 <Kbd>Enter</Kbd> 로 엽니다.
          </span>
        </p>
      </div>

      <div className="relative mb-3">
        <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="escalate, 해결하다 …"
          aria-label="단어 검색"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-2xl border border-line bg-surface py-3.5 pl-12 pr-11 text-[16px] shadow-card outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        {q && (
          <button
            onClick={clearQuery}
            aria-label="검색어 지우기"
            title="검색어 지우기 (Esc)"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-surface-2"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterSelect label="문제 파일" value={src} onChange={(v) => setParam('src', v)}>
          <option value="">모든 문제 파일</option>
          {QUIZ_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="품사" value={pos} onChange={(v) => setParam('pos', v)}>
          <option value="">모든 품사</option>
          {POS_FILTERS.map((p) => (
            <option key={p} value={p}>
              {p === '구' ? '구(여러 단어)' : p}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="학습 상태" value={status} onChange={(v) => setParam('status', v)}>
          <option value="">모든 상태</option>
          <option value="new">새 단어</option>
          <option value="learning">학습 중</option>
          <option value="mastered">익힘</option>
          <option value="wrong">오답노트</option>
        </FilterSelect>
        <FilterSelect label="단어 범위" value={tier} onChange={(v) => setParam('tier', v)}>
          <option value="">핵심 + 확장</option>
          <option value="core">핵심 (CCAR-F)</option>
          <option value="extra">확장 (다른 회차)</option>
          <option value="basic">기초 단어</option>
        </FilterSelect>
        {filtersOn && (
          <button onClick={resetFilters} className="text-[13px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
            필터 초기화
          </button>
        )}
        <span className="ml-auto text-[13px] tabular-nums text-muted" role="status">
          {list.length.toLocaleString()}개
        </span>
      </div>

      <div
        ref={parentRef}
        onScroll={(e) => {
          view.current.offset = e.currentTarget.scrollTop;
        }}
        className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line bg-surface shadow-card"
      >
        {list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
              <SearchX size={22} />
            </div>
            <div>
              <div className="font-semibold">찾는 단어가 없어요</div>
              <p className="mt-1 text-sm text-muted">
                {q ? `"${q}" 에 맞는 단어가 없습니다.` : '이 조건에 맞는 단어가 없습니다.'}
                {filtersOn && ' 필터를 풀면 더 나올 수 있어요.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {filtersOn && <Button onClick={resetFilters}>필터 초기화</Button>}
              {q && (
                <Button variant="ghost" onClick={clearQuery}>
                  검색어 지우기
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
            {virtual.getVirtualItems().map((row) => {
              const w = list[row.index];
              const st = statusOf(cards[w.id]);
              const isActive = showActive && row.index === active;
              return (
                <button
                  key={w.id}
                  onClick={() => open(row.index)}
                  className={`focus-inset absolute left-0 top-0 flex w-full items-center gap-3.5 border-b border-line px-4 text-left transition-colors last:border-0 hover:bg-surface-2 sm:px-5 ${
                    isActive ? 'bg-primary-soft/60' : ''
                  }`}
                  style={{ height: row.size, transform: `translateY(${row.start}px)` }}
                >
                  <StatusDot status={st} />
                  {/* 좁은 화면에서는 단어와 뜻을 두 줄로, 넓은 화면에서는 한 줄로 */}
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3.5">
                    <div className="truncate sm:w-52 sm:shrink-0">
                      <span className="text-[15.5px] font-semibold">{w.word}</span>
                      {w.ipa && <span className="ipa ml-2 hidden text-[12.5px] text-muted lg:inline">/{w.ipa}/</span>}
                    </div>
                    <div className="hidden w-16 shrink-0 sm:block">{w.pos[0] && <PosBadge pos={w.pos[0]} size="xs" />}</div>
                    <div className="min-w-0 truncate text-[13px] text-ink-2 sm:flex-1 sm:text-[14px]">{w.short}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {wrong[w.id] && <span className="rounded-full bg-danger-soft px-1.5 py-px text-[10.5px] font-bold text-danger">오답</span>}
                    {w.tier === 'extra' && <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-semibold text-muted">확장</span>}
                    {w.freq > 0 && <span className="w-10 text-right text-[11.5px] tabular-nums text-muted">{w.freq}회</span>}
                    {isActive && (
                      <span className="hidden md:inline">
                        <Kbd>Enter</Kbd>
                      </span>
                    )}
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

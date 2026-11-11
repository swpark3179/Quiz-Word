/** 학습장 — 직접 고른 단어만 모아 두고 반복해서 학습한다 */
import { ArrowLeft, BookMarked, Check, CopyPlus, Layers, ListChecks, Merge, Pencil, Plus, Search, SearchX, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog, Dialog } from '../components/Dialog';
import { Button, Card, Empty, Kbd, PageHeader, PosBadge, StatusDot } from '../components/ui';
import { WindowList } from '../components/WindowList';
import { WORD_BY_ID, WORDS } from '../data/words';
import {
  cleanNotebookName,
  defaultNotebookName,
  mergedNotebookName,
  mergeNotebookIds,
  NOTEBOOK_NAME_MAX,
  wrongIdsByCount,
  wrongNotebookName,
  type Notebook,
} from '../lib/notebook';
import type { Word } from '../lib/schema';
import { notebookScope, scopeToParams } from '../lib/scope';
import { searchWords } from '../lib/search';
import { statusOf } from '../lib/srs';
import { timeAgo } from '../lib/text';
import { useProgress } from '../store/progress';
import { setWordNav } from './wordNav';

/** 검색 결과로 보여 줄 개수 */
const RESULT_LIMIT = 8;

const flashHref = (id: string) => `/flash/play?${scopeToParams(notebookScope(id))}`;
const quizHref = (id: string) => `/quiz/play?${scopeToParams(notebookScope(id))}&mode=meaning`;

/** 학습장 단어 중 지금 단어 데이터에 있는 것만 (단어 id 가 바뀌어 사라진 단어는 뺀다) */
const knownIds = (ids: string[]) => ids.filter((id) => WORD_BY_ID.has(id));

/** 이름 입력 창 — 열 때마다 initial 로 새로 시작한다 */
function NameDialog({
  open,
  title,
  initial,
  confirmLabel,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: string;
  confirmLabel: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <NameForm initial={initial} confirmLabel={confirmLabel} onCancel={onCancel} onSubmit={onSubmit} />
    </Dialog>
  );
}

function NameForm({ initial, confirmLabel, onCancel, onSubmit }: { initial: string; confirmLabel: string; onCancel: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(cleanNotebookName(name, initial));
      }}
    >
      <input
        data-autofocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        maxLength={NOTEBOOK_NAME_MAX}
        aria-label="학습장 이름"
        autoComplete="off"
        className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel}>취소</Button>
        <Button type="submit" variant="primary">
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}

/* ───── 학습장 합치기 ───── */

/** 둘 이상의 학습장을 골라 단어 합집합으로 새 학습장을 만든다 — 열 때마다 새로 시작한다 */
function MergeDialog({ open, notebooks, onCancel, onMerged }: { open: boolean; notebooks: Notebook[]; onCancel: () => void; onMerged: (id: string) => void }) {
  return (
    <Dialog open={open} onClose={onCancel} title="학습장 합치기" width="32rem">
      <MergeForm notebooks={notebooks} onCancel={onCancel} onMerged={onMerged} />
    </Dialog>
  );
}

function MergeForm({ notebooks, onCancel, onMerged }: { notebooks: Notebook[]; onCancel: () => void; onMerged: (id: string) => void }) {
  const mergeNotebooks = useProgress((s) => s.mergeNotebooks);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  /** 직접 고친 이름 — 고치기 전까지는 고른 학습장에 맞춘 기본 이름을 따라간다 */
  const [typed, setTyped] = useState<string | null>(null);
  const [removeSources, setRemoveSources] = useState(false);

  // 학습장 목록 순서대로 — 스토어가 합치는 순서와 같다
  const sources = useMemo(() => notebooks.filter((n) => picked.has(n.id)), [notebooks, picked]);
  const suggested = mergedNotebookName(sources);
  const { total, overlap } = useMemo(() => {
    const total = knownIds(mergeNotebookIds(sources)).length;
    return { total, overlap: sources.reduce((sum, n) => sum + knownIds(n.ids).length, 0) - total };
  }, [sources]);
  const ready = sources.length >= 2;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const id = mergeNotebooks(
          sources.map((n) => n.id),
          cleanNotebookName(typed ?? suggested, suggested),
          { deleteSources: removeSources },
        );
        if (id) onMerged(id);
      }}
    >
      <p className="text-[14px] leading-relaxed text-ink-2">고른 학습장의 단어를 겹치지 않게 모아 새 학습장을 만들어요.</p>

      <fieldset className="mt-4">
        <legend className="mb-2 text-[13px] font-bold text-ink">
          합칠 학습장 <span className="font-medium text-muted">· 2개 이상</span>
        </legend>
        <div className="max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {notebooks.map((nb) => {
            const on = picked.has(nb.id);
            return (
              <label key={nb.id} className={`flex cursor-pointer items-center gap-3 px-3.5 py-2.5 ${on ? 'bg-primary-soft/50' : 'hover:bg-surface-2/60'}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(nb.id)} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{nb.name}</span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-muted">{knownIds(nb.ids).length}개</span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 min-h-5 text-[12.5px] text-muted" role="status">
          {ready ? (
            <>
              합치면 단어 <b className="font-semibold text-ink">{total}</b>개{overlap > 0 && ` · 겹치는 단어 ${overlap}개는 한 번만 담아요`}
            </>
          ) : (
            `${2 - sources.length}개 더 고르세요`
          )}
        </p>
      </fieldset>

      <label className="mt-3 block">
        <span className="mb-2 block text-[13px] font-bold text-ink">새 학습장 이름</span>
        <input
          value={typed ?? (sources.length ? suggested : '')}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={suggested}
          maxLength={NOTEBOOK_NAME_MAX}
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] font-bold text-ink">기존 학습장</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([false, true] as const).map((del) => {
            const on = removeSources === del;
            return (
              <label
                key={String(del)}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
                  on ? (del ? 'border-danger bg-danger-soft/60' : 'border-primary bg-primary-soft/50') : 'border-line hover:bg-surface-2/60'
                }`}
              >
                <input type="radio" name="merge-sources" checked={on} onChange={() => setRemoveSources(del)} className={`mt-1 shrink-0 ${del ? 'accent-[var(--danger)]' : 'accent-[var(--primary)]'}`} />
                <span>
                  <span className="block text-[14px] font-semibold">{del ? '삭제하기' : '남겨두기'}</span>
                  <span className="block text-[12.5px] leading-snug text-muted">{del ? '합친 뒤 고른 학습장은 지워요' : '고른 학습장은 그대로 둬요'}</span>
                </span>
              </label>
            );
          })}
        </div>
        {removeSources && (
          <p className="mt-2 text-[12.5px] leading-snug text-danger">
            {sources.length ? `고른 ${sources.length}개 학습장이 지워집니다.` : '고른 학습장이 지워집니다.'} 단어는 모두 새 학습장에 담기고, 학습 기록(복습 일정·오답노트)은 그대로 남아요.
          </p>
        )}
      </fieldset>

      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel}>취소</Button>
        <Button type="submit" variant={removeSources ? 'danger' : 'primary'} disabled={!ready}>
          <Merge size={16} /> {removeSources && ready ? `합치고 기존 ${sources.length}개 삭제` : '합치기'}
        </Button>
      </div>
    </form>
  );
}

/* ───── 학습장 목록 ───── */

export function NotebooksPage() {
  const notebooks = useProgress((s) => s.notebooks);
  const wrong = useProgress((s) => s.wrong);
  const createNotebook = useProgress((s) => s.createNotebook);
  const navigate = useNavigate();
  const [naming, setNaming] = useState(false);
  const [merging, setMerging] = useState(false);

  // 오답노트 화면의 기본 순서(많이 틀린 순)대로 담는다
  const wrongIds = useMemo(() => wrongIdsByCount(wrong, (id) => WORD_BY_ID.has(id)), [wrong]);

  const create = (name: string) => {
    setNaming(false);
    navigate(`/notebooks/${createNotebook(name)}`);
  };
  const fromWrong = () => navigate(`/notebooks/${createNotebook(wrongNotebookName(), wrongIds)}`);

  const actions = (
    <div className="flex flex-wrap gap-2">
      {notebooks.length >= 2 && (
        <Button onClick={() => setMerging(true)} title="둘 이상의 학습장을 겹치는 단어 없이 하나로">
          <Merge size={16} /> 학습장 합치기
        </Button>
      )}
      <Button onClick={fromWrong} disabled={!wrongIds.length} title={wrongIds.length ? undefined : '오답노트가 비어 있어요'}>
        <CopyPlus size={16} /> 오답노트로 만들기{wrongIds.length > 0 && ` (${wrongIds.length})`}
      </Button>
      <Button variant="primary" onClick={() => setNaming(true)}>
        <Plus size={16} /> 새 학습장
      </Button>
    </div>
  );

  return (
    <div className="anim-fade">
      <PageHeader
        title="학습장"
        desc="직접 고른 단어만 모아 두고 반복해서 학습해요. 빈 학습장에 단어장을 검색해 담거나, 지금 오답노트를 통째로 옮겨 시작할 수 있어요. 여러 학습장은 하나로 합칠 수 있어요."
        right={notebooks.length > 0 && actions}
      />

      {notebooks.length === 0 ? (
        <Empty
          icon={<BookMarked size={22} />}
          title="아직 학습장이 없어요"
          desc="시험 직전에 볼 단어, 자꾸 헷갈리는 단어처럼 따로 모아 볼 단어 묶음을 만들어 보세요."
          action={actions}
        />
      ) : (
        <Card className="divide-y divide-line">
          {notebooks.map((nb) => {
            const n = knownIds(nb.ids).length;
            return (
              <div key={nb.id} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-surface-2/60 sm:flex-nowrap">
                {/* 좁은 화면에서는 바로가기 버튼을 이름 아래 줄로 내린다 */}
                <Link to={`/notebooks/${nb.id}`} className="flex min-w-0 basis-full items-center gap-3.5 sm:basis-auto sm:flex-1">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <BookMarked size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15.5px] font-semibold">{nb.name}</span>
                    <span className="block text-[12.5px] text-muted">
                      <b className="font-semibold text-ink-2">{n}</b>개 단어 · {timeAgo(nb.updatedAt)} 수정
                    </span>
                  </span>
                </Link>
                <div className="flex shrink-0 gap-1.5 pl-[3.375rem] sm:pl-0">
                  <Button className="px-3 py-2 text-[13px]" disabled={!n} onClick={() => navigate(flashHref(nb.id))}>
                    <Layers size={15} /> 플래시카드
                  </Button>
                  <Button className="px-3 py-2 text-[13px]" disabled={!n} onClick={() => navigate(quizHref(nb.id))}>
                    <ListChecks size={15} /> 객관식
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <NameDialog
        open={naming}
        title="새 학습장"
        initial={defaultNotebookName(notebooks)}
        confirmLabel="만들기"
        onCancel={() => setNaming(false)}
        onSubmit={create}
      />
      <MergeDialog
        open={merging}
        notebooks={notebooks}
        onCancel={() => setMerging(false)}
        onMerged={(id) => {
          setMerging(false);
          navigate(`/notebooks/${id}`);
        }}
      />
    </div>
  );
}

/* ───── 학습장 하나 ───── */

export function NotebookDetail() {
  const { id = '' } = useParams();
  const nb = useProgress((s) => s.notebooks.find((n) => n.id === id));
  const cards = useProgress((s) => s.cards);
  const wrong = useProgress((s) => s.wrong);
  const addToNotebook = useProgress((s) => s.addToNotebook);
  const removeFromNotebook = useProgress((s) => s.removeFromNotebook);
  const renameNotebook = useProgress((s) => s.renameNotebook);
  const deleteNotebook = useProgress((s) => s.deleteNotebook);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  /** ↑↓ 로 고른 검색 결과 — Enter 를 누르면 이 단어를 담는다 */
  const [active, setActive] = useState(0);
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const [message, setMessage] = useState('');

  const words = useMemo(() => knownIds(nb?.ids ?? []).map((x) => WORD_BY_ID.get(x)!), [nb]);
  const inBook = useMemo(() => new Set(nb?.ids ?? []), [nb]);
  const results = useMemo(() => (q.trim() ? searchWords(WORDS, q).slice(0, RESULT_LIMIT) : []), [q]);

  useEffect(() => {
    if (nb) document.title = `${nb.name} · 학습장 · Quiz Word`;
  }, [nb?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // 들어오면 바로 단어를 칠 수 있게 — 터치 기기에서는 화면 키보드가 목록을 가리므로 학습장이 비었을 때만
  useEffect(() => {
    if (nb && (nb.ids.length === 0 || window.matchMedia('(pointer: fine)').matches)) inputRef.current?.focus();
  }, [nb?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!nb) {
    return (
      <Empty
        icon={<BookMarked size={22} />}
        title="학습장을 찾을 수 없어요"
        desc="지워졌거나 다른 기기에서 만든 학습장이에요."
        action={<Button onClick={() => navigate('/notebooks', { replace: true })}>학습장 목록으로</Button>}
      />
    );
  }

  const setQuery = (v: string) => {
    setQ(v);
    setActive(0);
  };

  const add = (w: Word) => {
    addToNotebook(nb.id, w.id);
    setMessage(`담았어요 · ${w.word}`);
  };

  const toggle = (w: Word) => {
    if (inBook.has(w.id)) {
      removeFromNotebook(nb.id, w.id);
      setMessage(`뺐어요 · ${w.word}`);
    } else add(w);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // 한글 조합 중의 Enter·화살표는 글자 입력의 일부다
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      const w = results[active];
      if (!w) return;
      if (inBook.has(w.id)) setMessage(`이미 담겨 있어요 · ${w.word}`);
      else add(w);
      // 바로 다음 단어를 칠 수 있게 검색어를 비운다
      setQuery('');
    } else if (e.key === 'Escape') {
      if (!q) return;
      setQuery('');
    } else if (e.key === 'ArrowDown') setActive((i) => Math.min(results.length - 1, i + 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
    else return;
    e.preventDefault();
  };

  const openWord = (wordId: string) => {
    setWordNav(
      words.map((w) => w.id),
      '학습장으로',
    );
    navigate(`/word/${wordId}`);
  };

  return (
    <div className="anim-fade">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/notebooks" className="flex items-center gap-1.5 rounded-lg py-1 pr-2 text-[13px] font-medium text-muted hover:text-ink">
          <ArrowLeft size={16} /> 학습장 목록
        </Link>
        <div className="flex gap-1">
          <Button variant="ghost" className="px-2.5 py-1.5 text-[13px]" onClick={() => setDialog('rename')}>
            <Pencil size={14} /> 이름 바꾸기
          </Button>
          <Button variant="ghost" className="px-2.5 py-1.5 text-[13px] text-danger" onClick={() => setDialog('delete')}>
            <Trash2 size={14} /> 학습장 삭제
          </Button>
        </div>
      </div>

      <PageHeader
        title={nb.name}
        desc={`${words.length}개 단어 · ${timeAgo(nb.updatedAt)} 수정`}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!words.length} onClick={() => navigate(flashHref(nb.id))}>
              <Layers size={16} /> 플래시카드
            </Button>
            <Button disabled={!words.length} onClick={() => navigate(quizHref(nb.id))}>
              <ListChecks size={16} /> 객관식
            </Button>
          </div>
        }
      />

      {/* 단어장에서 검색해 담기 */}
      <div className="relative mb-2">
        <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          data-search-focus
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="담을 단어 검색 — escalate, 해결하다 …"
          aria-label="학습장에 담을 단어 검색"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-2xl border border-line bg-surface py-3.5 pl-12 pr-11 text-[16px] shadow-card outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        {q && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="검색어 지우기"
            title="검색어 지우기 (Esc)"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-surface-2"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <p className="mb-4 min-h-5 px-1 text-[12.5px] text-muted" role="status">
        {message ? (
          <span className="font-medium text-primary">{message}</span>
        ) : (
          <span className="hidden md:inline">
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> 로 고르고 <Kbd>Enter</Kbd> 로 담아요. 담으면 검색어가 지워져 바로 다음 단어를 칠 수 있어요.
          </span>
        )}
      </p>

      {q.trim() && (
        <Card className="anim-fade mb-5 overflow-hidden">
          {results.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-[14px] text-muted">
              <SearchX size={18} /> "{q}" 에 맞는 단어가 없어요.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {results.map((w, i) => {
                const added = inBook.has(w.id);
                return (
                  <div
                    key={w.id}
                    onMouseEnter={() => setActive(i)}
                    className={`flex items-center gap-3.5 px-4 py-2.5 sm:px-5 ${i === active ? 'bg-primary-soft/60' : ''}`}
                  >
                    <StatusDot status={statusOf(cards[w.id])} />
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3.5">
                      <div className="truncate sm:w-52 sm:shrink-0">
                        <span className="text-[15px] font-semibold">{w.word}</span>
                      </div>
                      <div className="hidden w-16 shrink-0 sm:block">{w.pos[0] && <PosBadge pos={w.pos[0]} size="xs" />}</div>
                      <div className="min-w-0 truncate text-[13px] text-ink-2 sm:flex-1 sm:text-[14px]">{w.short}</div>
                    </div>
                    {i === active && !added && (
                      <span className="hidden md:inline">
                        <Kbd>Enter</Kbd>
                      </span>
                    )}
                    <button
                      onClick={() => toggle(w)}
                      title={added ? '학습장에서 빼기' : '학습장에 담기'}
                      aria-label={added ? `${w.word} 학습장에서 빼기` : `${w.word} 학습장에 담기`}
                      className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition ${
                        added ? 'bg-success-soft text-success hover:bg-danger-soft hover:text-danger' : 'bg-primary-soft text-primary-text hover:brightness-95'
                      }`}
                    >
                      {added ? <Check size={14} /> : <Plus size={14} />} {added ? '담김' : '담기'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {words.length === 0 ? (
        <Empty icon={<Search size={22} />} title="아직 담은 단어가 없어요" desc="위 검색창에서 단어를 찾아 담아 보세요. 영어 단어나 한글 뜻 모두 찾을 수 있어요." />
      ) : (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[13px] text-muted">
            <span>{words.length}개 단어</span>
            <span>최근에 담은 순</span>
          </div>
          {/* 수백 단어 학습장도 보이는 줄만 그린다 */}
          <WindowList
            items={words}
            getKey={(w) => w.id}
            estimateSize={58}
            renderRow={(w) => (
              <div className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2/60">
                <button onClick={() => openWord(w.id)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                  <StatusDot status={statusOf(cards[w.id])} />
                  <span className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
                    <span className="block truncate text-[15.5px] font-semibold sm:w-44 sm:shrink-0">{w.word}</span>
                    <span className="hidden w-16 shrink-0 sm:block">{w.pos[0] && <PosBadge pos={w.pos[0]} size="xs" />}</span>
                    <span className="block min-w-0 truncate text-[13px] text-ink-2 sm:flex-1 sm:text-[14px]">{w.short}</span>
                  </span>
                </button>
                {wrong[w.id] && <span className="hidden shrink-0 rounded-full bg-danger-soft px-1.5 py-px text-[10.5px] font-bold text-danger sm:inline">오답</span>}
                {/* 빠르게 정리할 수 있게 묻지 않고 바로 뺀다 */}
                <button
                  onClick={() => {
                    removeFromNotebook(nb.id, w.id);
                    setMessage(`뺐어요 · ${w.word}`);
                  }}
                  title="학습장에서 빼기"
                  aria-label={`${w.word} 학습장에서 빼기`}
                  className="shrink-0 rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
        </Card>
      )}

      <NameDialog
        open={dialog === 'rename'}
        title="학습장 이름 바꾸기"
        initial={nb.name}
        confirmLabel="바꾸기"
        onCancel={() => setDialog(null)}
        onSubmit={(name) => {
          renameNotebook(nb.id, name);
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        tone="danger"
        title="학습장을 삭제할까요?"
        desc={
          <>
            <b className="text-ink">{nb.name}</b> ({words.length}개 단어)을 지웁니다. 단어의 학습 기록(복습 일정·오답노트)은 그대로 남습니다.
          </>
        }
        confirmLabel="삭제"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          deleteNotebook(nb.id);
          navigate('/notebooks', { replace: true });
        }}
      />
    </div>
  );
}

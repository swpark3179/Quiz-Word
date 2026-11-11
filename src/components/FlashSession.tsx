/**
 * 플래시카드 진행 — 단어 → 안다/모른다 → 상세 → 다음.
 * 모른다 카드는 몇 장 뒤에 다시 나온다 (flashQueue).
 */
import { BookPlus, Check, RotateCcw, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { WORD_BY_ID } from '../data/words';
import { answer, createQueue, currentId, isFinished, isRepeat, split, summary, type FlashQueue, type SplitPart } from '../lib/flashQueue';
import { flashSourceName, flashSplitNotebookName } from '../lib/notebook';
import { speak } from '../lib/tts';
import { useProgress } from '../store/progress';
import { isModalOpen, isTyping } from './Dialog';
import { SessionHeader, StickyActions, useExitGuard } from './SessionParts';
import { Button, Card, Kbd, PosBadge, SpeakButton } from './ui';
import { WordBrief } from './WordInfo';

export interface FlashSessionProps {
  ids: string[];
  title: string;
  /** 어디서 시작했는지 (학습장 이름 등) — 그만할 때 만드는 학습장 이름 앞부분. 없으면 "플래시카드 11/11" */
  source?: string;
  /** 판정을 확정할 때마다 (first = 이 세션에서 처음 본 카드인지) */
  onAnswer: (id: string, known: boolean, first: boolean) => void;
  onExit: () => void;
}

/** 그만할 때 만든 학습장 — 진행이 바뀌면(key) 다시 만들 수 있다 */
type SavedSplit = { key: string; parts: Partial<Record<SplitPart, { id: string; name: string }>> };

export function FlashSession({ ids, title, source, onAnswer, onExit }: FlashSessionProps) {
  const [queue, setQueue] = useState<FlashQueue>(() => createQueue(ids));
  const [judged, setJudged] = useState<boolean | null>(null);
  const [round, setRound] = useState(0);
  const settings = useProgress((s) => s.settings);
  const id = currentId(queue);
  const w = id ? WORD_BY_ID.get(id) : undefined;
  const total = useMemo(() => new Set(queue.order.concat(queue.done)).size, [queue]);
  const spokenFor = useRef<string>('');
  const finished = isFinished(queue);
  const createNotebook = useProgress((s) => s.createNotebook);
  const parts = useMemo(() => split(queue), [queue]);
  const progressKey = `${round}:${queue.shown}`;
  const [saved, setSaved] = useState<SavedSplit>({ key: '', parts: {} });
  const savedNow = saved.key === progressKey ? saved.parts : {};
  const saveSplit = (part: SplitPart) => {
    const name = flashSplitNotebookName(part, source ?? flashSourceName({ set: '' }, []));
    const nid = createNotebook(name, parts[part]);
    setSaved({ key: progressKey, parts: { ...savedNow, [part]: { id: nid, name } } });
  };
  const { requestExit, dialog: exitDialog } = useExitGuard(
    onExit,
    !finished && queue.shown > 0,
    <SplitSave parts={parts} saved={savedNow} onSave={saveSplit} />,
  );

  // 새 카드가 나오면 자동 발음
  useEffect(() => {
    const key = `${id}:${queue.shown}`;
    if (w && judged === null && settings.autoSpeak && spokenFor.current !== key) {
      spokenFor.current = key;
      speak(w.word, { voiceURI: settings.ttsVoice, rate: settings.ttsRate });
    }
  }, [w, id, queue.shown, judged, settings]);

  const judge = useCallback((known: boolean) => setJudged(known), []);

  // 새 카드마다 화면 맨 위로
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [queue.shown, round]);

  const next = useCallback(() => {
    if (!id || judged === null) return;
    onAnswer(id, judged, !(id in queue.first));
    setQueue((q) => answer(q, judged));
    setJudged(null);
  }, [id, judged, onAnswer, queue.first]);

  const restartWith = (list: string[]) => {
    setQueue(createQueue(list));
    setJudged(null);
    setRound((r) => r + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e) || isModalOpen()) return;
      const k = e.key;
      if (k === 'Escape') {
        e.preventDefault();
        requestExit();
        return;
      }
      if (finished) {
        // 끝 화면: Enter 로 모른 단어만 다시 (없으면 나가기)
        if (k !== 'Enter') return;
        e.preventDefault();
        const { unknown } = summary(queue);
        if (unknown.length) restartWith(unknown);
        else onExit();
        return;
      }
      if (k.toLowerCase() === 'p' && w) {
        speak(w.word, { voiceURI: settings.ttsVoice, rate: settings.ttsRate });
        return;
      }
      if (judged === null) {
        if (k === 'ArrowLeft' || k === '1') judge(false);
        else if (k === 'ArrowRight' || k === '2') judge(true);
        else return;
      } else {
        if (k === ' ' || k === 'Enter') next();
        else if (k === 'ArrowDown' || k === 'ArrowLeft') setJudged(false);
        else if (k === 'ArrowUp' || k === 'ArrowRight') setJudged(true);
        else return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [judged, judge, next, w, settings, finished, queue, requestExit, onExit]); // eslint-disable-line react-hooks/exhaustive-deps

  if (finished) {
    const s = summary(queue);
    return (
      <div className="anim-card-in mx-auto max-w-xl">
        <Card className="p-8 text-center">
          <div className="text-sm font-semibold text-muted">{title}</div>
          <div className="mt-2 text-3xl font-bold">끝까지 봤어요</div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-surface-2 p-4">
              <div className="text-2xl font-bold tabular-nums">{s.total}</div>
              <div className="mt-0.5 text-xs text-muted">전체</div>
            </div>
            <div className="rounded-2xl bg-success-soft p-4">
              <div className="text-2xl font-bold tabular-nums text-success">{s.known}</div>
              <div className="mt-0.5 text-xs text-muted">바로 안 단어</div>
            </div>
            <div className="rounded-2xl bg-danger-soft p-4">
              <div className="text-2xl font-bold tabular-nums text-danger">{s.unknown.length}</div>
              <div className="mt-0.5 text-xs text-muted">모른 단어</div>
            </div>
          </div>
          {s.unknown.length > 0 && (
            <div className="mt-6 text-left">
              <div className="mb-2 text-[13px] font-bold text-muted">모른 단어</div>
              <div className="flex flex-wrap gap-1.5">
                {s.unknown.map((uid) => {
                  const uw = WORD_BY_ID.get(uid);
                  return (
                    <Link key={uid} to={`/word/${uid}`} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[13px] hover:bg-primary-soft hover:text-primary-text">
                      <b>{uw?.word}</b> <span className="text-muted">{uw?.short}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {s.unknown.length > 0 && (
              <Button variant="primary" onClick={() => restartWith(s.unknown)}>
                <RotateCcw size={16} /> 모른 단어만 다시 <Kbd>Enter</Kbd>
              </Button>
            )}
            <Button onClick={() => restartWith(Object.keys(queue.first))}>전체 다시</Button>
            <Button variant={s.unknown.length ? 'ghost' : 'primary'} onClick={onExit}>
              나가기 <Kbd>{s.unknown.length ? 'Esc' : 'Enter'}</Kbd>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!w) return null;
  const repeat = isRepeat(queue);

  return (
    <div className="mx-auto max-w-2xl">
      <SessionHeader onExit={requestExit} value={queue.done.length} max={total} label={`${queue.done.length} / ${total}`} />

      {/* overflow-hidden 을 쓰지 않는다 — 아래 "다음" 줄이 화면 아래에 붙어야 한다 */}
      <Card key={`${id}-${queue.shown}-${round}`} className="anim-card-in">
        {/* 앞면 */}
        <div className={`flex flex-col items-center px-6 text-center ${judged === null ? 'py-16 sm:py-20' : 'pb-6 pt-8'}`}>
          <div className="mb-4 flex h-5 items-center gap-2">
            {repeat && <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-warning">다시 나온 카드</span>}
            {w.pos.slice(0, 2).map((p) => (
              <PosBadge key={p} pos={p} size="xs" />
            ))}
          </div>
          <div className={`font-bold tracking-tight transition-all ${judged === null ? 'text-5xl sm:text-6xl' : 'text-4xl'}`}>{w.word}</div>
          <div className="mt-3 flex items-center gap-1">
            {w.ipa && <span className="ipa text-[17px] text-muted">/{w.ipa}/</span>}
            <SpeakButton text={w.word} />
          </div>
        </div>

        {judged === null ? (
          <div className="grid grid-cols-2 border-t border-line">
            <button
              onClick={() => judge(false)}
              className="focus-inset group flex flex-col items-center gap-1.5 rounded-bl-2xl py-5 text-danger transition hover:bg-danger-soft"
            >
              <span className="flex items-center gap-2 text-[17px] font-bold">
                <X size={20} /> 모른다
              </span>
              <span className="flex gap-1 opacity-70">
                <Kbd>←</Kbd>
                <Kbd>1</Kbd>
              </span>
            </button>
            <button
              onClick={() => judge(true)}
              className="focus-inset group flex flex-col items-center gap-1.5 rounded-br-2xl border-l border-line py-5 text-success transition hover:bg-success-soft"
            >
              <span className="flex items-center gap-2 text-[17px] font-bold">
                <Check size={20} /> 안다
              </span>
              <span className="flex gap-1 opacity-70">
                <Kbd>→</Kbd>
                <Kbd>2</Kbd>
              </span>
            </button>
          </div>
        ) : (
          <div className="anim-fade border-t border-line">
            <div
              className={`flex items-center justify-between gap-3 px-6 py-2.5 text-[13px] font-semibold ${judged ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}
              role="status"
            >
              <span className="flex items-center gap-1.5">
                {judged ? <Check size={15} className="shrink-0" /> : <X size={15} className="shrink-0" />}
                {judged ? '안다고 했어요' : '모른다고 했어요'}
                {!judged && <span className="hidden font-medium opacity-80 sm:inline">— 몇 장 뒤에 다시 나옵니다</span>}
              </span>
              <button
                onClick={() => setJudged(!judged)}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md text-[12.5px] font-medium opacity-80 hover:opacity-100"
              >
                <Undo2 size={13} /> {judged ? '사실 몰랐어요' : '사실 알았어요'} <Kbd>{judged ? '↓' : '↑'}</Kbd>
              </button>
            </div>
            <div className="px-6 py-6 sm:px-8">
              <WordBrief w={w} contextLimit={2} memory />
            </div>
            <StickyActions className="px-6 sm:px-8">
              <Link to={`/word/${w.id}`} target="_blank" className="text-[13px] font-medium text-muted hover:text-primary">
                상세 보기 ↗
              </Link>
              <Button variant="primary" className="min-w-28" onClick={next}>
                다음 <Kbd>Space</Kbd>
              </Button>
            </StickyActions>
          </div>
        )}
      </Card>

      <div className="keys-hint mt-4 text-center text-[12px] text-muted">
        <Kbd>P</Kbd> 발음 듣기 · <Kbd>Esc</Kbd> 그만하기
      </div>
      {exitDialog}
    </div>
  );
}

const SPLIT_LABEL: Record<SplitPart, string> = { done: '진행한 단어', left: '남은 단어' };

/** 그만하기 확인창 — 진행한 단어 / 남은 단어를 각각 학습장으로 남긴다 (만든 뒤에도 창은 그대로라 둘 다 만들 수 있다) */
function SplitSave({ parts, saved, onSave }: { parts: Record<SplitPart, string[]>; saved: SavedSplit['parts']; onSave: (part: SplitPart) => void }) {
  return (
    <div className="mt-4 rounded-xl border border-line p-3.5">
      <div className="text-[13px] font-bold text-ink">학습장으로 남기기</div>
      <div className="mt-0.5 text-[12.5px] leading-snug text-muted">남은 단어는 나중에 이어서, 진행한 단어는 다시 볼 수 있게 따로 담아 둡니다.</div>
      <div className="mt-3 grid gap-2">
        {(['done', 'left'] as const).map((part) => {
          const s = saved[part];
          const n = parts[part].length;
          return s ? (
            <div key={part} role="status" className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-[13px] text-success">
              <Check size={15} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate font-semibold">'{s.name}' 만들었어요</span>
              <Link to={`/notebooks/${s.id}`} className="shrink-0 font-semibold underline-offset-2 hover:underline">
                열기
              </Link>
            </div>
          ) : (
            <Button key={part} className="justify-between px-3 py-2 text-[13px]" disabled={!n} onClick={() => onSave(part)}>
              <span className="flex items-center gap-2">
                <BookPlus size={15} className="shrink-0" />
                <span>
                  {SPLIT_LABEL[part]} <b className="tabular-nums">{n}</b>개
                </span>
              </span>
              <span className="font-medium text-muted">학습장 만들기</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

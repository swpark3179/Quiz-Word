/**
 * 객관식 진행 — 영어 단어(또는 예문 속 단어)를 보고 한글 뜻을 고른다.
 */
import { Check, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { contextsOf, WORD_BY_ID, WORDS } from '../data/words';
import { buildContextQuestion, buildMeaningQuestion, type Question } from '../lib/distractors';
import type { Word } from '../lib/schema';
import { speak } from '../lib/tts';
import { useProgress } from '../store/progress';
import type { ExamplePref } from '../lib/corpus';
import { Highlighted } from './ContextSentence';
import { useExamPref } from './ExamPref';
import { isModalOpen, isTyping } from './Dialog';
import { SessionHeader, StickyActions, useExitGuard } from './SessionParts';
import { Button, Card, Kbd, PosBadge, SpeakButton } from './ui';
import { WordBrief } from './WordInfo';

export type QuizMode = 'meaning' | 'context' | 'mixed';

export interface QuizSessionProps {
  ids: string[];
  mode: QuizMode;
  title: string;
  onResult: (id: string, correct: boolean) => void;
  onExit: () => void;
}

const POOL_ALL = WORDS;
/** 1단계(아주 쉬운 단어)의 뜻은 오답 보기로 너무 쉬워서, 1단계 단어를 낼 때만 쓴다 */
const POOL_NO_EASY = WORDS.filter((w) => w.level > 1);

function makeQuestion(w: Word, mode: QuizMode, choices: number, pref: ExamplePref): Question {
  const pool = w.level === 1 ? POOL_ALL : POOL_NO_EASY;
  const useContext = mode === 'context' || (mode === 'mixed' && w.contexts.length > 0 && Math.random() < 0.5);
  if (useContext) {
    const ctx = contextsOf(w, 4, pref).filter((c) => !/[가-힣]/.test(c.en));
    if (ctx.length) return buildContextQuestion(w, pool, ctx, choices);
  }
  return buildMeaningQuestion(w, pool, choices);
}

export function QuizSession({ ids: initialIds, mode, title, onResult, onExit }: QuizSessionProps) {
  const choices = useProgress((s) => s.settings.quizChoices);
  const pref = useExamPref();
  const settings = useProgress((s) => s.settings);
  const [ids, setIds] = useState(initialIds);
  const [index, setIndex] = useState(0);
  const [questions, setQuestions] = useState<Record<number, Question>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, boolean>>({});

  const id = ids[index];
  const w = id ? WORD_BY_ID.get(id) : undefined;
  const finished = index >= ids.length;
  const wrongIds = useMemo(() => ids.filter((x) => results[x] === false), [ids, results]);
  const { requestExit, dialog: exitDialog } = useExitGuard(onExit, !finished && Object.keys(results).length > 0);
  const q = useMemo(() => {
    if (!w) return undefined;
    return questions[index] ?? makeQuestion(w, mode, choices, pref);
  }, [w, index, questions, mode, choices, pref]);

  // 한 번 만든 문제는 고정 (다시 그려도 보기가 바뀌지 않게)
  useEffect(() => {
    if (q && !questions[index]) setQuestions((prev) => ({ ...prev, [index]: q }));
  }, [q, index, questions]);

  useEffect(() => {
    if (w && picked === null && settings.autoSpeak && q?.mode === 'meaning') speak(w.word, { voiceURI: settings.ttsVoice, rate: settings.ttsRate });
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새 문제마다 화면 맨 위로
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index, ids]);

  const choose = useCallback(
    (i: number) => {
      if (!q || picked !== null || !w) return;
      setPicked(i);
      const correct = q.options[i]?.correct ?? false;
      setResults((r) => ({ ...r, [w.id]: correct }));
      onResult(w.id, correct);
    },
    [q, picked, w, onResult],
  );

  const next = useCallback(() => {
    setPicked(null);
    setIndex((i) => i + 1);
  }, []);

  const restart = (list: string[]) => {
    setIds(list);
    setIndex(0);
    setQuestions({});
    setPicked(null);
    setResults({});
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e) || isModalOpen()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        requestExit();
        return;
      }
      if (finished) {
        // 결과 화면: Enter 로 틀린 것만 다시 (없으면 나가기)
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (wrongIds.length) restart(wrongIds);
        else onExit();
        return;
      }
      if (e.key.toLowerCase() === 'p' && w) {
        speak(q?.context ? q.context.en : w.word, { voiceURI: settings.ttsVoice, rate: settings.ttsRate });
        return;
      }
      if (picked === null) {
        const n = Number(e.key);
        if (n >= 1 && n <= (q?.options.length ?? 0)) {
          e.preventDefault();
          choose(n - 1);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picked, q, choose, next, w, settings, finished, wrongIds, requestExit, onExit]);

  if (finished) {
    const correctN = ids.length - wrongIds.length;
    const pct = Math.round((correctN / Math.max(1, ids.length)) * 100);
    return (
      <div className="anim-card-in mx-auto max-w-xl">
        <Card className="p-8 text-center">
          <div className="text-sm font-semibold text-muted">{title}</div>
          <div className="mt-3 text-5xl font-bold tabular-nums">
            {pct}
            <span className="text-2xl text-muted">점</span>
          </div>
          <div className="mt-2 text-sm text-muted">
            {ids.length}문제 중 <b className="text-success">{correctN}</b>개 맞힘 · <b className="text-danger">{wrongIds.length}</b>개 틀림
          </div>
          {wrongIds.length > 0 && (
            <div className="mt-6 text-left">
              <div className="mb-2 text-[13px] font-bold text-muted">틀린 단어 (오답노트에 담겼어요)</div>
              <div className="divide-y divide-line rounded-xl border border-line">
                {wrongIds.map((wid) => {
                  const ww = WORD_BY_ID.get(wid);
                  return (
                    <Link key={wid} to={`/word/${wid}`} className="flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-surface-2">
                      <b className="w-36 truncate">{ww?.word}</b>
                      <span className="flex-1 truncate text-ink-2">{ww?.short}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {wrongIds.length > 0 && (
              <Button variant="primary" onClick={() => restart(wrongIds)}>
                <RotateCcw size={16} /> 틀린 것만 다시 풀기 <Kbd>Enter</Kbd>
              </Button>
            )}
            <Button onClick={() => restart([...ids].sort(() => Math.random() - 0.5))}>전체 다시</Button>
            <Button variant={wrongIds.length ? 'ghost' : 'primary'} onClick={onExit}>
              나가기 <Kbd>{wrongIds.length ? 'Esc' : 'Enter'}</Kbd>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!w || !q) return null;
  const answered = picked !== null;
  const wasCorrect = answered && q.options[picked!]?.correct;

  return (
    <div className="mx-auto max-w-2xl">
      <SessionHeader onExit={requestExit} value={index + (answered ? 1 : 0)} max={ids.length} label={`${index + 1} / ${ids.length}`} />

      <Card key={`${index}-${ids.length}`} className="anim-card-in p-6 sm:p-8">
        {q.mode === 'context' && q.context ? (
          <div>
            <div className="mb-3 text-[13px] font-semibold text-muted">
              이 문장에서 <b className="text-ink">{q.context.surface}</b> 의 뜻은?
            </div>
            <div className="flex items-start gap-1 rounded-xl bg-surface-2 px-4 py-4">
              <p className="flex-1 text-[17px] leading-relaxed">
                <Highlighted text={q.context.en} surface={q.context.surface} />
              </p>
              <SpeakButton text={q.context.en} size={16} />
            </div>
            {answered && q.context.ko && <p className="anim-fade mt-2 px-1 text-[13.5px] text-ink-2">{q.context.ko}</p>}
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className="mb-3 flex justify-center gap-1.5">
              {w.pos.slice(0, 2).map((p) => (
                <PosBadge key={p} pos={p} size="xs" />
              ))}
            </div>
            <div className="text-5xl font-bold tracking-tight">{w.word}</div>
            <div className="mt-3 flex items-center justify-center gap-1">
              {w.ipa && <span className="ipa text-[16px] text-muted">/{w.ipa}/</span>}
              <SpeakButton text={w.word} />
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-2.5">
          {q.options.map((o, i) => {
            const isPicked = picked === i;
            let cls = 'border-line bg-surface hover:border-primary/50 hover:bg-primary-soft/40';
            if (answered) {
              if (o.correct) cls = 'border-success bg-success-soft text-ink';
              else if (isPicked) cls = 'anim-shake border-danger bg-danger-soft text-ink';
              else cls = 'border-line bg-surface opacity-55';
            }
            const owner = answered && !o.correct && o.wordId && o.wordId !== w.id ? WORD_BY_ID.get(o.wordId) : undefined;
            return (
              <button
                key={i}
                disabled={answered}
                onClick={() => choose(i)}
                className={`flex items-center gap-3.5 rounded-xl border-2 px-4 py-3.5 text-left transition ${cls}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${
                    answered && o.correct ? 'bg-success text-white dark:text-[#0e1018]' : answered && isPicked ? 'bg-danger text-white dark:text-[#0e1018]' : 'bg-surface-3 text-muted'
                  }`}
                >
                  {answered && o.correct ? <Check size={15} /> : answered && isPicked ? <X size={15} /> : i + 1}
                </span>
                <span className="flex-1 text-[15.5px] font-medium">{o.text}</span>
                {owner && <span className="shrink-0 text-[12.5px] text-muted">{owner.word}</span>}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="anim-fade mt-6">
            <div
              className={`mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold ${
                wasCorrect ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
              }`}
            >
              {wasCorrect ? <Check size={17} /> : <X size={17} />}
              {wasCorrect ? '정답이에요' : '틀렸어요 — 오답노트에 담았어요'}
            </div>
            <WordBrief w={w} contextLimit={1} highlightSense={q.context?.sense} />
            {/* 카드 안쪽 여백(p-6 sm:p-8)을 지우고 카드 아래 끝에 맞춘다 */}
            <StickyActions className="-mx-6 -mb-6 mt-6 px-6 sm:-mx-8 sm:-mb-8 sm:px-8">
              <Link to={`/word/${w.id}`} target="_blank" className="text-[13px] font-medium text-muted hover:text-primary">
                상세 보기 ↗
              </Link>
              <Button variant="primary" className="min-w-28" onClick={next}>
                {index + 1 < ids.length ? '다음 문제' : '결과 보기'} <Kbd>Enter</Kbd>
              </Button>
            </StickyActions>
          </div>
        )}
      </Card>
      {!answered && (
        <div className="keys-hint mt-4 text-center text-[12px] text-muted">
          <Kbd>1</Kbd>~<Kbd>{q.options.length}</Kbd> 보기 선택 · <Kbd>P</Kbd> 발음 · <Kbd>Esc</Kbd> 그만하기
        </div>
      )}
      {exitDialog}
    </div>
  );
}

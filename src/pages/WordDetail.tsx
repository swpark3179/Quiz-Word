/** 단어 상세 */
import { ArrowLeft, BookmarkMinus, BookmarkPlus, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ContextSentence } from '../components/ContextSentence';
import { ExamPrefProvider, useExamPref } from '../components/ExamPref';
import { isModalOpen, isTyping } from '../components/Dialog';
import { Button, Card, PosBadge, SectionTitle, StatusBadge } from '../components/ui';
import { MemoryAid, SenseList, WordHead } from '../components/WordInfo';
import { contextsOf, corpusExamples, EXAMS, examName, quizSources, WORD_BY_ID, WORD_BY_SURFACE } from '../data/words';
import { freqIn, isExtra } from '../lib/exams';
import { levelName } from '../lib/schema';
import { statusOf } from '../lib/srs';
import { relativeDue } from '../lib/text';
import { speak } from '../lib/tts';
import { useProgress } from '../store/progress';
import { scopeToParams, DEFAULT_SCOPE } from '../lib/scope';
import type { Context } from '../lib/schema';
import { wordNeighbors } from './wordNav';

function groupBySense(contexts: Context[]) {
  const groups: { sense: string; pos: string; items: Context[] }[] = [];
  for (const c of contexts) {
    const g = groups.find((x) => x.sense === c.sense);
    if (g) g.items.push(c);
    else groups.push({ sense: c.sense, pos: c.pos, items: [c] });
  }
  return groups;
}

export function WordDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const w = WORD_BY_ID.get(id);
  const card = useProgress((s) => s.cards[id]);
  const wrong = useProgress((s) => s.wrong[id]);
  const history = useProgress((s) => s.history[id]);
  const settings = useProgress((s) => s.settings);
  const addWrong = useProgress((s) => s.addWrong);
  const removeWrong = useProgress((s) => s.removeWrong);
  const [moreOpen, setMoreOpen] = useState(false);
  /** 들어온 목록(단어장 검색 결과·오답노트)에서의 이전·다음 단어 */
  const near = wordNeighbors(id);
  // 단어장에서 시험·문제 파일을 골라 들어왔으면 그쪽 예문을 먼저, 아니면 주 시험
  const mainPref = useExamPref();
  const pref = near?.pref ?? mainPref;
  // 이전·다음은 기록을 쌓지 않고 바꿔 끼운다 — "뒤로" 한 번이면 목록으로 돌아간다
  const go = (to?: string) => to && navigate(`/word/${to}`, { replace: true });

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (w) document.title = `${w.word} · Quiz Word`;
  }, [w]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || isModalOpen() || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Backspace' || (e.key === 'ArrowLeft' && e.altKey)) return navigate(-1);
      if (e.altKey) return;
      if (e.key.toLowerCase() === 'p' && w) speak(w.word, { voiceURI: settings.ttsVoice, rate: settings.ttsRate });
      else if (e.key === 'ArrowLeft') go(near?.prev);
      else if (e.key === 'ArrowRight') go(near?.next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [w, settings, navigate, near?.prev, near?.next]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!w) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">단어를 찾을 수 없습니다: {id}</p>
        <Link to="/words" className="mt-4 inline-block text-primary">
          단어장으로
        </Link>
      </div>
    );
  }

  const status = statusOf(card);
  const contexts = contextsOf(w, 4, pref);
  const more = moreOpen ? corpusExamples(w, 12, pref).filter((c) => !contexts.some((x) => x.en === c.en)) : [];
  // 문장 색인에서 자동으로 찾은 예문은 뜻이 정해져 있지 않으므로 뜻별로 묶지 않는다
  const groups = contexts.some((c) => !c.auto) ? groupBySense(contexts) : [{ sense: '', pos: '', items: contexts }];
  const examFreq = freqIn(w, pref.cat);
  const freqLabel = examFreq > 0 ? `${examName(pref.cat)} 문제에 ${examFreq}회` : w.freq > 0 ? `다른 시험 문제에 ${w.freq}회` : '';
  /** 나온 문제 파일 — 시험별로 */
  const appears = EXAMS.map((e) => ({ exam: e, files: quizSources(e.id).filter((s) => w.occ[e.id]?.[s.id]) })).filter((x) => x.files.length);
  /** 시험별 노트 — 보고 있는 시험 것을 먼저 */
  const notes = [...(w.notes ?? [])].sort((a, b) => Number(b.cat === pref.cat) - Number(a.cat === pref.cat));

  return (
    <ExamPrefProvider pref={pref}>
    <div className="anim-fade space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 rounded-lg py-1 pr-2 text-[13px] font-medium text-muted hover:text-ink">
          <ArrowLeft size={16} /> {near?.back ?? '뒤로'}
        </button>
        {near && near.total > 1 && (
          <div className="flex items-center gap-1 text-[13px] text-muted">
            <button
              onClick={() => go(near.prev)}
              disabled={!near.prev}
              title="이전 단어 (←)"
              aria-label="이전 단어"
              className="rounded-lg p-1.5 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="tabular-nums">
              {(near.index + 1).toLocaleString()} / {near.total.toLocaleString()}
            </span>
            <button
              onClick={() => go(near.next)}
              disabled={!near.next}
              title="다음 단어 (→)"
              aria-label="다음 단어"
              className="rounded-lg p-1.5 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <WordHead w={w} />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-muted">
              {w.level}단계 · {levelName(w.level)}
            </span>
            {isExtra(w) && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-muted">확장 단어</span>}
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <div className="text-[21px] font-bold leading-snug text-primary-text">{w.short}</div>
          {w.meaning !== w.short && <div className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{w.meaning}</div>}
        </div>

        {w.senses.length > 1 && (
          <div className="mt-5">
            <SectionTitle>여러 뜻</SectionTitle>
            <SenseList w={w} />
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {wrong ? (
            <Button onClick={() => removeWrong(w.id)}>
              <BookmarkMinus size={16} /> 오답노트에서 빼기
            </Button>
          ) : (
            <Button onClick={() => addWrong(w.id)}>
              <BookmarkPlus size={16} /> 오답노트에 담기
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => navigate(`/flash/play?${scopeToParams({ ...DEFAULT_SCOPE, set: 'all', status: 'any', count: 0 })}&ids=${w.id}`)}
          >
            <Layers size={16} /> 이 단어 카드로 보기
          </Button>
        </div>
      </Card>

      {w.memory && (
        <Card className="p-6 sm:p-8">
          <SectionTitle>외우기 · 어원과 연상</SectionTitle>
          <MemoryAid w={w} linkFamily />
        </Card>
      )}

      <Card className="p-6 sm:p-8">
        <SectionTitle right={<span className="text-[12px] text-muted">{freqLabel}</span>}>
          문제 속 뜻과 예문
        </SectionTitle>
        {contexts.length === 0 && <p className="text-sm text-muted">문제에 나온 예문이 없습니다.</p>}
        <div className="space-y-5">
          {groups.map((g, i) => (
            <div key={i}>
              {g.sense && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[15px] font-bold">{g.sense}</span>
                  {g.pos && <PosBadge pos={g.pos} size="xs" />}
                </div>
              )}
              <div className="space-y-2.5">
                {g.items.map((c, j) => (
                  <ContextSentence key={j} c={c} showSense={false} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {w.freq > contexts.length && (
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="mt-4 flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
          >
            {moreOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            다른 문제 속 예문 {moreOpen ? '접기' : '더 보기'}
          </button>
        )}
        {moreOpen && (
          <div className="anim-fade mt-3 space-y-2.5">
            {more.map((c, i) => (
              <ContextSentence key={i} c={c} showSense={false} compact />
            ))}
            {more.length === 0 && <p className="text-sm text-muted">더 찾은 예문이 없습니다.</p>}
          </div>
        )}
      </Card>

      {(w.forms?.length || w.synonyms?.length || appears.length > 0) && (
        <Card className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
          {!!w.forms?.length && (
            <div>
              <SectionTitle>변화형·파생어</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {w.forms.map((f) => (
                  <span key={f} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[13px]">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!!w.synonyms?.length && (
            <div>
              <SectionTitle>비슷한 말</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {w.synonyms.map((s) => {
                  const target = WORD_BY_SURFACE.get(s.toLowerCase());
                  return target && target.id !== w.id ? (
                    <Link key={s} to={`/word/${target.id}`} className="rounded-lg bg-primary-soft px-2.5 py-1 text-[13px] font-medium text-primary-text hover:underline">
                      {s}
                    </Link>
                  ) : (
                    <span key={s} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[13px]">
                      {s}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {appears.length > 0 && (
            <div className="sm:col-span-2">
              <SectionTitle>나온 문제 파일</SectionTitle>
              <div className="space-y-2">
                {appears.map(({ exam, files }) => (
                  <div key={exam.id} className="flex flex-wrap items-center gap-1.5">
                    <Link to={`/words?cat=${exam.id}`} className="mr-1 text-[12.5px] font-semibold text-ink-2 hover:text-primary">
                      {exam.name}
                    </Link>
                    {files.map((s) => (
                      <Link
                        key={s.id}
                        to={`/words?cat=${exam.id}&src=${s.id}`}
                        className="rounded-lg border border-line px-2.5 py-1 text-[12.5px] text-ink-2 hover:border-primary hover:text-primary"
                      >
                        {s.name}
                        <span className="ml-1.5 tabular-nums text-muted">{w.occ[exam.id][s.id]}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {notes.map((n) => (
        <Card key={n.cat} className="p-6 sm:p-8">
          <SectionTitle>{examName(n.cat)} 노트</SectionTitle>
          <div className="note">
            <Markdown>{n.md}</Markdown>
          </div>
        </Card>
      ))}

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-6 text-[13.5px] sm:px-8">
        <div>
          <div className="text-[12px] text-muted">학습 상태</div>
          <div className="mt-0.5 font-semibold">
            <StatusBadge status={status} />
          </div>
        </div>
        <div>
          <div className="text-[12px] text-muted">다음 복습</div>
          <div className="mt-0.5 font-semibold">{card ? relativeDue(new Date(card.due)) : '아직 학습 전'}</div>
        </div>
        <div>
          <div className="text-[12px] text-muted">맞힘 / 틀림</div>
          <div className="mt-0.5 font-semibold tabular-nums">
            <span className="text-success">{history?.ok ?? 0}</span> / <span className="text-danger">{history?.ng ?? 0}</span>
          </div>
        </div>
        {card && (
          <div>
            <div className="text-[12px] text-muted">기억 안정도</div>
            <div className="mt-0.5 font-semibold tabular-nums">{card.stability.toFixed(1)}일</div>
          </div>
        )}
      </Card>
    </div>
    </ExamPrefProvider>
  );
}

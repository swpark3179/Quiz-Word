/** 객관식 — 범위·방식 고르기 + 진행 */
import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { QuizSession, type QuizMode } from '../components/QuizSession';
import { ScopePicker, StartButton, useStoredScope } from '../components/ScopePicker';
import { Button, Card, Empty, PageHeader } from '../components/ui';
import { WORD_BY_ID, WORDS } from '../data/words';
import { scopeFromParams, scopeToParams, selectWords } from '../lib/scope';
import { shuffle } from '../lib/text';
import { useProgress } from '../store/progress';

const MODES: { id: QuizMode; title: string; desc: string }[] = [
  { id: 'meaning', title: '단어 → 뜻', desc: '영어 단어를 보고 한글 뜻 고르기' },
  { id: 'context', title: '문맥 뜻', desc: '문제 속 문장에서 쓰인 뜻 고르기 (다의어 연습)' },
  { id: 'mixed', title: '섞어서', desc: '두 방식을 번갈아' },
];

const MODE_KEY = 'quiz-word:quiz-mode';

/** 마지막으로 고른 문제 방식을 기억한다 (이 브라우저에만) */
function useStoredMode(): [QuizMode, (m: QuizMode) => void] {
  const [mode, setMode] = useState<QuizMode>(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      return MODES.some((m) => m.id === saved) ? (saved as QuizMode) : 'meaning';
    } catch {
      return 'meaning';
    }
  });
  const update = (m: QuizMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* 저장 못 해도 동작에는 문제 없음 */
    }
  };
  return [mode, update];
}

export function QuizPage() {
  const [scope, setScope] = useStoredScope('quiz');
  const [mode, setMode] = useStoredMode();
  const choices = useProgress((s) => s.settings.quizChoices);
  const updateSettings = useProgress((s) => s.updateSettings);
  const navigate = useNavigate();
  return (
    <div className="anim-fade">
      <PageHeader title="객관식 퀴즈" desc="오답 보기는 같은 품사·비슷한 뜻의 단어에서 골라 헷갈리게 만듭니다." />
      <Card className="p-6 sm:p-8">
        <div className="mb-6 grid gap-2.5 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`rounded-xl border-2 p-4 text-left transition ${
                mode === m.id ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary/40'
              }`}
            >
              <div className={`text-[15px] font-bold ${mode === m.id ? 'text-primary-text' : ''}`}>{m.title}</div>
              <div className="mt-1 text-[12.5px] text-muted">{m.desc}</div>
            </button>
          ))}
        </div>
        <ScopePicker scope={scope} onChange={setScope} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            보기 개수
            {[4, 5].map((n) => (
              <button
                key={n}
                onClick={() => updateSettings({ quizChoices: n as 4 | 5 })}
                aria-pressed={choices === n}
                className={`rounded-lg border px-2.5 py-1 font-semibold ${choices === n ? 'border-primary bg-primary-soft text-primary-text' : 'border-line'}`}
              >
                {n}개
              </button>
            ))}
          </div>
          <StartButton scope={scope} unit="문제" onStart={() => navigate(`/quiz/play?${scopeToParams(scope)}&mode=${mode}`)} />
        </div>
      </Card>
    </div>
  );
}

export function QuizPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  // 주소를 직접 열어 들어온 경우에는 돌아갈 이전 화면이 없으므로 범위 고르기로 보낸다
  const exit = () => (location.key === 'default' ? navigate('/quiz', { replace: true }) : navigate(-1));
  const record = useProgress((s) => s.record);
  const mode = (params.get('mode') as QuizMode) || 'meaning';
  const [ids] = useState<string[]>(() => {
    const explicit = params.get('ids');
    if (explicit) return explicit.split(',').filter((id) => WORD_BY_ID.has(id));
    const { cards, wrong, notebooks } = useProgress.getState();
    // 범위에서 고른 단어를 섞어서 낸다
    return shuffle(selectWords(WORDS, scopeFromParams(params), { cards, wrong, notebooks }).map((w) => w.id));
  });

  if (!ids.length) {
    return (
      <Empty
        icon={<ListChecks size={22} />}
        title="낼 문제가 없어요"
        desc="범위나 상태 조건을 바꿔 보세요."
        action={<Button onClick={() => navigate('/quiz')}>범위 다시 고르기</Button>}
      />
    );
  }

  return (
    <QuizSession
      ids={ids}
      mode={mode}
      title="객관식 퀴즈"
      onExit={exit}
      onResult={(id, correct) => record(id, correct, { source: 'quiz' })}
    />
  );
}

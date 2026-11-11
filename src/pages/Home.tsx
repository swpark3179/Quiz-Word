/** 홈 — 오늘 할 일과 진척 */
import { ArrowRight, Brain, CalendarClock, Layers, ListChecks, NotebookPen } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, SectionTitle } from '../components/ui';
import { EXAMS, examName, mainExam, quizSources, WORDS } from '../data/words';
import { inExam } from '../lib/exams';
import { statusOf } from '../lib/srs';
import { dayKey, daysUntil } from '../lib/text';
import { useProgress } from '../store/progress';
import { reviewPlan } from './Review';

function StatTile({ to, icon, value, label, tone }: { to: string; icon: React.ReactNode; value: React.ReactNode; label: string; tone: string }) {
  return (
    <Link to={to} className="group rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      <div className="text-[28px] font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1.5 flex items-center justify-between text-[13px] text-muted">
        {label}
        <ArrowRight size={14} className="opacity-0 transition group-hover:opacity-100" />
      </div>
    </Link>
  );
}

export function Home() {
  const cards = useProgress((s) => s.cards);
  const wrong = useProgress((s) => s.wrong);
  const days = useProgress((s) => s.days);
  const settings = useProgress((s) => s.settings);
  const todayNew = days[dayKey()]?.newWords ?? 0;
  const plan = useMemo(() => reviewPlan(cards, settings, todayNew), [cards, settings, todayNew]);
  const examLeft = settings.examDate ? daysUntil(settings.examDate) : undefined;

  const updateSettings = useProgress((s) => s.updateSettings);
  /** 주 시험 — 진척과 오늘의 새 단어가 이 시험 기준이다 */
  const exam = mainExam(settings.exam);
  const minLevel = settings.minLevel;

  const progress = useMemo(() => {
    // 주 시험에 나온 단어 중 학습 단계 이상
    const core = WORDS.filter((w) => inExam(w, exam) && w.level >= minLevel);
    const count = { new: 0, learning: 0, mastered: 0 };
    for (const w of core) count[statusOf(cards[w.id])]++;
    const bySource = quizSources(exam)
      .map((s) => {
        const ws = core.filter((w) => inExam(w, exam, s.id));
        const done = ws.filter((w) => statusOf(cards[w.id]) !== 'new').length;
        const mastered = ws.filter((w) => statusOf(cards[w.id]) === 'mastered').length;
        return { ...s, total: ws.length, done, mastered };
      })
      .filter((s) => s.total > 0);
    return { total: core.length, ...count, bySource };
  }, [cards, exam, minLevel]);

  const week = useMemo(() => {
    const out: { key: string; label: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const k = dayKey(d);
      out.push({ key: k, label: i === 0 ? '오늘' : ['일', '월', '화', '수', '목', '금', '토'][d.getDay()], n: days[k]?.reviews ?? 0 });
    }
    return out;
  }, [days]);
  const maxWeek = Math.max(1, ...week.map((d) => d.n));
  const today = days[dayKey()];
  const wrongN = Object.keys(wrong).length;
  const pct = (n: number) => `${(n / Math.max(1, progress.total)) * 100}%`;

  return (
    <div className="anim-fade space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {EXAMS.length > 1 ? (
            <select
              aria-label="주 시험"
              value={exam ?? ''}
              onChange={(e) => updateSettings({ exam: e.target.value })}
              className="-ml-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-semibold text-primary outline-none hover:border-line focus:border-primary"
            >
              {EXAMS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} 영어 단어
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[13px] font-semibold text-primary">{exam ? `${examName(exam)} 영어 단어` : '영어 단어'}</div>
          )}
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">오늘도 조금씩 쌓아 봐요</h1>
        </div>
        {examLeft !== undefined && examLeft >= 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-card">
            <CalendarClock size={17} className="text-primary" />
            <span className="text-[14px] font-bold">시험 D-{examLeft}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile to="/review" icon={<Brain size={18} />} value={plan.due.length} label="복습할 단어" tone="bg-primary-soft text-primary" />
        <StatTile to="/review" icon={<Layers size={18} />} value={plan.fresh.length} label="오늘의 새 단어" tone="bg-success-soft text-success" />
        <StatTile to="/wrong" icon={<NotebookPen size={18} />} value={wrongN} label="오답노트" tone="bg-danger-soft text-danger" />
        <StatTile
          to="/words"
          icon={<ListChecks size={18} />}
          value={today?.reviews ?? 0}
          label={`오늘 학습${today ? ` · 정답률 ${Math.round((today.correct / Math.max(1, today.correct + today.wrong)) * 100)}%` : ''}`}
          tone="bg-warning-soft text-warning"
        />
      </div>

      {plan.due.length + plan.fresh.length > 0 && (
        <Link
          to="/review"
          className="flex items-center gap-4 rounded-2xl bg-primary px-6 py-5 text-white shadow-pop transition hover:brightness-110 dark:text-[#0e1018]"
        >
          <Brain size={24} />
          <div className="flex-1">
            <div className="text-[16px] font-bold">오늘의 복습 시작하기</div>
            <div className="text-[13px] opacity-85">
              복습 {plan.due.length}개 + 새 단어 {plan.fresh.length}개
            </div>
          </div>
          <ArrowRight size={20} />
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <SectionTitle
            right={
              <span className="text-[12px] text-muted">
                {minLevel > 1 ? `${minLevel}단계 이상 ` : ''}
                {progress.total.toLocaleString()}개
              </span>
            }
          >
            {exam ? `${examName(exam)} 단어 진척` : '단어 진척'}
          </SectionTitle>
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
            <div className="bg-success transition-all" style={{ width: pct(progress.mastered) }} />
            <div className="bg-warning transition-all" style={{ width: pct(progress.learning) }} />
          </div>
          <div className="mt-2.5 flex gap-4 text-[12.5px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-success" />
              익힘 {progress.mastered}
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-warning" />
              학습 중 {progress.learning}
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-surface-3" />새 단어 {progress.new}
            </span>
          </div>

          <div className="mt-6 space-y-2.5">
            {progress.bySource.map((s) => (
              <Link key={s.id} to={`/words?cat=${exam}&src=${s.id}`} className="group block">
                <div className="mb-1 flex justify-between text-[12.5px]">
                  <span className="font-medium text-ink-2 group-hover:text-primary">{s.name}</span>
                  <span className="tabular-nums text-muted">
                    {s.done} / {s.total}
                  </span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="bg-success" style={{ width: `${(s.mastered / s.total) * 100}%` }} />
                  <div className="bg-primary/60" style={{ width: `${((s.done - s.mastered) / s.total) * 100}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <SectionTitle>최근 7일 학습량</SectionTitle>
            <div className="flex h-32 items-end gap-2">
              {week.map((d) => (
                <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-semibold tabular-nums text-muted">{d.n || ''}</span>
                  <div
                    className={`w-full rounded-t-md ${d.label === '오늘' ? 'bg-primary' : 'bg-primary/40'}`}
                    style={{ height: `${Math.max(3, (d.n / maxWeek) * 84)}px`, opacity: d.n ? 1 : 0.2 }}
                  />
                  <span className={`text-[11px] ${d.label === '오늘' ? 'font-bold text-ink' : 'text-muted'}`}>{d.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle>바로 시작</SectionTitle>
            <div className="grid gap-2">
              <Link to="/flash" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium hover:bg-surface-2">
                <Layers size={17} className="text-primary" /> 플래시카드
                <ArrowRight size={15} className="ml-auto text-muted" />
              </Link>
              <Link to="/quiz" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium hover:bg-surface-2">
                <ListChecks size={17} className="text-primary" /> 객관식 퀴즈
                <ArrowRight size={15} className="ml-auto text-muted" />
              </Link>
              <Link to="/words?focus=1" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium hover:bg-surface-2">
                <NotebookPen size={17} className="text-primary" /> 단어 검색 <kbd className="kbd ml-auto">/</kbd>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

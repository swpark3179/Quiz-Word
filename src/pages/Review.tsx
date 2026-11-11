/** 복습(SRS) — 오늘 복습할 단어 + 오늘의 새 단어 */
import { Brain, Layers, ListChecks, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FlashSession } from '../components/FlashSession';
import { QuizSession } from '../components/QuizSession';
import { Button, Card, Empty, PageHeader, SectionTitle } from '../components/ui';
import { mainExam, WORDS } from '../data/words';
import { maxIntervalFor, type StoredCard } from '../lib/srs';
import { dueForecast, reviewPlan as sharedReviewPlan } from '../lib/reviewPlan';
import { dayKey, daysUntil } from '../lib/text';
import { useProgress, type Settings } from '../store/progress';

/** 오늘 할 복습 — 계산은 공용 src/lib/reviewPlan.ts */
export function reviewPlan(cards: Record<string, StoredCard>, settings: Settings, todayNew: number, now = new Date()) {
  // 새 단어는 주 시험에 나온 단어에서, 학습 단계 이상만
  return sharedReviewPlan(WORDS, cards, settings.newPerDay, todayNew, now, { cat: mainExam(settings.exam), minLevel: settings.minLevel });
}

function forecast(cards: Record<string, StoredCard>, days = 7) {
  return dueForecast(cards, days).map((f, i) => ({ label: i === 0 ? '오늘' : `${f.date.getMonth() + 1}/${f.date.getDate()}`, count: f.count }));
}

export function ReviewPage() {
  const navigate = useNavigate();
  const cards = useProgress((s) => s.cards);
  const settings = useProgress((s) => s.settings);
  const todayNew = useProgress((s) => s.days[dayKey()]?.newWords ?? 0);
  const plan = useMemo(() => reviewPlan(cards, settings, todayNew), [cards, settings, todayNew]);
  const fc = useMemo(() => forecast(cards), [cards]);
  const maxFc = Math.max(1, ...fc.map((f) => f.count));
  const total = plan.due.length + plan.fresh.length;
  const examLeft = settings.examDate ? daysUntil(settings.examDate) : undefined;

  return (
    <div className="anim-fade space-y-5">
      <PageHeader
        title="복습"
        desc="잊어버릴 때쯤 다시 보여 주는 간격 반복(FSRS)입니다. 플래시카드·객관식에서 공부한 결과도 모두 여기에 반영돼요."
      />
      <Card className="p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-primary-soft p-5">
            <div className="text-3xl font-bold tabular-nums text-primary-text">{plan.due.length}</div>
            <div className="mt-1 text-[13px] text-ink-2">지금 복습할 단어</div>
          </div>
          <div className="rounded-2xl bg-surface-2 p-5">
            <div className="text-3xl font-bold tabular-nums">{plan.fresh.length}</div>
            <div className="mt-1 text-[13px] text-ink-2">
              오늘의 새 단어 <span className="text-muted">(하루 {settings.newPerDay}개)</span>
            </div>
          </div>
          <div className="col-span-2 rounded-2xl bg-surface-2 p-5 sm:col-span-1">
            <div className="text-3xl font-bold tabular-nums">{examLeft !== undefined && examLeft >= 0 ? `D-${examLeft}` : '—'}</div>
            <div className="mt-1 text-[13px] text-ink-2">
              {settings.examDate ? `시험일 ${settings.examDate} · 최대 간격 ${maxIntervalFor(settings.examDate) > 3650 ? '제한 없음' : `${maxIntervalFor(settings.examDate)}일`}` : '설정에서 시험일을 정하면 그 전에 모두 복습하도록 간격을 맞춰요'}
            </div>
          </div>
        </div>

        {total === 0 ? (
          <div className="mt-6 rounded-xl bg-success-soft px-4 py-3 text-[14px] font-medium text-success">
            오늘 할 복습을 모두 마쳤어요. 더 공부하려면 플래시카드나 객관식을 이용하세요.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate('/review/session?mode=flash')}
              className="group flex items-center gap-4 rounded-2xl border-2 border-line p-5 text-left transition hover:border-primary hover:bg-primary-soft/40"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white dark:text-[#0e1018]">
                <Layers size={20} />
              </div>
              <div className="flex-1">
                <div className="font-bold">플래시카드로 복습</div>
                <div className="text-[12.5px] text-muted">안다 / 모른다로 빠르게 · {total}장</div>
              </div>
              <Play size={18} className="text-muted group-hover:text-primary" />
            </button>
            <button
              onClick={() => navigate('/review/session?mode=quiz')}
              className="group flex items-center gap-4 rounded-2xl border-2 border-line p-5 text-left transition hover:border-primary hover:bg-primary-soft/40"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-ink">
                <ListChecks size={20} />
              </div>
              <div className="flex-1">
                <div className="font-bold">객관식으로 복습</div>
                <div className="text-[12.5px] text-muted">뜻을 골라서 확인 · {total}문제</div>
              </div>
              <Play size={18} className="text-muted group-hover:text-primary" />
            </button>
          </div>
        )}
      </Card>

      <Card className="p-6 sm:p-8">
        <SectionTitle>앞으로 7일 복습 예정</SectionTitle>
        <div className="flex h-36 items-end gap-2">
          {fc.map((f) => (
            <div key={f.label} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11.5px] font-semibold tabular-nums text-muted">{f.count || ''}</span>
              <div className="w-full max-w-10 rounded-t-lg bg-primary/80 transition-all" style={{ height: `${Math.max(3, (f.count / maxFc) * 96)}px`, opacity: f.count ? 1 : 0.15 }} />
              <span className="text-[11.5px] text-muted">{f.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ReviewPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const record = useProgress((s) => s.record);
  const mode = params.get('mode') === 'quiz' ? 'quiz' : 'flash';
  const [ids] = useState<string[]>(() => {
    const { cards, settings, days } = useProgress.getState();
    const plan = reviewPlan(cards, settings, days[dayKey()]?.newWords ?? 0);
    return [...plan.due, ...plan.fresh];
  });

  if (!ids.length) {
    return <Empty icon={<Brain size={22} />} title="지금 복습할 단어가 없어요" action={<Button onClick={() => navigate('/review')}>돌아가기</Button>} />;
  }

  if (mode === 'quiz') {
    return (
      <QuizSession ids={ids} mode="mixed" title="객관식 복습" onExit={() => navigate('/review')} onResult={(id, ok) => record(id, ok, { source: 'review' })} />
    );
  }
  return (
    <FlashSession
      ids={ids}
      title="플래시카드 복습"
      onExit={() => navigate('/review')}
      // 복습에서는 다시 나온 카드의 판정도 SRS 학습 단계에 반영한다
      onAnswer={(id, known) => record(id, known, { source: 'review' })}
    />
  );
}

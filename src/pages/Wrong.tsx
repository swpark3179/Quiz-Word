/** 오답노트 */
import { Layers, ListChecks, NotebookPen, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Empty, PageHeader, PosBadge } from '../components/ui';
import { WindowList } from '../components/WindowList';
import { WORD_BY_ID } from '../data/words';
import { DEFAULT_SCOPE, scopeToParams } from '../lib/scope';
import { timeAgo as ago } from '../lib/text';
import { useProgress } from '../store/progress';
import { setWordNav } from './wordNav';

const WRONG_SCOPE = scopeToParams({ ...DEFAULT_SCOPE, set: 'wrong', status: 'any', count: 0, order: 'random', levels: [] });

export function WrongPage() {
  const wrong = useProgress((s) => s.wrong);
  const graduate = useProgress((s) => s.settings.wrongGraduate);
  const removeWrong = useProgress((s) => s.removeWrong);
  const navigate = useNavigate();
  const [sort, setSort] = useState<'count' | 'recent'>('count');

  const rows = useMemo(
    () =>
      Object.entries(wrong)
        .map(([id, e]) => ({ id, e, w: WORD_BY_ID.get(id) }))
        .filter((r) => r.w)
        .sort((a, b) => (sort === 'count' ? b.e.count - a.e.count || b.e.lastAt - a.e.lastAt : b.e.lastAt - a.e.lastAt)),
    [wrong, sort],
  );

  return (
    <div className="anim-fade">
      <PageHeader
        title="오답노트"
        desc={`객관식에서 틀리거나 플래시카드에서 모른다고 한 단어가 모입니다. 이후 ${graduate}번 연속으로 맞히면 자동으로 빠져요.`}
        right={
          rows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => navigate(`/flash/play?${WRONG_SCOPE}`)}>
                <Layers size={16} /> 오답만 플래시카드
              </Button>
              <Button onClick={() => navigate(`/quiz/play?${WRONG_SCOPE}&mode=meaning`)}>
                <ListChecks size={16} /> 오답만 객관식
              </Button>
            </div>
          )
        }
      />

      {rows.length === 0 ? (
        <Empty icon={<NotebookPen size={22} />} title="오답노트가 비어 있어요" desc="퀴즈를 풀다 틀린 단어가 여기에 쌓입니다." />
      ) : (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="text-[13px] text-muted">{rows.length}개 단어</span>
            <div className="flex gap-1 text-[12.5px]">
              {(
                [
                  ['count', '많이 틀린 순'],
                  ['recent', '최근 순'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setSort(v)}
                  className={`rounded-lg px-2.5 py-1 font-medium ${sort === v ? 'bg-primary-soft text-primary-text' : 'text-muted hover:text-ink'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          {/* 수백 개가 쌓여도 보이는 줄만 그린다 */}
          <WindowList
            items={rows}
            getKey={(r) => r.id}
            renderRow={({ id, e, w }) => (
              <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2/60">
                <Link
                  to={`/word/${id}`}
                  onClick={() =>
                    setWordNav(
                      rows.map((r) => r.id),
                      '오답노트로',
                    )
                  }
                  className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3"
                >
                  <span className="flex items-center gap-2 sm:w-44 sm:shrink-0">
                    <span className="truncate text-[15.5px] font-semibold">{w!.word}</span>
                    <span className="shrink-0 rounded-full bg-danger-soft px-1.5 py-px text-[10.5px] font-bold text-danger sm:hidden">{e.count}회</span>
                  </span>
                  <span className="hidden sm:block">{w!.pos[0] && <PosBadge pos={w!.pos[0]} size="xs" />}</span>
                  <span className="block min-w-0 truncate text-[13px] text-ink-2 sm:flex-1 sm:text-[14px]">{w!.short}</span>
                </Link>
                <div className="hidden shrink-0 text-right text-[12px] text-muted sm:block">
                  <div>
                    <b className="text-danger">{e.count}회</b> 틀림 · {ago(e.lastAt)}
                  </div>
                  <div className="mt-0.5 flex justify-end gap-1">
                    {Array.from({ length: graduate }).map((_, i) => (
                      <span key={i} className={`h-1.5 w-4 rounded-full ${i < e.streak ? 'bg-success' : 'bg-surface-3'}`} />
                    ))}
                  </div>
                </div>
                <button onClick={() => removeWrong(id)} title="오답노트에서 빼기" aria-label={`${w!.word} 오답노트에서 빼기`} className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
        </Card>
      )}
    </div>
  );
}

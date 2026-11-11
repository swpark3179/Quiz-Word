/** 플래시카드 — 범위 고르기 + 진행 */
import { Layers } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FlashSession } from '../components/FlashSession';
import { ScopePicker, StartButton, useStoredScope } from '../components/ScopePicker';
import { Button, Card, Empty, PageHeader } from '../components/ui';
import { WORD_BY_ID, WORDS } from '../data/words';
import { flashSourceName } from '../lib/notebook';
import { scopeFromParams, scopeToParams, selectWords } from '../lib/scope';
import { useProgress } from '../store/progress';

export function FlashPage() {
  const [scope, setScope] = useStoredScope('flash');
  const navigate = useNavigate();
  return (
    <div className="anim-fade">
      <PageHeader title="플래시카드" desc="단어를 보고 안다/모른다를 고르면 뜻과 예문이 나옵니다. 모르는 카드는 몇 장 뒤에 다시 나와요." />
      <Card className="p-6 sm:p-8">
        <ScopePicker scope={scope} onChange={setScope} />
        <div className="mt-6 flex justify-end">
          <StartButton scope={scope} unit="장" onStart={() => navigate(`/flash/play?${scopeToParams(scope)}`)} />
        </div>
      </Card>
    </div>
  );
}

export function FlashPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  // 주소를 직접 열어 들어온 경우에는 돌아갈 이전 화면이 없으므로 범위 고르기로 보낸다
  const exit = () => (location.key === 'default' ? navigate('/flash', { replace: true }) : navigate(-1));
  const record = useProgress((s) => s.record);
  // source: 그만할 때 만드는 학습장 이름 앞부분 (어디서 시작했는지)
  const [{ ids, source }] = useState<{ ids: string[]; source?: string }>(() => {
    const explicit = params.get('ids');
    if (explicit) return { ids: explicit.split(',').filter((id) => WORD_BY_ID.has(id)) };
    const { cards, wrong, notebooks } = useProgress.getState();
    const scope = scopeFromParams(params);
    return { ids: selectWords(WORDS, scope, { cards, wrong, notebooks }).map((w) => w.id), source: flashSourceName(scope, notebooks) };
  });

  if (!ids.length) {
    return (
      <Empty
        icon={<Layers size={22} />}
        title="학습할 단어가 없어요"
        desc="범위나 상태 조건을 바꿔 보세요."
        action={<Button onClick={() => navigate('/flash')}>범위 다시 고르기</Button>}
      />
    );
  }

  return (
    <FlashSession
      ids={ids}
      title="플래시카드"
      source={source}
      onExit={exit}
      onAnswer={(id, known, first) => {
        // SRS·통계에는 이 세션의 첫 판정만 반영한다
        if (first) record(id, known, { source: 'flash' });
      }}
    />
  );
}

/** 학습 범위 고르기 — 플래시카드·객관식 시작 화면 */
import { Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EXAMS, examName, quizSources, WORDS } from '../data/words';
import { LEVELS } from '../lib/schema';
import { filterScope, normalizeScope, type Scope } from '../lib/scope';
import { useProgress } from '../store/progress';
import { isModalOpen, isTyping } from './Dialog';
import { Button, Kbd } from './ui';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
        active ? 'border-primary bg-primary-soft text-primary-text' : 'border-line bg-surface text-ink-2 hover:border-primary/40 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="w-20 shrink-0 pt-1.5 text-[13px] font-semibold text-muted">{label}</div>
      <div className="flex flex-1 flex-wrap gap-2">{children}</div>
    </div>
  );
}

const storageKey = (k: string) => `quiz-word:scope:${k}`;

/** 마지막으로 고른 범위를 기억한다 (이 브라우저에만). 예전 형식으로 저장된 값은 읽을 때 새 형식으로 고친다 */
export function useStoredScope(key: string): [Scope, (s: Scope) => void] {
  const [scope, setScope] = useState<Scope>(() => {
    try {
      const raw = localStorage.getItem(storageKey(key));
      return normalizeScope(raw ? JSON.parse(raw) : undefined, EXAMS);
    } catch {
      return normalizeScope(undefined, EXAMS);
    }
  });
  const update = (s: Scope) => {
    setScope(s);
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(s));
    } catch {
      /* 저장 못 해도 동작에는 문제 없음 */
    }
  };
  return [scope, update];
}

/** 범위 조건에 맞는 단어 수와 실제로 학습할 수 (개수 제한 반영) */
export function useScopeCount(scope: Scope) {
  const cards = useProgress((s) => s.cards);
  const wrong = useProgress((s) => s.wrong);
  const matched = useMemo(() => filterScope(WORDS, scope, { cards, wrong }).length, [scope, cards, wrong]);
  return { matched, selected: scope.count > 0 ? Math.min(matched, scope.count) : matched };
}

export function ScopePicker({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const { matched } = useScopeCount(scope);
  const set = (patch: Partial<Scope>) => onChange({ ...scope, ...patch });
  const files = scope.set === 'exam' ? quizSources(scope.cat) : [];
  const selectCls = 'max-w-full rounded-full border px-3.5 py-1.5 text-[13px] font-medium outline-none';

  return (
    <div className="space-y-4">
      <Row label="시험">
        {EXAMS.map((e) => (
          <Chip key={e.id} active={scope.set === 'exam' && scope.cat === e.id} onClick={() => set({ set: 'exam', cat: e.id, file: undefined })}>
            {e.name}
          </Chip>
        ))}
        <Chip active={scope.set === 'all'} onClick={() => set({ set: 'all', cat: undefined, file: undefined })}>
          모든 단어 (확장 포함)
        </Chip>
        <Chip active={scope.set === 'wrong'} onClick={() => set({ set: 'wrong', cat: undefined, file: undefined })}>
          오답노트
        </Chip>
      </Row>
      {/* 문제 파일은 시험을 고른 뒤에 그 시험 안에서 고른다 */}
      {scope.set === 'exam' && files.length > 0 && (
        <Row label="문제">
          <select
            aria-label="문제 파일"
            value={scope.file ?? ''}
            onChange={(e) => set({ file: e.target.value || undefined })}
            className={`${selectCls} ${scope.file ? 'border-primary bg-primary-soft text-primary-text' : 'border-line bg-surface text-ink-2'}`}
          >
            <option value="">{examName(scope.cat)} 전체</option>
            {files.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Row>
      )}
      {scope.set !== 'wrong' && (
        <Row label="단계">
          <select
            aria-label="단계"
            value={scope.minLevel}
            onChange={(e) => set({ minLevel: Number(e.target.value) })}
            className={`${selectCls} ${scope.minLevel > 1 ? 'border-primary bg-primary-soft text-primary-text' : 'border-line bg-surface text-ink-2'}`}
          >
            {LEVELS.map((l) => (
              <option key={l.level} value={l.level}>
                {l.level === 1 ? '모든 단계 (쉬운 단어 포함)' : l.level === LEVELS.length ? `${l.level}단계만 (${l.name})` : `${l.level}단계 이상 (${l.name}~)`}
              </option>
            ))}
          </select>
        </Row>
      )}
      <Row label="상태">
        {(
          [
            ['unmastered', '아직 못 익힌 단어'],
            ['new', '새 단어'],
            ['learning', '학습 중'],
            ['any', '전체'],
          ] as const
        ).map(([v, l]) => (
          <Chip key={v} active={scope.status === v} onClick={() => set({ status: v })}>
            {l}
          </Chip>
        ))}
      </Row>
      <Row label="개수">
        {[20, 50, 100, 0].map((n) => (
          <Chip key={n} active={scope.count === n} onClick={() => set({ count: n })}>
            {n === 0 ? '전부' : `${n}개`}
          </Chip>
        ))}
      </Row>
      <Row label="순서">
        {(
          [
            ['freq', '자주 나온 순'],
            ['random', '무작위'],
            ['new-first', '새 단어 먼저'],
          ] as const
        ).map(([v, l]) => (
          <Chip key={v} active={scope.order === v} onClick={() => set({ order: v })}>
            {l}
          </Chip>
        ))}
      </Row>
      <div className={`rounded-xl px-4 py-2.5 text-[13px] ${matched ? 'bg-surface-2 text-ink-2' : 'bg-warning-soft text-warning'}`} role="status">
        {matched ? (
          <>
            조건에 맞는 단어 <b className="text-ink">{matched.toLocaleString()}</b>개
            {scope.count > 0 && matched > scope.count && <> 중 {scope.count}개를 학습합니다</>}
          </>
        ) : scope.set === 'wrong' ? (
          '오답노트가 비어 있어요. 다른 범위를 골라 주세요.'
        ) : (
          '조건에 맞는 단어가 없어요. 범위나 상태를 바꿔 주세요.'
        )}
      </div>
    </div>
  );
}

/** 시작 버튼 — 학습할 단어 수를 보여 주고, 단어가 없으면 누를 수 없다. Enter 로도 시작한다. */
export function StartButton({ scope, unit, onStart }: { scope: Scope; unit: '장' | '문제'; onStart: () => void }) {
  const { selected } = useScopeCount(scope);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e) || isModalOpen()) return;
      // 버튼·링크에 포커스가 있으면 Enter 는 그 버튼을 누르는 것이다
      if ((e.target as HTMLElement).closest('button, a')) return;
      if (selected > 0) onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onStart]);
  return (
    <Button variant="primary" className="px-6" disabled={selected === 0} onClick={onStart}>
      <Play size={16} /> {selected > 0 ? `${selected.toLocaleString()}${unit} 시작하기` : '시작하기'} <Kbd>Enter</Kbd>
    </Button>
  );
}

/** 학습 범위 고르기 — 플래시카드·객관식 시작 화면 */
import { useMemo, useState } from 'react';
import { QUIZ_SOURCES, WORDS } from '../data/words';
import { DEFAULT_SCOPE, filterScope, type Scope } from '../lib/scope';
import { useProgress } from '../store/progress';

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

/** 마지막으로 고른 범위를 기억한다 (이 브라우저에만) */
export function useStoredScope(key: string): [Scope, (s: Scope) => void] {
  const [scope, setScope] = useState<Scope>(() => {
    try {
      const raw = localStorage.getItem(storageKey(key));
      return raw ? { ...DEFAULT_SCOPE, ...JSON.parse(raw) } : DEFAULT_SCOPE;
    } catch {
      return DEFAULT_SCOPE;
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

export function ScopePicker({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const cards = useProgress((s) => s.cards);
  const wrong = useProgress((s) => s.wrong);
  const matched = useMemo(() => filterScope(WORDS, scope, { cards, wrong }).length, [scope, cards, wrong]);
  const set = (patch: Partial<Scope>) => onChange({ ...scope, ...patch });

  return (
    <div className="space-y-4">
      <Row label="범위">
        <Chip active={scope.set === 'core'} onClick={() => set({ set: 'core', file: undefined })}>
          CCAR-F 전체
        </Chip>
        <Chip active={scope.set === 'all'} onClick={() => set({ set: 'all', file: undefined })}>
          확장 단어 포함
        </Chip>
        <Chip active={scope.set === 'wrong'} onClick={() => set({ set: 'wrong', file: undefined })}>
          오답노트
        </Chip>
        <select
          value={scope.set === 'file' ? scope.file : ''}
          onChange={(e) => (e.target.value ? set({ set: 'file', file: e.target.value }) : set({ set: 'core', file: undefined }))}
          className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium outline-none ${
            scope.set === 'file' ? 'border-primary bg-primary-soft text-primary-text' : 'border-line bg-surface text-ink-2'
          }`}
        >
          <option value="">문제 파일별…</option>
          {QUIZ_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Row>
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
      <Row label="옵션">
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={scope.includeBasic}
            onChange={(e) => set({ includeBasic: e.target.checked })}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          쉬운 기초 단어도 포함
        </label>
      </Row>
      <div className="rounded-xl bg-surface-2 px-4 py-2.5 text-[13px] text-ink-2">
        조건에 맞는 단어 <b className="text-ink">{matched.toLocaleString()}</b>개
        {scope.count > 0 && matched > scope.count && <> 중 {scope.count}개를 학습합니다</>}
      </div>
    </div>
  );
}

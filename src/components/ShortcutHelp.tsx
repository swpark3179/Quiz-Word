/** 단축키 도움말 — 어디서든 ? 로 연다 */
import { Fragment } from 'react';
import { Dialog } from './Dialog';
import { Kbd } from './ui';

/** keys 여러 개의 관계 — alt: 아무거나 · seq: 차례로 누름 · range: 범위 */
type Row = { keys: string[]; label: string; kind?: 'alt' | 'seq' | 'range' };
const SEP = { alt: '·', seq: '→', range: '~' } as const;

const go = (key: string, label: string): Row => ({ keys: ['G', key], label, kind: 'seq' });

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: '어디서나',
    rows: [
      { keys: ['/'], label: '단어 검색' },
      { keys: ['?'], label: '이 도움말' },
      go('H', '홈'),
      go('W', '단어장'),
      go('F', '플래시카드'),
      go('Q', '객관식'),
      go('R', '복습'),
      go('N', '학습장'),
      go('O', '오답노트'),
      go('S', '설정'),
    ],
  },
  {
    title: '단어장 · 단어 상세',
    rows: [
      { keys: ['↑', '↓'], label: '검색 결과에서 단어 고르기' },
      { keys: ['Enter'], label: '고른 단어 열기' },
      { keys: ['Esc'], label: '검색어 지우기' },
      { keys: ['←', '→'], label: '이전 · 다음 단어 (상세 화면)' },
      { keys: ['Backspace'], label: '목록으로 돌아가기' },
      { keys: ['P'], label: '발음 듣기' },
    ],
  },
  {
    title: '학습장',
    rows: [
      { keys: ['/'], label: '담을 단어 검색' },
      { keys: ['↑', '↓'], label: '검색 결과에서 단어 고르기' },
      { keys: ['Enter'], label: '고른 단어 담기' },
      { keys: ['Esc'], label: '검색어 지우기' },
    ],
  },
  {
    title: '플래시카드',
    rows: [
      { keys: ['←', '1'], label: '모른다' },
      { keys: ['→', '2'], label: '안다' },
      { keys: ['↑', '↓'], label: '판정 바꾸기 (뜻을 본 뒤)' },
      { keys: ['Space', 'Enter'], label: '다음 카드' },
      { keys: ['P'], label: '발음 듣기' },
      { keys: ['Esc'], label: '그만하기' },
    ],
  },
  {
    title: '객관식',
    rows: [
      { keys: ['1', '5'], label: '보기 선택', kind: 'range' },
      { keys: ['Enter', 'Space'], label: '다음 문제' },
      { keys: ['P'], label: '발음 듣기' },
      { keys: ['Esc'], label: '그만하기' },
    ],
  },
];

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="키보드 단축키" width="44rem">
      <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-[12.5px] font-bold tracking-wide text-muted">{g.title}</h3>
            <dl className="space-y-1.5">
              {g.rows.map(({ keys, label, kind = 'alt' }) => (
                <div key={label} className="flex items-center justify-between gap-4 text-[13.5px]">
                  <dt className="text-ink-2">{label}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {keys.map((k, i) => (
                      <Fragment key={k}>
                        {i > 0 && <span className="text-[11px] text-muted">{SEP[kind]}</span>}
                        <Kbd>{k}</Kbd>
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="mt-6 text-[12.5px] leading-relaxed text-muted">
        <Kbd>G</Kbd> 를 누른 뒤 이어서 글자를 누르면 그 화면으로 갑니다. 글자를 입력하는 칸과 학습 중에는 화면 이동 단축키가 꺼집니다.
      </p>
    </Dialog>
  );
}

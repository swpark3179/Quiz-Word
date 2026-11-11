import { describe, expect, it } from 'vitest';
import { buildContextQuestion, buildMeaningQuestion, pickDistractors } from '../distractors';
import { answer, createQueue, currentId, isFinished, split, summary } from '../flashQueue';
import { normalizeWord, shortFromMeaning } from '../normalize';
import type { Word } from '../schema';
import { filterScope, notebookScope, scopeFromParams, scopeToParams, selectWords } from '../scope';
import { searchWords } from '../search';
import { maxIntervalFor, review, statusOf } from '../srs';
import { dice, sharesGloss } from '../text';

/** 고정 난수 (재현 가능한 테스트) */
function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function W(p: Partial<Word> & Pick<Word, 'id' | 'short'>): Word {
  return normalizeWord({
    word: p.id,
    pos: ['동사'],
    meaning: p.short,
    domain: '실행·처리',
    tier: 'core',
    ...p,
  });
}

const POOL: Word[] = [
  W({ id: 'address', short: '다루다, 해결하다', synonyms: ['handle', 'tackle'], senses: [
    { pos: '동사', ko: '(문제를) 다루다, 해결하다' },
    { pos: '명사', ko: '주소' },
    { pos: '동사', ko: '(사람에게) 말을 걸다, 연설하다' },
  ] }),
  W({ id: 'handle', short: '처리하다, 다루다' }), // 동의어 — 오답 보기로 나오면 안 됨
  W({ id: 'resolve', short: '해결하다' }), // 같은 뜻 조각 — 나오면 안 됨
  W({ id: 'execute', short: '실행하다' }),
  W({ id: 'invoke', short: '호출하다' }),
  W({ id: 'retry', short: '다시 시도하다' }),
  W({ id: 'escalate', short: '(상위 담당자에게) 넘기다', domain: '이동·전달' }),
  W({ id: 'validate', short: '검증하다', domain: '확인·검증' }),
  W({ id: 'merge', short: '병합하다', domain: '연결·통합' }),
  W({ id: 'latency', short: '지연 시간', pos: ['명사'] }),
  W({ id: 'payload', short: '전달 데이터', pos: ['명사'] }),
  W({ id: 'robust', short: '견고한', pos: ['형용사'] }),
];

describe('distractors', () => {
  const target = POOL[0];

  it('정답 1개 + 오답 3개, 보기 중복 없음', () => {
    for (let seed = 1; seed < 30; seed++) {
      const q = buildMeaningQuestion(target, POOL, 4, seeded(seed));
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.correct)).toHaveLength(1);
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
    }
  });

  it('동의어·같은 뜻 조각을 가진 단어는 오답 보기에서 뺀다', () => {
    for (let seed = 1; seed < 30; seed++) {
      const wrong = pickDistractors(target, target.short, POOL, 3, seeded(seed));
      const ids = wrong.map((o) => o.wordId);
      expect(ids).not.toContain('handle');
      expect(ids).not.toContain('resolve');
    }
  });

  it('같은 품사를 우선한다', () => {
    for (let seed = 1; seed < 30; seed++) {
      const wrong = pickDistractors(target, target.short, POOL, 3, seeded(seed));
      for (const o of wrong) expect(POOL.find((w) => w.id === o.wordId)!.pos[0]).toBe('동사');
    }
  });

  it('문맥 모드: 문장에 쓰이지 않은 같은 품사 뜻은 오답으로 쓰지 않는다 (사실상 동의어 방지)', () => {
    const robust = W({
      id: 'robust',
      short: '견고한',
      pos: ['형용사'],
      senses: [
        { pos: '형용사', ko: '견고한, 쉽게 깨지지 않는' },
        { pos: '형용사', ko: '튼튼한, 강건한' },
      ],
    });
    const ctx = [{ src: 'mock04', q: 2, en: 'Make it more robust.', surface: 'robust', pos: '형용사', sense: '견고한, 쉽게 깨지지 않는' }];
    for (let seed = 1; seed < 20; seed++) {
      const q = buildContextQuestion(robust, POOL, ctx, 4, seeded(seed));
      expect(q.options.map((o) => o.text)).not.toContain('튼튼한, 강건한');
    }
  });

  it('문맥 모드는 같은 단어의 다른 뜻을 먼저 오답으로 쓴다', () => {
    const ctx = [{ src: 'mock04', q: 1, en: 'Which practice best addresses this?', surface: 'addresses', pos: '동사', sense: '(문제를) 다루다, 해결하다' }];
    const q = buildContextQuestion(target, POOL, ctx, 4, seeded(3));
    expect(q.mode).toBe('context');
    const texts = q.options.map((o) => o.text);
    expect(texts).toContain('주소');
    expect(q.options.find((o) => o.correct)!.text).toBe('(문제를) 다루다, 해결하다');
  });
});

describe('text', () => {
  it('dice: 같은 뜻은 1, 전혀 다른 뜻은 0', () => {
    expect(dice('해결하다', '해결하다')).toBe(1);
    expect(dice('지연 시간', '병합하다')).toBe(0);
  });
  it('sharesGloss: 쉼표 조각이 겹치면 같은 뜻', () => {
    expect(sharesGloss('다루다, 해결하다', '해결하다')).toBe(true);
    expect(sharesGloss('다루다, 해결하다', '실행하다')).toBe(false);
  });
});

describe('flashQueue', () => {
  it('모른다 카드는 몇 장 뒤에 다시 나오고, 안다를 고르면 끝난다', () => {
    let q = createQueue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    q = answer(q, false, () => 0); // a 모름 → 4장 뒤
    expect(q.order.indexOf('a')).toBe(3);
    const seen: string[] = [];
    let guard = 0;
    while (!isFinished(q) && guard++ < 50) {
      seen.push(currentId(q)!);
      q = answer(q, true);
    }
    expect(isFinished(q)).toBe(true);
    expect(seen.filter((x) => x === 'a')).toHaveLength(1);
    const s = summary(q);
    expect(s.total).toBe(8);
    expect(s.unknown).toEqual(['a']);
  });

  it('연속으로 모르면 간격이 3장으로 줄고, 남은 카드가 적으면 맨 뒤로', () => {
    let q = createQueue(['a', 'b']);
    q = answer(q, false, () => 0.99);
    expect(q.order).toEqual(['b', 'a']);
    q = answer(q, true);
    q = answer(q, false); // a 두 번째 실패, 남은 카드 없음 → 바로 다시
    expect(q.order).toEqual(['a']);
    q = answer(q, true);
    expect(isFinished(q)).toBe(true);
    expect(q.first.a).toBe(false);
  });

  it('하다 만 지점에서 나누기 — 진행 막대 숫자와 같고, 모른 카드는 남은 쪽', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    let q = createQueue(ids);
    q = answer(q, true); // a 앎
    q = answer(q, false, () => 0); // b 모름 → 다시 나올 차례
    q = answer(q, true); // c 앎
    q = answer(q, true); // d 앎
    const { done, left } = split(q);
    expect(done).toEqual(['a', 'c', 'd']);
    expect(done.length).toBe(q.done.length); // 막대의 "3 / 10"
    expect(left).toContain('b');
    expect(left[0]).toBe(currentId(q)); // 나올 순서 그대로
    expect(new Set(left).size).toBe(left.length);
    expect([...done, ...left].sort()).toEqual(ids);
  });
});

describe('srs', () => {
  const now = new Date('2026-11-09T09:00:00');

  it('새 카드에 again 이면 금방 다시, good 을 이어 가면 간격이 늘어난다', () => {
    const again = review(undefined, 'again', { now });
    expect(new Date(again.due).getTime() - now.getTime()).toBeLessThan(15 * 60_000);
    let c = review(undefined, 'good', { now });
    let t = now;
    for (let i = 0; i < 4; i++) {
      t = new Date(c.due);
      c = review(c, 'good', { now: t });
    }
    expect(c.scheduled_days).toBeGreaterThan(3);
    expect(statusOf(undefined)).toBe('new');
  });

  it('시험일이 있으면 간격이 남은 일수를 넘지 않는다', () => {
    const exam = '2026-11-14';
    expect(maxIntervalFor(exam, now)).toBe(5);
    let c = review(undefined, 'easy', { now, examDate: exam });
    expect(c.scheduled_days).toBeLessThanOrEqual(5);
    // 시험 전에 다시 복습하는 경우에도 남은 일수를 넘지 않는다
    c = review(c, 'easy', { now: new Date('2026-11-11T09:00:00'), examDate: exam });
    expect(c.scheduled_days).toBeLessThanOrEqual(3);
    let t = new Date(c.due);
    let steps = 0;
    while (maxIntervalFor(exam, t) < 36500 && steps++ < 10) {
      c = review(c, 'easy', { now: t, examDate: exam });
      expect(c.scheduled_days).toBeLessThanOrEqual(maxIntervalFor(exam, t));
      t = new Date(c.due);
    }
  });
});

describe('search', () => {
  const words = [
    W({ id: 'escalate', short: '넘기다', forms: ['escalation', 'escalated'], freq: 10 }),
    W({ id: 'scale', short: '규모', freq: 3 }),
    W({ id: 'escalation-path', word: 'escalation path', short: '이관 경로', freq: 1 }),
  ];
  it('정확 일치 > 접두 > 변화형 > 포함', () => {
    expect(searchWords(words, 'escalate').map((w) => w.id)[0]).toBe('escalate');
    expect(searchWords(words, 'escalation').map((w) => w.id)).toEqual(['escalation-path', 'escalate']);
    expect(searchWords(words, 'scal').map((w) => w.id)).toEqual(['scale', 'escalate', 'escalation-path']);
  });
  it('한글로 뜻 검색', () => {
    expect(searchWords(words, '넘기').map((w) => w.id)).toEqual(['escalate']);
  });
});

describe('scope · 학습장', () => {
  const words = [
    W({ id: 'escalate', short: '넘기다', freq: 10 }),
    W({ id: 'make', short: '만들다', basic: true }),
    W({ id: 'latency', short: '지연 시간', tier: 'extra' }),
    W({ id: 'robust', short: '견고한' }),
  ];
  const notebooks = [
    { id: 'nb-1', ids: ['make', 'latency', 'gone'] },
    { id: 'nb-2', ids: ['robust'] },
  ];
  it('그 학습장 단어만 고른다 (기초·확장 단어도 포함, 없는 단어 id 는 무시)', () => {
    const got = filterScope(words, notebookScope('nb-1'), { cards: {}, wrong: {}, notebooks }).map((w) => w.id);
    expect(got.sort()).toEqual(['latency', 'make']);
    expect(selectWords(words, notebookScope('nb-2'), { cards: {}, wrong: {}, notebooks }).map((w) => w.id)).toEqual(['robust']);
  });
  it('없는 학습장이면 빈 목록', () => {
    expect(filterScope(words, notebookScope('nb-x'), { cards: {}, wrong: {}, notebooks })).toEqual([]);
    expect(filterScope(words, notebookScope('nb-1'), { cards: {}, wrong: {} })).toEqual([]);
  });
  it('주소 쿼리로 바꿨다 되돌려도 학습장 id 가 남는다', () => {
    const back = scopeFromParams(new URLSearchParams(scopeToParams(notebookScope('nb-1'))));
    expect(back).toEqual(notebookScope('nb-1'));
  });
});

describe('normalize', () => {
  it('직접 추가한 최소 항목을 채운다', () => {
    const w = normalizeWord({ id: 'idempotent', word: 'idempotent', pos: '형용사', meaning: '멱등의 — 여러 번 실행해도 결과가 같은' });
    expect(w.pos).toEqual(['형용사']);
    expect(w.short).toBe('멱등의');
    expect(w.senses).toHaveLength(1);
    expect(w.tier).toBe('extra');
    expect(w.domain).toBe('일반');
  });
  it('외우기(memory): 빈 조각을 걷어 내고 그대로 넘긴다', () => {
    const w = normalizeWord({
      id: 'defer',
      word: 'defer',
      pos: '동사',
      meaning: '미루다',
      memory: {
        roots: [{ part: 'de-', ko: '떨어져' }, { part: ' ', ko: '' }, { part: 'fer', ko: '나르다' }],
        origin: ' ',
        story: ' 저만치 날라 둔다 → 미루다 ',
        family: ['transfer', ''],
      },
    });
    expect(w.memory).toEqual({
      roots: [{ part: 'de-', ko: '떨어져' }, { part: 'fer', ko: '나르다' }],
      story: '저만치 날라 둔다 → 미루다',
      family: ['transfer'],
    });
  });
  it('외우기(memory): 장면도 발음 연상도 없으면 버린다', () => {
    const w = normalizeWord({ id: 'x', word: 'x', pos: '명사', meaning: '엑스', memory: { roots: [{ part: 'x', ko: '엑스' }], story: '  ' } });
    expect(w.memory).toBeUndefined();
    expect('memory' in w).toBe(false);
  });
  it('shortFromMeaning: ①② 와 영어 괄호를 뺀다', () => {
    expect(shortFromMeaning('① 받아들이다, 감수하다 ② 허용하다 (acceptable: 허용할 수 있는)')).toBe('받아들이다, 감수하다');
  });
});

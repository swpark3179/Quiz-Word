import { describe, expect, it } from 'vitest';
import { buildContextQuestion, buildMeaningQuestion, pickDistractors } from '../distractors';
import { answer, createQueue, currentId, isFinished, split, summary } from '../flashQueue';
import { assembleExams, buildWordData, freqIn, inExam, type ExamData } from '../exams';
import { normalizeWord, shortFromMeaning, type RawWord } from '../normalize';
import { reviewPlan } from '../reviewPlan';
import type { ExamInfo, Word } from '../schema';
import { DEFAULT_SCOPE, filterScope, normalizeScope, notebookScope, scopeFromParams, scopeToParams, selectWords } from '../scope';
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

/** 테스트용 단어 — freq·occ 같은 시험 값은 사전 항목에 없으므로 만든 뒤에 덮어쓴다 */
function W(p: Partial<Word> & Pick<Word, 'id' | 'short'>): Word {
  const { freq, occ, contexts, notes, level, ...raw } = p;
  const w = normalizeWord({ word: p.id, pos: ['동사'], meaning: p.short, domain: '실행·처리', level: level ?? 4, ...raw });
  return { ...w, ...(freq !== undefined ? { freq } : {}), ...(occ ? { occ } : {}), ...(contexts ? { contexts } : {}), ...(notes ? { notes } : {}) };
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
    const ctx = [{ cat: 'ccar-f', src: 'mock04', q: 2, en: 'Make it more robust.', surface: 'robust', pos: '형용사', sense: '견고한, 쉽게 깨지지 않는' }];
    for (let seed = 1; seed < 20; seed++) {
      const q = buildContextQuestion(robust, POOL, ctx, 4, seeded(seed));
      expect(q.options.map((o) => o.text)).not.toContain('튼튼한, 강건한');
    }
  });

  it('문맥 모드는 같은 단어의 다른 뜻을 먼저 오답으로 쓴다', () => {
    const ctx = [{ cat: 'ccar-f', src: 'mock04', q: 1, en: 'Which practice best addresses this?', surface: 'addresses', pos: '동사', sense: '(문제를) 다루다, 해결하다' }];
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
    W({ id: 'make', short: '만들다', level: 1 }),
    W({ id: 'latency', short: '지연 시간' }),
    W({ id: 'robust', short: '견고한' }),
  ];
  const notebooks = [
    { id: 'nb-1', ids: ['make', 'latency', 'gone'] },
    { id: 'nb-2', ids: ['robust'] },
  ];
  it('그 학습장 단어만 고른다 (쉬운 단어·문제 밖 단어도 포함, 없는 단어 id 는 무시)', () => {
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

/** 시험 두 개짜리 작은 데이터 */
const DICT: RawWord[] = [
  { id: 'escalate', word: 'escalate', level: 5, pos: '동사', meaning: '넘기다', senses: [{ pos: '동사', ko: '넘기다' }, { pos: '동사', ko: '악화되다' }], forms: ['escalated'] },
  { id: 'make', word: 'make', level: 1, pos: '동사', meaning: '만들다' },
  { id: 'latency', word: 'latency', level: 6, pos: '명사', meaning: '지연 시간' },
  { id: 'robust', word: 'robust', level: 5, pos: '형용사', meaning: '견고한' },
  { id: 'quota', word: 'quota', level: 5, pos: '명사', meaning: '할당량' },
];
const EXAM_A: ExamData = {
  id: 'exam-a',
  name: '시험 A',
  order: 1,
  sources: [{ id: 'set1', name: '1회' }, { id: 'set2', name: '2회' }, { id: 'book', name: '단어장 예문', kind: 'wordbook' }],
  index: { escalate: { set1: 3, set2: 1 }, make: { set1: 9 }, latency: { set2: 2, book: 5 }, ghost: { set1: 1 } },
  examples: {
    set1: { escalate: [{ n: 1, q: 4, en: 'Escalate it to a human.', surface: 'Escalate', pos: '동사', sense: '넘기다', ko: '사람에게 넘긴다.' }] },
    set2: { escalate: [{ n: 0, q: 7, en: 'The outage escalated.', surface: 'escalated', pos: '동사', sense: '악화되다' }] },
    book: { robust: [{ en: 'A robust design.', surface: 'robust', pos: '형용사', sense: '견고한' }] },
  },
  sentences: {
    set1: [{ q: 1, en: 'We make a plan.' }, { q: 4, en: 'Escalate it to a human.' }],
    set2: [{ q: 2, en: 'High latency hurts.', ko: '지연이 크면 곤란하다.' }, { q: 3, en: 'Latency rose again.' }],
  },
  notes: { escalate: '시험 A 노트' },
};
const EXAM_B: ExamData = {
  id: 'exam-b',
  name: '시험 B',
  order: 2,
  sources: [{ id: 'set1', name: 'B 1회' }],
  index: { quota: { set1: 4 }, escalate: { set1: 2 } },
  examples: { set1: { quota: [{ q: 1, en: 'The quota was hit.', surface: 'quota', pos: '명사', sense: '할당량' }] } },
  sentences: { set1: [{ q: 5, en: 'Escalate when the quota is hit.' }, { q: 6, en: 'A robust retry helps.' }] },
  notes: { escalate: '시험 B 노트' },
};

describe('시험 데이터 (공통 사전 + 시험별 예문)', () => {
  const data = buildWordData(DICT, [EXAM_B, EXAM_A]);
  const w = (id: string) => data.WORD_BY_ID.get(id)!;

  it('시험은 order 순, 문제 파일 목록에서 예문 전용 파일은 뺀다', () => {
    expect(data.EXAMS.map((e) => e.id)).toEqual(['exam-a', 'exam-b']);
    expect(data.quizSources('exam-a').map((s) => s.id)).toEqual(['set1', 'set2']);
    expect(data.examName('exam-b')).toBe('시험 B');
  });

  it('출현 횟수: 시험·문제 파일별, 예문 전용 파일과 사전에 없는 단어는 세지 않는다', () => {
    expect(w('escalate').freq).toBe(6);
    expect(freqIn(w('escalate'), 'exam-a')).toBe(4);
    expect(freqIn(w('escalate'), 'exam-a', 'set2')).toBe(1);
    expect(freqIn(w('escalate'), 'exam-b')).toBe(2);
    expect(w('latency').occ).toEqual({ 'exam-a': { set2: 2 } });
    expect(inExam(w('latency'), 'exam-a', 'set1')).toBe(false);
    expect(inExam(w('quota'), 'exam-a')).toBe(false);
    expect(inExam(w('robust'))).toBe(true);
    expect(w('robust').freq).toBe(0);
    expect(data.WORDS_BY_FREQ[0].id).toBe('make');
  });

  it('예문은 단어마다 정해 둔 순서(n)대로, 시험별 노트가 붙는다', () => {
    expect(w('escalate').contexts.map((c) => `${c.cat}/${c.src}#${c.q}`)).toEqual(['exam-a/set2#7', 'exam-a/set1#4']);
    expect(w('escalate').notes).toEqual([{ cat: 'exam-a', md: '시험 A 노트' }, { cat: 'exam-b', md: '시험 B 노트' }]);
  });

  it('보고 있는 문제 파일의 예문 → 같은 시험의 예문 순', () => {
    expect(data.contextsOf(w('escalate'), 4, { cat: 'exam-a', file: 'set1' }).map((c) => c.src)).toEqual(['set1', 'set2']);
    expect(data.contextsOf(w('escalate'), 4, { cat: 'exam-a' }).map((c) => c.src)).toEqual(['set2', 'set1']);
    expect(data.contextsOf(w('escalate'), 1, { cat: 'exam-a', file: 'set1' })).toHaveLength(1);
  });

  it('같은 시험에 붙은 예문이 없으면 그 시험 문장에서 자동으로 찾는다 (auto)', () => {
    const got = data.contextsOf(w('escalate'), 4, { cat: 'exam-b' });
    expect(got.map((c) => [c.cat, c.q, c.auto])).toEqual([['exam-b', 5, true]]);
    expect(got[0].sense).toBe('넘기다');
    const lat = data.contextsOf(w('latency'), 4, { cat: 'exam-a', file: 'set2' });
    expect(lat.map((c) => c.surface)).toEqual(['latency', 'Latency']);
    expect(lat[0].ko).toBe('지연이 크면 곤란하다.');
  });

  it('같은 시험에서 하나도 못 찾으면 다른 시험의 예문을 보여 준다', () => {
    expect(data.contextsOf(w('quota'), 4, { cat: 'exam-a' }).map((c) => c.cat)).toEqual(['exam-b']);
    // robust: 시험 A 에는 단어장 예문이 있고, 시험 B 에는 문장만 있다
    expect(data.contextsOf(w('robust'), 4, { cat: 'exam-b' }).map((c) => [c.cat, !!c.auto])).toEqual([['exam-b', true]]);
    expect(data.contextsOf(w('robust'), 4).map((c) => [c.cat, c.src])).toEqual([['exam-a', 'book']]);
  });

  it('더 보기: 붙어 있는 예문과 같은 문장은 빼고, 보고 있는 시험 것부터', () => {
    expect(data.corpusExamples(w('escalate'), 12, { cat: 'exam-b' }).map((c) => `${c.cat}#${c.q}`)).toEqual(['exam-b#5']);
    expect(data.corpusExamples(w('make')).map((c) => c.en)).toEqual(['We make a plan.']);
  });

  it('출처 표시: 다른 시험의 예문에는 시험 이름을 붙인다', () => {
    expect(data.sourceLabel({ cat: 'exam-a', src: 'set1', q: 4 }, { cat: 'exam-a' })).toBe('1회 · 문제 4');
    expect(data.sourceLabel({ cat: 'exam-b', src: 'set1', q: 1 }, { cat: 'exam-a' })).toBe('시험 B · B 1회 · 문제 1');
    expect(data.sourceLabel({ cat: 'exam-a', src: 'book', q: 0 }, { cat: 'exam-a' })).toBe('단어장 예문');
  });

  it('파일 경로 목록을 시험 데이터로 묶는다', () => {
    const got = assembleExams([
      ['../../data/exams/exam-a/exam.json', { id: 'exam-a', name: '시험 A', order: 1, sources: EXAM_A.sources }],
      ['../../data/exams/exam-a/index.json', EXAM_A.index],
      ['../../data/exams/exam-a/notes.json', EXAM_A.notes],
      ['../../data/exams/exam-a/examples/set1.json', EXAM_A.examples.set1],
      ['../../data/exams/exam-a/examples/set2.json', EXAM_A.examples.set2],
      ['../../data/exams/exam-a/examples/book.json', EXAM_A.examples.book],
      ['..\\data\\exams\\exam-a\\sentences\\set1.json', EXAM_A.sentences.set1],
      ['../../data/exams/exam-a/sentences/set2.json', EXAM_A.sentences.set2],
    ]);
    expect(got).toEqual([EXAM_A]);
  });

  it('학습 범위: 시험·문제 파일·단계로 거르고, 자주 나온 순은 그 범위의 횟수로', () => {
    const p = { cards: {}, wrong: {} };
    const ids = (scope: Parameters<typeof filterScope>[1]) => selectWords(data.WORDS, { ...scope, status: 'any', count: 0 }, p).map((x) => x.id);
    expect(ids({ ...DEFAULT_SCOPE, cat: 'exam-a' })).toEqual(['escalate', 'latency']);
    expect(ids({ ...DEFAULT_SCOPE, cat: 'exam-a', minLevel: 1 })).toEqual(['make', 'escalate', 'latency']);
    expect(ids({ ...DEFAULT_SCOPE, cat: 'exam-a', file: 'set2' })).toEqual(['latency', 'escalate']);
    expect(ids({ ...DEFAULT_SCOPE, cat: 'exam-b' })).toEqual(['quota', 'escalate']);
    expect(ids({ ...DEFAULT_SCOPE, cat: 'exam-a', minLevel: 6 })).toEqual(['latency']);
    expect(ids({ ...DEFAULT_SCOPE, set: 'all', order: 'alpha' })).toEqual(['escalate', 'latency', 'quota', 'robust']);
  });

  it('오늘의 새 단어: 주 시험에 나온 단어에서, 학습 단계 이상만, 자주 나온 순', () => {
    const plan = (pick?: Parameters<typeof reviewPlan>[5]) => reviewPlan(data.WORDS, {}, 10, 0, new Date(), pick).fresh;
    expect(plan({ cat: 'exam-a', minLevel: 2 })).toEqual(['escalate', 'latency']);
    expect(plan({ cat: 'exam-a', minLevel: 1 })).toEqual(['make', 'escalate', 'latency']);
    expect(plan({ cat: 'exam-b' })).toEqual(['quota', 'escalate']);
  });
});

describe('예전에 저장한 학습 범위 고치기', () => {
  const exams: ExamInfo[] = [
    { id: 'ccar-f', name: 'CCAR-F', sources: [{ id: 'mock04', name: '샘플문제2' }, { id: 'vocab', name: '기존 단어장 예문', kind: 'wordbook' }] },
    { id: 'other', name: '다른 시험', sources: [{ id: 'part1', name: '1부' }] },
  ];
  const base = { status: 'unmastered', count: 20, order: 'freq' } as const;

  it('core → 첫 시험 전체, 기초 제외 → 2단계 이상', () => {
    expect(normalizeScope({ set: 'core', includeBasic: false, ...base }, exams)).toEqual({ set: 'exam', cat: 'ccar-f', minLevel: 2, ...base });
  });
  it('문제 파일별 → 그 파일이 있는 시험, 기초 포함 → 1단계 이상', () => {
    expect(normalizeScope({ set: 'file', file: 'part1', includeBasic: true, ...base }, exams)).toEqual({ set: 'exam', cat: 'other', file: 'part1', minLevel: 1, ...base });
  });
  it('없어진 한글 문제 파일이면 시험 전체로', () => {
    expect(normalizeScope({ set: 'file', file: 'mock04-kor', includeBasic: true, ...base }, exams)).toEqual({ set: 'exam', cat: 'ccar-f', minLevel: 1, ...base });
  });
  it('확장 포함(all)·오답노트·학습장은 그대로', () => {
    expect(normalizeScope({ set: 'all', includeBasic: false, ...base }, exams)).toEqual({ set: 'all', minLevel: 2, ...base });
    expect(normalizeScope({ set: 'wrong', includeBasic: true, status: 'any', count: 0, order: 'random' }, exams)).toEqual({ set: 'wrong', minLevel: 1, status: 'any', count: 0, order: 'random' });
    expect(normalizeScope({ set: 'notebook', notebook: 'nb-1', includeBasic: true, status: 'any', count: 0, order: 'random' }, exams)).toEqual(notebookScope('nb-1'));
  });
  it('새 형식은 그대로 두고, 예문 전용 파일·모르는 시험은 버린다', () => {
    const ok = { set: 'exam', cat: 'other', file: 'part1', minLevel: 4, status: 'due', count: 0, order: 'random' } as const;
    expect(normalizeScope(ok, exams)).toEqual(ok);
    expect(normalizeScope({ set: 'exam', cat: 'ccar-f', file: 'vocab', minLevel: 3 }, exams)).toEqual({ ...DEFAULT_SCOPE, cat: 'ccar-f', minLevel: 3 });
    expect(normalizeScope({ set: 'exam', cat: 'gone', minLevel: 9 }, exams)).toEqual({ ...DEFAULT_SCOPE, cat: 'ccar-f', minLevel: 6 });
  });
  it('깨진 값·빈 값이면 기본 범위 (첫 시험)', () => {
    expect(normalizeScope(null, exams)).toEqual({ ...DEFAULT_SCOPE, cat: 'ccar-f' });
    expect(normalizeScope({ set: 'nope', status: 'x', order: 'y', count: -3 }, exams)).toEqual({ ...DEFAULT_SCOPE, cat: 'ccar-f' });
    expect(normalizeScope({}, [])).toEqual(DEFAULT_SCOPE);
  });
  it('주소: 새 형식은 오갔다 와도 같고, 예전 주소(set=core&basic=1, set=file)도 읽는다', () => {
    const scope = { set: 'exam', cat: 'other', file: 'part1', minLevel: 3, status: 'new', count: 10, order: 'alpha' } as const;
    expect(scopeFromParams(new URLSearchParams(scopeToParams(scope)), DEFAULT_SCOPE, exams)).toEqual(scope);
    expect(scopeFromParams(new URLSearchParams('set=core&basic=1&status=any&count=0&order=random'), DEFAULT_SCOPE, exams)).toEqual({ set: 'exam', cat: 'ccar-f', minLevel: 1, status: 'any', count: 0, order: 'random' });
    expect(scopeFromParams(new URLSearchParams('set=file&file=mock04&basic=0'), DEFAULT_SCOPE, exams)).toEqual({ ...DEFAULT_SCOPE, cat: 'ccar-f', file: 'mock04' });
    expect(scopeFromParams(new URLSearchParams('set=wrong'), { ...DEFAULT_SCOPE, cat: 'other', file: 'part1' }, exams)).toEqual({ ...DEFAULT_SCOPE, set: 'wrong' });
  });
});

describe('normalize', () => {
  it('직접 추가한 최소 항목을 채운다', () => {
    const w = normalizeWord({ id: 'idempotent', word: 'idempotent', pos: '형용사', meaning: '멱등의 — 여러 번 실행해도 결과가 같은' });
    expect(w.pos).toEqual(['형용사']);
    expect(w.short).toBe('멱등의');
    expect(w.senses).toHaveLength(1);
    expect(w.level).toBe(4);
    expect(w.freq).toBe(0);
    expect(w.contexts).toEqual([]);
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

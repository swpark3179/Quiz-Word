import { describe, expect, it } from 'vitest';
import { compareWord, dice, sharesGloss, sortByWord } from '../text';
import { diffWordSets, packWordSet, parseWordSet, wordSetFileName } from '../wordset';

import type { ExamData } from '../exams';

const words = [
  { id: 'escalate', word: 'escalate', level: 5, pos: '동사', meaning: '확대하다' },
  { id: 'robust', word: 'robust', level: 5, pos: ['형용사'], meaning: '견고한' },
];
const exams: ExamData[] = [
  {
    id: 'ccar-f',
    name: 'CCAR-F',
    order: 1,
    sources: [{ id: 'set1', name: '1회' }, { id: 'vocab', name: '단어장 예문', kind: 'wordbook' }],
    index: { escalate: { set1: 2 } },
    examples: { set1: { escalate: [{ n: 0, q: 3, en: 'Escalate the issue.', surface: 'Escalate', pos: '동사', sense: '확대하다', ko: '문제를 넘긴다.' }] } },
    sentences: { set1: [{ q: 3, en: 'Escalate the issue.', ko: '문제를 넘긴다.' }] },
    notes: { escalate: '노트' },
  },
];

describe('단어 세트 파일 (웹 → 앱)', () => {
  it('만든 파일을 JSON 으로 주고받아도 그대로 읽힌다', () => {
    const file = packWordSet({ words, exams, builtAt: '2026-11-10T12:00:00.000Z' });
    const back = parseWordSet(JSON.parse(JSON.stringify(file)));
    expect(back).toEqual(file);
    expect(back.count).toBe(2);
  });

  it('id·word 가 없는 항목은 만들 때 뺀다', () => {
    const file = packWordSet({ words: [...words, { id: '', word: 'x' }, { id: 'y' }], exams });
    expect(file.words.map((w) => w.id)).toEqual(['escalate', 'robust']);
  });

  it('단어 세트가 아닌 파일은 이유를 알려 주며 거부한다', () => {
    const ok = packWordSet({ words, exams });
    expect(() => parseWordSet(null)).toThrow('단어 세트 파일이 아닙니다');
    expect(() => parseWordSet({ app: 'quiz-word', version: 1, cards: {}, settings: {} })).toThrow('진행 기록 파일');
    expect(() => parseWordSet({ ...ok, kind: 'other' })).toThrow('단어 세트 파일이 아닙니다');
    expect(() => parseWordSet({ ...ok, version: 3 })).toThrow('버전 3');
    expect(() => parseWordSet({ ...ok, version: 1, corpus: [], sources: [] })).toThrow('예전 형식');
    expect(() => parseWordSet({ ...ok, words: [] })).toThrow('단어가 하나도 없는');
    expect(() => parseWordSet({ ...ok, words: [{ id: 'a' }] })).toThrow('1번째 단어');
    expect(() => parseWordSet({ ...ok, words: [...words, words[0]] })).toThrow('같은 id 가 두 번 이상 있어요: escalate');
    expect(() => parseWordSet({ ...ok, exams: 'x' })).toThrow('exams');
    expect(() => parseWordSet({ ...ok, exams: [{ name: '이름만' }] })).toThrow('id 나 name');
    expect(() => parseWordSet({ ...ok, exams: [...exams, exams[0]] })).toThrow('같은 시험이 두 번');
    expect(() => parseWordSet({ ...ok, exams: [{ ...exams[0], sources: 'x' }] })).toThrow('sources');
    expect(() => parseWordSet({ ...ok, exams: [{ ...exams[0], examples: { set1: { escalate: [{ q: 1 }] } } }] })).toThrow('예문(set1)');
    expect(() => parseWordSet({ ...ok, exams: [{ ...exams[0], sentences: { set1: [{ q: 1 }] } }] })).toThrow('문제 문장(set1)');
  });

  it('시험 데이터가 비어 있어도 읽힌다 (빈 칸은 채운다)', () => {
    const back = parseWordSet({ ...packWordSet({ words, exams: [] }), exams: [{ id: 'x', name: 'X', sources: [] }] });
    expect(back.exams).toEqual([{ id: 'x', name: 'X', sources: [], index: {}, examples: {}, sentences: {}, notes: {} }]);
    expect(parseWordSet({ ...packWordSet({ words, exams: [] }), exams: undefined }).exams).toEqual([]);
  });

  it('지금 세트와 새 세트의 차이', () => {
    expect(diffWordSets(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])).toEqual({ added: ['d', 'e'], removed: ['a'] });
  });

  it('파일 이름에 날짜를 넣는다', () => {
    expect(wordSetFileName(new Date(2026, 10, 10, 9).toISOString())).toBe('quiz-word-words-20261110.json');
  });
});

describe('정렬·비교 도우미', () => {
  it('표제어 정렬은 대소문자를 무시하고, 같으면 원문 순', () => {
    const list = ['beta', 'API', 'alpha', 'api', 'Beta'].map((word) => ({ word }));
    expect(sortByWord(list).map((x) => x.word)).toEqual(['alpha', 'API', 'api', 'Beta', 'beta']);
    expect(compareWord('API', 'api')).toBeLessThan(0);
    expect(compareWord('b', 'A')).toBeGreaterThan(0);
  });

  it('뜻 비교는 같은 문자열을 여러 번 불러도 같은 값 (캐시)', () => {
    for (let i = 0; i < 3; i++) {
      expect(dice('문제를 넘기다', '문제를 넘겨주다')).toBeCloseTo(dice('문제를 넘기다', '문제를 넘겨주다'));
      expect(sharesGloss('다루다, 처리하다', '처리하다')).toBe(true);
      expect(sharesGloss('다루다', '견고한')).toBe(false);
    }
  });
});

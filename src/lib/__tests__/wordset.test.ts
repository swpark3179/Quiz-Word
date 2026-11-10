import { describe, expect, it } from 'vitest';
import { compareWord, dice, sharesGloss, sortByWord } from '../text';
import { diffWordSets, packWordSet, parseWordSet, wordSetFileName } from '../wordset';

const words = [
  { id: 'escalate', word: 'escalate', pos: '동사', meaning: '확대하다' },
  { id: 'robust', word: 'robust', pos: ['형용사'], meaning: '견고한', contexts: [] },
];
const corpus = [{ src: 'ccar-f-01', q: 3, en: 'Escalate the issue.', ko: '문제를 넘긴다.' }];
const sources = [{ id: 'ccar-f-01', name: 'CCAR-F 1회' }];

describe('단어 세트 파일 (웹 → 앱)', () => {
  it('만든 파일을 JSON 으로 주고받아도 그대로 읽힌다', () => {
    const file = packWordSet({ words, corpus, sources, builtAt: '2026-11-10T12:00:00.000Z' });
    const back = parseWordSet(JSON.parse(JSON.stringify(file)));
    expect(back).toEqual(file);
    expect(back.count).toBe(2);
  });

  it('id·word 가 없는 항목은 만들 때 뺀다', () => {
    const file = packWordSet({ words: [...words, { id: '', word: 'x' }, { id: 'y' }], corpus, sources });
    expect(file.words.map((w) => w.id)).toEqual(['escalate', 'robust']);
  });

  it('단어 세트가 아닌 파일은 이유를 알려 주며 거부한다', () => {
    const ok = packWordSet({ words, corpus, sources });
    expect(() => parseWordSet(null)).toThrow('단어 세트 파일이 아닙니다');
    expect(() => parseWordSet({ app: 'quiz-word', version: 1, cards: {}, settings: {} })).toThrow('진행 기록 파일');
    expect(() => parseWordSet({ ...ok, kind: 'other' })).toThrow('단어 세트 파일이 아닙니다');
    expect(() => parseWordSet({ ...ok, version: 2 })).toThrow('버전 2');
    expect(() => parseWordSet({ ...ok, words: [] })).toThrow('단어가 하나도 없는');
    expect(() => parseWordSet({ ...ok, words: [{ id: 'a' }] })).toThrow('1번째 단어');
    expect(() => parseWordSet({ ...ok, words: [...words, words[0]] })).toThrow('같은 id 가 두 번 이상 있어요: escalate');
    expect(() => parseWordSet({ ...ok, corpus: [{ q: 1 }] })).toThrow('corpus');
    expect(() => parseWordSet({ ...ok, sources: 'x' })).toThrow('sources');
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

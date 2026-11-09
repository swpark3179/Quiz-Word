import { describe, expect, it } from 'vitest';
import { cleanMarkdown, guessLemma, maskNonProse, normalizeToken, splitSentences, tokenize } from '../lib/text';
import { parseVocabExamples } from '../lib/common';

describe('splitSentences', () => {
  it('문장 끝에서 나누고, 인라인 코드·약어 안에서는 나누지 않는다', () => {
    const s = splitSentences('Run `npm run lint.fix` first. Then, e.g. retry it. What next?');
    expect(s).toEqual(['Run `npm run lint.fix` first.', 'Then, e.g. retry it.', 'What next?']);
  });
  it('[Scenario: …] 머리를 따로 뗀다', () => {
    expect(splitSentences('[Scenario: Code Review] A team runs tests.')).toEqual(['[Scenario: Code Review]', 'A team runs tests.']);
  });
});

describe('tokenize / mask', () => {
  it('코드·경로·파일명·플래그는 토큰에서 뺀다', () => {
    const masked = maskNonProse('Edit `tool_use` in src/api and CLAUDE.md with --resume flag');
    const toks = tokenize(masked).map((t) => t.text);
    expect(toks).toEqual(['Edit', 'in', 'and', 'with', 'flag']);
  });
  it('문장 첫 단어 표시', () => {
    const toks = tokenize('Claude runs. Then Python fails');
    expect(toks.map((t) => t.initial)).toEqual([true, false, true, false, false]);
  });
});

describe('lemma', () => {
  it('규칙 변화형을 원형으로', () => {
    expect(guessLemma('running')).toBe('run');
    expect(guessLemma('queries')).toBe('query');
    expect(guessLemma('built')).toBe('build');
    expect(guessLemma('data')).toBe('data');
  });
  it('소유격·축약 정리', () => {
    expect(normalizeToken("subagent's")).toBe('subagent');
    expect(normalizeToken("can't")).toBeNull();
  });
});

describe('cleanMarkdown', () => {
  it('강조 기호를 걷고 코드는 남긴다', () => {
    expect(cleanMarkdown('**Bold** and *italic* with `code`')).toBe('Bold and italic with `code`');
  });
});

describe('parseVocabExamples', () => {
  it('문제 속 쓰임의 영어·한글 쌍', () => {
    const md = '1. **뜻**\n\n## 문제 속 쓰임\n> Halt and **escalate** now.\n> 멈추고 **넘긴다**.\n\n## 함께 쓰는 표현\n- x';
    expect(parseVocabExamples(md)).toEqual([{ en: 'Halt and escalate now.', ko: '멈추고 넘긴다.' }]);
  });
});

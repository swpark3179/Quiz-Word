import { describe, expect, it } from 'vitest';
import { buildWordData } from '../exams';
import { buildLexicon, lexiconSig, LEXICON_FORMAT } from '../lexicon';
import { normalizeWord, type RawWord } from '../normalize';
import {
  appendQuery,
  cleanLookupWord,
  lookupHref,
  notFoundCallbackUrl,
  parseLookupUrl,
  resolveLookup,
  safeCallback,
} from '../wordLookup';

const raw: RawWord[] = [
  { id: 'run', word: 'run', pos: ['동사'], meaning: '실행하다', level: 2, forms: ['ran', 'running', 'runs'] },
  { id: 'runtime', word: 'runtime', pos: ['명사'], meaning: '실행 환경', level: 3, ipa: 'ˈrʌntaɪm' },
  { id: 'escalate', word: 'escalate', pos: ['동사'], meaning: '(상위 담당자에게) 넘기다', level: 5 },
  { id: 'exponential-backoff', word: 'exponential backoff', pos: ['명사구'], meaning: '지수 백오프', level: 6 },
];
const { WORDS, WORD_BY_SURFACE } = buildWordData(raw, []);

describe('단어 찾기 주소 (quizword://lookup)', () => {
  it('앱 스킴·경로·Expo Go 주소에서 단어와 콜백을 읽는다', () => {
    const cb = encodeURIComponent('quizbank://word-lookup-result');
    expect(parseLookupUrl(`quizword://lookup?word=Escalate&x-source=%EB%AC%B8%EC%A0%9C%EC%9D%80%ED%96%89&x-error=${cb}`)).toEqual({
      word: 'Escalate',
      source: '문제은행',
      xError: 'quizbank://word-lookup-result',
    });
    expect(parseLookupUrl('quizword:///lookup?word=run')).toEqual({ word: 'run' });
    expect(parseLookupUrl('/lookup?word=run')).toEqual({ word: 'run' });
    expect(parseLookupUrl('exp://192.168.0.2:8081/--/lookup?word=run')).toEqual({ word: 'run' });
    expect(parseLookupUrl('quizword://lookup?word=exponential+backoff')).toEqual({ word: 'exponential backoff' });
  });

  it('다른 주소·빈 단어는 lookup 이 아니다', () => {
    expect(parseLookupUrl('quizword://words?q=run')).toBeNull();
    expect(parseLookupUrl('quizword://words/lookup?word=run')).toBeNull();
    expect(parseLookupUrl('quizword://lookup')).toBeNull();
    expect(parseLookupUrl('quizword://lookup?word=%20%20')).toBeNull();
    expect(parseLookupUrl('')).toBeNull();
  });

  it('허용되지 않은 콜백은 버린다 (아무 주소나 열지 않는다)', () => {
    expect(parseLookupUrl('quizword://lookup?word=run&x-error=https%3A%2F%2Fevil.example')).toEqual({ word: 'run' });
    expect(safeCallback('tel:123')).toBeUndefined();
    expect(safeCallback('QuizBank://x')).toBe('QuizBank://x');
  });

  it('단어는 공백을 정리하고 64자에서 자른다', () => {
    expect(cleanLookupWord('  exponential \n backoff ')).toBe('exponential backoff');
    expect(cleanLookupWord('a'.repeat(100))).toHaveLength(64);
    expect(parseLookupUrl('quizword://lookup?word=%E0%A4%A')).toEqual({ word: '%E0%A4%A' });
  });

  it('표제어·변화형 정확 일치 → 그 단어, 부분 일치 → 개수, 없으면 none', () => {
    expect(resolveLookup('RAN', WORD_BY_SURFACE, WORDS)).toMatchObject({ kind: 'exact', word: { id: 'run' } });
    expect(resolveLookup('Exponential  Backoff', WORD_BY_SURFACE, WORDS)).toMatchObject({ kind: 'exact', word: { id: 'exponential-backoff' } });
    expect(resolveLookup('runt', WORD_BY_SURFACE, WORDS)).toEqual({ kind: 'partial', count: 1 });
    expect(resolveLookup('qwertyx', WORD_BY_SURFACE, WORDS)).toEqual({ kind: 'none' });
    expect(resolveLookup('  ', WORD_BY_SURFACE, WORDS)).toEqual({ kind: 'none' });
  });

  it('결과 없음 콜백에 errorCode·errorMessage·word 를 붙인다', () => {
    const url = notFoundCallbackUrl('quizbank://word-lookup-result', 'qwerty x');
    expect(url).toBe(
      `quizbank://word-lookup-result?errorCode=not_found&errorMessage=${encodeURIComponent('단어장에 없는 단어예요')}&word=qwerty%20x`,
    );
    expect(notFoundCallbackUrl('quizbank://r?from=quiz', 'x')).toMatch(/^quizbank:\/\/r\?from=quiz&errorCode=not_found&/);
    expect(notFoundCallbackUrl('https://evil.example', 'x')).toBeNull();
    expect(notFoundCallbackUrl(undefined, 'x')).toBeNull();
  });

  it('단어장 화면 경로', () => {
    expect(lookupHref({ word: 'run' }, 7)).toBe('/words?lookup=run&t=7');
    expect(lookupHref({ word: 'a b', xError: 'quizbank://r' }, 'n')).toBe('/words?lookup=a%20b&t=n&xerr=quizbank%3A%2F%2Fr');
    expect(appendQuery('x://y?', { a: '1' })).toBe('x://y?a=1');
    expect(appendQuery('x://y#f', { a: '1' })).toBe('x://y?a=1#f');
  });
});

describe('단어 목록 내보내기 (lexicon)', () => {
  it('표제어·한 줄 뜻·품사·발음·변화형만 담는다', () => {
    const file = buildLexicon(WORDS, 'sig-1', '2026-11-12T00:00:00.000Z');
    expect(file).toMatchObject({ format: LEXICON_FORMAT, version: 1, sig: 'sig-1', exportedAt: '2026-11-12T00:00:00.000Z', count: 4 });
    const run = file.words.find((w) => w.id === 'run')!;
    expect(run).toEqual({ id: 'run', word: 'run', short: '실행하다', pos: ['동사'], forms: ['ran', 'running', 'runs'] });
    expect(file.words.find((w) => w.id === 'runtime')).toEqual({ id: 'runtime', word: 'runtime', short: '실행 환경', pos: ['명사'], ipa: 'ˈrʌntaɪm' });
    // 개인 데이터·시험 데이터는 없다
    expect(Object.keys(run)).not.toContain('occ');
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);
  });

  it('세트·시험 팩·단어 수가 바뀌면 sig 가 바뀐다', () => {
    const info = { origin: 'bundled', builtAt: '2026-11-10', packs: [] as { id: string; builtAt: string }[] };
    const a = lexiconSig(info, 10);
    expect(lexiconSig(info, 10)).toBe(a);
    expect(lexiconSig(info, 11)).not.toBe(a);
    expect(lexiconSig({ ...info, origin: 'imported' }, 10)).not.toBe(a);
    expect(lexiconSig({ ...info, packs: [{ id: 'x', builtAt: '1' }] }, 10)).not.toBe(a);
  });

  it('normalizeWord 로 만든 단어도 그대로 담긴다', () => {
    const w = normalizeWord({ id: 'latency', word: 'latency', pos: ['명사'], meaning: '지연 시간; 대기 시간', level: 3 });
    expect(buildLexicon([w], 's').words[0]).toEqual({ id: 'latency', word: 'latency', short: w.short, pos: ['명사'] });
  });
});

/**
 * 파이프라인 — 작은 가짜 시험(fixtures/quiz-data/demo)으로 extract → merge → validate 를 끝까지 돌린다.
 * 확인하는 것: 한글판 문제 파일 제외, 사전에 있던 단어는 그대로, 새 단어만 추가, 그 시험 폴더만 새로 씀.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildWordData, freqIn } from '../../src/lib/exams';
import type { RawWord } from '../../src/lib/normalize';
import { runExtract } from '../extract';
import type { ExamConfig } from '../lib/common';
import { readDict, readExams } from '../lib/data';
import { runMerge } from '../merge';
import { validateData } from '../validate';

const QUIZ = path.resolve(__dirname, 'fixtures/quiz-data');
const EXAM: ExamConfig = { id: 'demo', name: '데모 시험', order: 2, set: 'demo', exclude: ['-kor$'] };

const ESCALATE: RawWord = {
  id: 'escalate',
  word: 'escalate',
  level: 5,
  pos: ['동사'],
  meaning: '(상위 담당자에게) 넘기다',
  short: '넘기다',
  senses: [{ pos: '동사', ko: '넘기다' }],
  forms: ['escalated'],
  domain: '이동·전달',
  memory: { story: '계단(scale)을 한 칸 올려 보낸다 → 윗사람에게 넘기다' },
};
const RETRY: RawWord = { id: 'retry', word: 'retry', level: 4, pos: ['동사'], meaning: '다시 시도하다', short: '다시 시도하다', senses: [{ pos: '동사', ko: '다시 시도하다' }], domain: '실행·처리' };
const ROBUST: RawWord = { id: 'robust', word: 'robust', level: 5, pos: ['형용사'], meaning: '견고한', short: '견고한', senses: [{ pos: '형용사', ko: '견고한' }], domain: '정확·품질·신뢰' };

let root: string;
let dataDir: string;
let workRoot: string;
let workDir: string;
const read = (...p: string[]) => fs.readFileSync(path.join(root, ...p), 'utf8');
const json = <T,>(...p: string[]) => JSON.parse(read(...p)) as T;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-word-pipeline-'));
  dataDir = path.join(root, 'data');
  workRoot = path.join(root, 'work');
  workDir = path.join(workRoot, EXAM.id);
  fs.mkdirSync(path.join(dataDir, 'words'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'words', 'e.json'), JSON.stringify([ESCALATE], null, 2) + '\n');
  fs.writeFileSync(path.join(dataDir, 'words', 'r.json'), JSON.stringify([RETRY, ROBUST], null, 2) + '\n');
  // 이미 있는 다른 시험 — 건드리면 안 된다
  fs.mkdirSync(path.join(dataDir, 'exams', 'other'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'exams', 'other', 'exam.json'), JSON.stringify({ id: 'other', name: '다른 시험', order: 1, sources: [{ id: 'set1', name: '1회' }] }, null, 2) + '\n');
  fs.writeFileSync(path.join(dataDir, 'exams', 'other', 'index.json'), '{\n  "escalate": {"set1":7}\n}\n');
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('파이프라인: 새 시험 추가', () => {
  it('extract — 한글판 파일은 읽지 않고, 사전에 있는 단어를 표시하고, 문제 파일별로 센다', () => {
    const r = runExtract({ exam: EXAM, quizDir: QUIZ, workDir, dataDir, quiet: true });
    expect(r.files.map((f) => f.id)).toEqual(['part1', 'part2']);
    expect(r.questions).toBe(3);
    const lemma = (k: string) => r.lemmas.find((l) => l.lemma === k)!;
    expect(lemma('quota')).toMatchObject({ freq: 5, bySource: { part1: 3, part2: 2 }, sources: ['part1', 'part2'] });
    expect(lemma('quota').known).toBeUndefined();
    expect(lemma('escalate')).toMatchObject({ known: 'escalate', freq: 4, bySource: { part1: 3, part2: 1 } });
    expect(lemma('escalate').surfaces).toEqual({ escalate: 3, escalated: 1 });
    expect(lemma('robust').known).toBe('robust');
    // 한글판에만 있는 단어·문장은 없다
    expect(r.lemmas.some((l) => l.lemma === 'hallucination')).toBe(false);
    expect(json<{ src: string }[]>('work', 'demo', 'sentences.json').every((s) => s.src !== 'part1-kor')).toBe(true);
  });

  it('merge — 새 단어만 사전에 넣고, 그 시험 폴더만 쓴다', () => {
    const lemmas = json<{ lemma: string }[]>('work', 'demo', 'lemmas.json');
    const made: Record<string, object> = {
      // 사전에 있는 단어: 예문과 문맥 뜻만 고른다 (두 번째 예문은 사전에 없던 뜻)
      escalate: {
        word: 'escalate',
        contexts: [
          { sid: 'part1#1.0', surface: 'escalate', pos: '동사', sense: '넘기다' },
          { sid: 'part2#1.0', surface: 'escalated', pos: '동사', sense: '악화되다' },
          { sid: 'part1-kor#1.0', surface: 'escalate', pos: '동사', sense: '넘기다' }, // 뺀 문제 파일
        ],
      },
      retry: { word: 'retry', contexts: [{ sid: 'part1#1.2', surface: 'Retry', pos: '동사', sense: '다시 시도하다' }] },
      robust: { word: 'robust', contexts: [{ sid: 'part2#1.1', surface: 'robust', pos: '형용사', sense: '견고한' }] },
      // 새 단어: 뜻·등급·외우기까지
      quota: {
        word: 'quota',
        pos: ['명사'],
        ipa: 'ˈkwoʊtə',
        meaning: '할당량, 한도',
        short: '할당량',
        senses: [{ pos: '명사', ko: '할당량' }],
        forms: ['quotas'],
        domain: '정도·양·크기',
        level: 5,
        memory: { origin: '라틴어 quota pars (얼마만큼의 몫)', story: '각자에게 나눠 준 몫 → 할당량' },
        contexts: [{ sid: 'part1#1.0', surface: 'quota', pos: '명사', sense: '할당량' }],
      },
      // 등급을 빠뜨린 새 단어 → 기본 단계로 넣고 경고
      exceed: { word: 'exceed', pos: ['동사'], meaning: '넘다, 초과하다', short: '넘다', senses: [{ pos: '동사', ko: '넘다' }], domain: '정도·양·크기', contexts: [{ sid: 'part2#1.0', surface: 'exceeded', pos: '동사', sense: '넘다' }] },
    };
    fs.mkdirSync(path.join(workDir, 'gen'), { recursive: true });
    fs.writeFileSync(path.join(workDir, 'gen', 'lexicon-01.json'), JSON.stringify(lemmas.map((l) => (made[l.lemma] ? { lemma: l.lemma, skip: null, ...made[l.lemma] } : { lemma: l.lemma, skip: 'fragment' }))));
    fs.writeFileSync(path.join(workDir, 'gen', 'ko-01.json'), JSON.stringify({ 'part1#1.0': '할당량을 넘으면 에이전트는 티켓을 넘겨야 한다.' }));
    const rBefore = read('data', 'words', 'r.json');
    const otherBefore = [read('data', 'exams', 'other', 'exam.json'), read('data', 'exams', 'other', 'index.json')];

    const r = runMerge({ exam: EXAM, quizDir: QUIZ, workDir, dataDir, quiet: true });

    expect(r.added.sort()).toEqual(['exceed', 'quota']);
    expect(r.touched).toEqual(['escalate']);
    expect(r.warnings.some((w) => w.includes('exceed') && w.includes('level'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('없는 sid'))).toBe(false);

    const dict = new Map(readDict(dataDir).map((w) => [w.id, w]));
    // 있던 단어: 뜻 하나가 덧붙은 것 말고는 그대로 (등급·외우기 포함)
    expect(dict.get('escalate')).toEqual({ ...ESCALATE, senses: [...ESCALATE.senses!, { pos: '동사', ko: '악화되다' }] });
    expect(read('data', 'words', 'r.json')).toBe(rBefore);
    // 새 단어
    expect(dict.get('quota')).toMatchObject({ level: 5, forms: ['quotas'], memory: { story: '각자에게 나눠 준 몫 → 할당량' } });
    expect(dict.get('exceed')).toMatchObject({ level: 4, forms: ['exceeded'] });
    expect(json<RawWord[]>('data', 'words', 'e.json').map((w) => w.id)).toEqual(['escalate', 'exceed']);

    // 시험 폴더
    expect(json('data', 'exams', 'demo', 'exam.json')).toEqual({ id: 'demo', name: '데모 시험', order: 2, sources: [{ id: 'part1', name: '1부' }, { id: 'part2', name: '2부' }] });
    expect(json('data', 'exams', 'demo', 'index.json')).toEqual({
      escalate: { part1: 3, part2: 1 },
      exceed: { part1: 1, part2: 1 },
      quota: { part1: 3, part2: 2 },
      retry: { part1: 3, part2: 1 },
      robust: { part1: 1, part2: 1 },
    });
    expect(json<Record<string, unknown[]>>('data', 'exams', 'demo', 'examples', 'part1.json').escalate).toEqual([
      { n: 0, q: 1, en: 'The agent should escalate the ticket when the quota is exceeded.', surface: 'escalate', pos: '동사', sense: '넘기다', ko: '할당량을 넘으면 에이전트는 티켓을 넘겨야 한다.' },
    ]);
    expect(fs.readdirSync(path.join(dataDir, 'exams', 'demo', 'sentences')).sort()).toEqual(['part1.json', 'part2.json']);
    expect(json<unknown[]>('data', 'exams', 'demo', 'sentences', 'part2.json')).toHaveLength(3);
    // 다른 시험은 그대로
    expect([read('data', 'exams', 'other', 'exam.json'), read('data', 'exams', 'other', 'index.json')]).toEqual(otherBefore);
  });

  it('validate — 만든 데이터에 오류가 없고, 앱이 읽으면 두 시험의 횟수가 따로 잡힌다', () => {
    const v = validateData(dataDir, workRoot);
    expect(v.errors).toEqual([]);
    expect(v).toMatchObject({ count: 5, exams: 2, examples: 6 });

    const data = buildWordData(readDict(dataDir), readExams(dataDir));
    expect(data.EXAMS.map((e) => e.id)).toEqual(['other', 'demo']);
    const w = data.WORD_BY_ID.get('escalate')!;
    expect([freqIn(w, 'demo'), freqIn(w, 'other'), w.freq]).toEqual([4, 7, 11]);
    expect(data.contextsOf(w, 4, { cat: 'demo', file: 'part2' }).map((c) => `${c.src}:${c.sense}`)).toEqual(['part2:악화되다', 'part1:넘기다']);
  });

  it('merge 를 다시 돌려도 사전은 더 바뀌지 않는다', () => {
    const words = ['e.json', 'q.json', 'r.json'].map((f) => read('data', 'words', f));
    const index = read('data', 'exams', 'demo', 'index.json');
    const r = runMerge({ exam: EXAM, quizDir: QUIZ, workDir, dataDir, quiet: true });
    expect(r.added).toEqual([]);
    expect(r.touched).toEqual([]);
    expect(['e.json', 'q.json', 'r.json'].map((f) => read('data', 'words', f))).toEqual(words);
    expect(read('data', 'exams', 'demo', 'index.json')).toBe(index);
  });

  it('validate — 사전에 시험 전용 필드가 남아 있거나 예문의 단어가 사전에 없으면 오류', () => {
    const file = path.join(dataDir, 'words', 'q.json');
    const keep = fs.readFileSync(file, 'utf8');
    const [quota] = JSON.parse(keep) as Record<string, unknown>[];
    fs.writeFileSync(file, JSON.stringify([{ ...quota, level: 9, tier: 'core' }]));
    fs.writeFileSync(path.join(dataDir, 'exams', 'demo', 'examples', 'part2.json'), '{"ghost":[{"q":1,"en":"A ghost.","surface":"ghost","pos":"명사","sense":"유령"}]}');
    const { errors } = validateData(dataDir, workRoot);
    expect(errors.some((e) => e.includes('level 은 1~6'))).toBe(true);
    expect(errors.some((e) => e.includes('"tier" 는 사전에 적지 않는다'))).toBe(true);
    expect(errors.some((e) => e.includes('사전에 없는 단어 "ghost"'))).toBe(true);
    fs.writeFileSync(file, keep);
  });
});

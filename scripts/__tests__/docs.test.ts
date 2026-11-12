/**
 * GitHub Pages(docs/)에 올리는 시험 팩 가이드·스키마·검증기·예시가 서로 맞는지, 그리고 지금 코드와 맞는지.
 * 검사 규칙이나 허용값을 고치고 `npm run docs:build` 를 잊으면 여기서 걸린다.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MEMORY_LIMITS } from '../../src/lib/checks';
import { EXAMPACK_VERSION, mergeExamPack, packExam, validateExamPack } from '../../src/lib/exampack';
import { DOMAINS, LEVELS, POS_LIST } from '../../src/lib/schema';
import { addExamPack } from '../add-exam-pack';
import { buildDocs, DOCS, examPackSchema, guideWithExample, PAGES_URL } from '../build-docs';
import { readDict, readExams } from '../lib/data';
import { validateData } from '../validate';

const read = (f: string) => fs.readFileSync(path.join(DOCS, f), 'utf8');
const example = () => JSON.parse(read('example.exampack.json'));
let tmp: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-word-docs-'));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** 검증기를 실제로 node 로 돌린다 */
function runValidator(file: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [path.join(DOCS, 'validate-exampack.mjs'), file, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}
function writeTmp(name: string, data: unknown) {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, typeof data === 'string' ? data : JSON.stringify(data));
  return f;
}

describe('docs: 생성물이 최신인지', () => {
  it('커밋된 검증기·스키마·가이드가 지금 코드로 만든 것과 같다 (다르면 npm run docs:build)', async () => {
    const files = await buildDocs(path.join(tmp, 'built'));
    expect(files.map((f) => path.basename(f)).sort()).toEqual(['exam-pack-guide.md', 'exampack.schema.json', 'validate-exampack.mjs']);
    for (const f of files) expect(fs.readFileSync(f, 'utf8'), path.basename(f)).toBe(read(path.basename(f)));
  });
  it('Jekyll 을 끄는 파일과 길잡이가 있다', () => {
    expect(fs.existsSync(path.join(DOCS, '.nojekyll'))).toBe(true);
    expect(read('llms.txt')).toContain(`${PAGES_URL}/exam-pack-guide.md`);
    expect(read('index.html')).toContain("from './validate-exampack.mjs'");
  });
});

describe('docs: 예시 파일', () => {
  it('오류도 경고도 없다', () => {
    const r = validateExamPack(example());
    expect(r.errors).toEqual([]);
    expect(r.warns).toEqual([]);
  });
  it('가이드의 "완성 예시"에 그대로 들어 있다', () => {
    const guide = read('exam-pack-guide.md');
    expect(guideWithExample(guide, read('example.exampack.json'))).toBe(guide);
    expect(guide).toContain('"id": "sample-exam"');
  });
});

describe('docs: 검증기 (node validate-exampack.mjs)', () => {
  it('올바른 파일 → 종료 코드 0, RESULT: PASS', () => {
    const r = runValidator(path.join(DOCS, 'example.exampack.json'));
    expect(r.code).toBe(0);
    expect(r.out).toContain(`RESULT: PASS errors=0 warnings=0 (시험 팩 형식 버전 ${EXAMPACK_VERSION})`);
    expect(r.out).toContain('시험 sample-exam (샘플 시험) — 문제 파일 2개 · 단어 11개 · 예문 15개 · 문장 8개');
  });
  it('틀린 파일 → 종료 코드 1, 오류마다 ERROR 줄', () => {
    const bad = example();
    bad.words[0].id = 'down-time';
    bad.exam.examples.part1.legacy[0].sense = '오래된';
    const r = runValidator(writeTmp('bad.exampack.json', bad));
    expect(r.code).toBe(1);
    expect(r.out).toContain('ERROR  words[0] (down-time): id 는 "downtime" 여야 함');
    expect(r.out).toContain('ERROR  exam.examples.part1 › legacy: 문맥 뜻 "오래된" 가 senses 에 없음');
    expect(r.out).toMatch(/RESULT: FAIL errors=\d+ warnings=\d+/);
  });
  it('--json → 기계가 읽을 수 있는 결과', () => {
    const ok = JSON.parse(runValidator(path.join(DOCS, 'example.exampack.json'), '--json').out);
    expect(ok).toEqual({ ok: true, errors: [], warnings: [], summary: { exam: 'sample-exam', name: '샘플 시험', sources: 2, words: 11, examples: 15, sentences: 8 } });
    const bad = example();
    delete bad.words[0].level;
    const r = runValidator(writeTmp('bad2.exampack.json', bad), '--json');
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out)).toMatchObject({ ok: false, errors: ['words[0] (downtime): level(1~6) 없음'] });
  });
  it('JSON 이 아니거나 파일이 없으면 종료 코드 2', () => {
    expect(runValidator(writeTmp('broken.json', '{ "app": ')).code).toBe(2);
    expect(runValidator(path.join(tmp, 'nope.json')).code).toBe(2);
    expect(runValidator(writeTmp('bom.exampack.json', `﻿${read('example.exampack.json')}`)).code).toBe(0);
  });
});

describe('docs: JSON Schema', () => {
  const ajv = new Ajv2020({ allErrors: true, validateFormats: false });
  const validate = ajv.compile(JSON.parse(read('exampack.schema.json')));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rejects = (change: (p: any) => void) => {
    const copy = example();
    change(copy);
    return !validate(copy);
  };

  it('허용값은 코드의 것과 같다', () => {
    const schema = examPackSchema();
    expect(schema.properties.words.items.properties.pos.items.enum).toEqual([...POS_LIST]);
    expect(schema.properties.words.items.properties.domain.enum).toEqual([...DOMAINS]);
    expect(schema.properties.words.items.properties.level.maximum).toBe(LEVELS.length);
  });
  it('예시를 받아들인다', () => {
    expect(validate(example()), JSON.stringify(validate.errors)).toBe(true);
  });
  it('구조가 틀린 것을 거부한다', () => {
    expect(rejects((p) => (p.version = 2))).toBe(true);
    expect(rejects((p) => (p.kind = 'wordset'))).toBe(true);
    expect(rejects((p) => (p.words[0].level = 7))).toBe(true);
    expect(rejects((p) => (p.words[0].level = '5'))).toBe(true);
    expect(rejects((p) => (p.words[0].pos = ['noun']))).toBe(true);
    expect(rejects((p) => (p.words[0].pos = '명사'))).toBe(true);
    expect(rejects((p) => (p.words[0].domain = '기타'))).toBe(true);
    expect(rejects((p) => (p.words[0].id = 'Down Time'))).toBe(true);
    expect(rejects((p) => delete p.words[0].short)).toBe(true);
    expect(rejects((p) => delete p.words[0].memory)).toBe(true); // 5단계인데 외우기 없음
    expect(rejects((p) => (p.words[0].memory = { roots: [{ part: 'down', ko: '아래' }] }))).toBe(true);
    expect(rejects((p) => (p.words[0].tier = 'core'))).toBe(true);
    expect(rejects((p) => (p.exam.index = {}))).toBe(true);
    expect(rejects((p) => (p.exam.index.team.part1 = 0))).toBe(true);
    expect(rejects((p) => delete p.exam.examples.part1.legacy[0].surface)).toBe(true);
    expect(rejects((p) => (p.exam.sources = []))).toBe(true);
    expect(rejects((p) => delete p.words.find((w: { id: string }) => w.id === 'team').memory)).toBe(false); // 1단계는 없어도 된다
  });
  it('스키마가 거부하는 것은 검증기도 거부한다', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const both = (change: (p: any) => void) => {
      const copy = example();
      change(copy);
      return [!validate(copy), validateExamPack(copy).errors.length > 0];
    };
    expect(both((p) => (p.words[0].pos = '명사'))).toEqual([true, true]);
    expect(both((p) => (p.words[0].level = 0))).toEqual([true, true]);
    expect(both((p) => (p.exam.sources[0].id = 'Part 1'))).toEqual([true, true]);
    expect(both((p) => (p.words[0].memory.story = '가'.repeat(MEMORY_LIMITS.story + 1)))).toEqual([true, true]);
  });
});

describe('docs: 가이드에 빠진 것이 없는지', () => {
  const guide = read('exam-pack-guide.md');
  it('품사·분류 허용값을 모두 적었다', () => {
    for (const p of POS_LIST) expect(guide, p).toContain(`\`${p}\``);
    for (const d of DOMAINS) expect(guide, d).toContain(`\`${d}\``);
  });
  it('단계 이름, 외우기 길이 제한, 형식 버전, 주소가 코드와 같다', () => {
    for (const l of LEVELS) expect(guide).toContain(`| ${l.level} | ${l.name} |`);
    expect(guide).toContain(`${MEMORY_LIMITS.story}자 이하`);
    expect(guide).toContain(`${MEMORY_LIMITS.hook}자 이하`);
    expect(guide).toContain(`${MEMORY_LIMITS.origin}자 이하`);
    expect(guide).toContain(`형식 버전 **${EXAMPACK_VERSION}**`);
    expect(guide).toContain(`"version": ${EXAMPACK_VERSION},`);
    for (const f of ['exam-pack-guide.md', 'validate-exampack.mjs', 'exampack.schema.json', 'example.exampack.json']) expect(guide).toContain(`${PAGES_URL}/${f}`);
  });
  it('가이드에 적힌 id·횟수 세는 방법이 앱의 것과 같은 결과를 낸다', () => {
    // 가이드의 코드 블록을 그대로 꺼내 실행해 본다
    const block = (marker: string) => guide.split('```js').find((b) => b.includes(marker))!.split('```')[0];
    const slugId = new Function(`${block('const slugId')}; return slugId;`)() as (w: string) => string;
    const countIn = new Function(`${block('function countIn')}; return countIn;`)() as (w: object, s: object[]) => number;
    const pack = validateExamPack(example()).pack!;
    for (const w of pack.words) {
      expect(slugId(w.word!)).toBe(w.id);
      for (const [src, n] of Object.entries(pack.exam.index[w.id!] ?? {})) expect(countIn(w, pack.exam.sentences[src]), `${w.id}@${src}`).toBe(n);
    }
    expect(slugId("don't")).toBe('dont');
    expect(slugId('Root  Cause')).toBe('root-cause');
  });
});

describe('시험 팩: 저장소 데이터로', () => {
  it('지금 있는 시험(CCAR-F)을 팩으로 내보내면 검사를 통과하고, 빈 사전에 얹으면 원래와 같다', () => {
    const words = readDict(path.resolve('data'));
    const exam = readExams(path.resolve('data')).find((e) => e.id === 'ccar-f')!;
    const pack = packExam(words, exam, '2026-11-12T00:00:00.000Z');
    const checked = validateExamPack(JSON.parse(JSON.stringify(pack)));
    expect(checked.errors).toEqual([]);
    const merged = mergeExamPack({ words: [], exams: [] }, checked.pack!);
    expect(merged.report.addedSenses).toEqual([]);
    expect(merged.words).toEqual(pack.words);
    expect(merged.exams[0].index).toEqual(exam.index);
    expect(merged.exams[0].examples).toEqual(exam.examples);
    expect(merged.exams[0].notes).toEqual(exam.notes);
  });

  it('data:add-pack — 예시 시험을 data 사본에 얹으면 새 시험과 새 단어만 생긴다', () => {
    const dataDir = path.join(tmp, 'data');
    fs.cpSync(path.resolve('data'), dataDir, { recursive: true });
    const before = new Map(readDict(dataDir).map((w) => [w.id, JSON.stringify(w)]));
    const ccarf = fs.readFileSync(path.join(dataDir, 'exams/ccar-f/index.json'), 'utf8');

    const r = addExamPack(path.join(DOCS, 'example.exampack.json'), dataDir);
    expect(r.errors).toEqual([]);
    // mitigate·replicate 는 사전에서 mitigation·replica 의 변화형이라 그 단어로 본다 → 새 단어는 downtime 하나
    expect(r.report).toMatchObject({ examId: 'sample-exam', replacedExam: false, addedWords: ['downtime'] });
    expect(r.report!.keptWords).toHaveLength(10);
    expect(r.rewritten.sort()).toEqual(['d.json', 'm.json', 'r.json']);

    const after = new Map(readDict(dataDir).map((w) => [w.id, JSON.stringify(w)]));
    expect(after.size).toBe(before.size + 1);
    // 있던 단어는 뜻·변화형이 덧붙은 셋 말고는 한 글자도 바뀌지 않았다
    const changed = [...before].filter(([id, text]) => after.get(id) !== text).map(([id]) => id);
    expect(changed.sort()).toEqual(['migrate', 'mitigation', 'replica']);
    expect(r.report!.addedSenses).toEqual([
      { id: 'migrate', ko: '(migration) 이전 작업' },
      { id: 'mitigation', ko: '(위험·피해를) 줄이다, 완화하다' },
      { id: 'replica', ko: '(데이터를) 복제하다' },
    ]);
    // 덧붙기만 했다: 단계·외우기·원래 뜻은 그대로
    const was = JSON.parse(before.get('replica')!);
    const now = JSON.parse(after.get('replica')!);
    expect(now).toMatchObject({ level: was.level, memory: was.memory, meaning: was.meaning });
    expect(now.senses.slice(0, was.senses.length)).toEqual(was.senses);
    // 다른 시험은 그대로, 새 시험 폴더가 생겼다
    expect(fs.readFileSync(path.join(dataDir, 'exams/ccar-f/index.json'), 'utf8')).toBe(ccarf);
    expect(fs.readdirSync(path.join(dataDir, 'exams')).sort()).toEqual(['ccar-f', 'sample-exam']);
    expect(fs.readdirSync(path.join(dataDir, 'exams/sample-exam/examples')).sort()).toEqual(['part1.json', 'part2.json']);
    expect(validateData(dataDir, path.join(tmp, 'no-work')).errors).toEqual([]);

    // 한 번 더 얹어도 더 바뀌지 않는다
    const again = addExamPack(path.join(DOCS, 'example.exampack.json'), dataDir);
    expect(again.report).toMatchObject({ replacedExam: true, addedWords: [], addedSenses: [] });
    expect(again.rewritten).toEqual([]);
  });

  it('data:add-pack — 형식이 틀린 팩이면 data 를 건드리지 않는다', () => {
    const dataDir = path.join(tmp, 'data2');
    fs.mkdirSync(path.join(dataDir, 'words'), { recursive: true });
    const bad = example();
    bad.exam.id = 'Bad Id';
    const r = addExamPack(writeTmp('bad3.exampack.json', bad), dataDir);
    expect(r.errors.join('\n')).toContain('시험 id 는 소문자·숫자·하이픈만');
    expect(fs.readdirSync(dataDir)).toEqual(['words']);
    expect(fs.readdirSync(path.join(dataDir, 'words'))).toEqual([]);
  });
});

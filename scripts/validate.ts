/**
 * 단어 데이터 검사 — npm run data:validate
 * 직접 단어를 추가·수정한 뒤 실행한다. 오류가 있으면 종료 코드 1.
 *
 * 규칙은 src/lib/checks.ts 에 있다 (시험 팩 검사와 같은 규칙).
 * 사전(data/words): 필수 필드, 등급(level 1~6), 품사·분류 허용값, id 형식·중복, 파일 위치,
 *   같은 표현이 두 단어에 등록됐는지, 외우기(memory) 형식, 시험 전용 필드가 섞여 있지 않은지
 * 시험(data/exams/<id>): 문제 파일 목록, 출현 횟수·예문·노트의 단어가 사전에 있는지,
 *   예문 속 강조 표기, 문맥 뜻이 senses 에 있는지, 문장 색인 형식
 * (파이프라인 작업 폴더가 있으면) 시험별 원형 누락
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkExam, checkWord } from '../src/lib/checks';
import type { RawWord } from '../src/lib/normalize';
import { LEVELS, type Word } from '../src/lib/schema';
import { isMain, readJson, WORK } from './lib/common';
import { readExams } from './lib/data';

export interface ValidateResult {
  errors: string[];
  warns: string[];
  /** 사전의 단어 수 */
  count: number;
  /** 시험 수 */
  exams: number;
  /** 시험에 붙은 예문 수 */
  examples: number;
  /** 1단계부터 단계별 단어 수 */
  perLevel: number[];
}

/**
 * dataDir(사전 + 시험 폴더)를 검사한다.
 * workRoot: 파이프라인 작업 폴더 — <workRoot>/<시험 id>/lemmas.json 이 있으면 그 시험의 원형이 사전에 빠짐없이 있는지도 본다.
 */
export function validateData(DATA: string, workRoot: string = WORK): ValidateResult {
  const DIR = path.join(DATA, 'words');
  const errors: string[] = [];
  const warns: string[] = [];

  const dict = new Map<string, Word>();
  const ids = new Map<string, string>();
  const surfaces = new Map<string, string>();
  let count = 0;

  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
    let raw: RawWord[];
    try {
      raw = readJson<RawWord[]>(path.join(DIR, file));
    } catch (e) {
      errors.push(`${file}: JSON 형식 오류 — ${(e as Error).message}`);
      continue;
    }
    if (!Array.isArray(raw)) {
      errors.push(`${file}: 최상위가 배열이 아님`);
      continue;
    }
    for (const r of raw) {
      count++;
      const where = `${file} › ${r?.id ?? '(id 없음)'}`;
      const w = checkWord(r, where, { errors, warns });
      if (!r?.id || !r.word) continue;
      const letter = /^[a-z]/.test(r.id) ? r.id[0] : '0';
      if (file !== `${letter}.json`) warns.push(`${where}: ${letter}.json 에 두는 것이 규칙`);
      if (ids.has(r.id)) errors.push(`${where}: id 중복 (${ids.get(r.id)})`);
      ids.set(r.id, file);
      if (!w) continue;
      dict.set(w.id, w);

      for (const s of [w.word, ...(w.forms ?? [])].map((x) => x.toLowerCase())) {
        const owner = surfaces.get(s);
        if (owner && owner !== w.id) errors.push(`${where}: 표현 "${s}" 가 ${owner} 에도 등록됨`);
        surfaces.set(s, w.id);
      }
    }
  }

  // 등급 분포·외우기
  const perLevel = LEVELS.map((l) => [...dict.values()].filter((w) => w.level === l.level).length);
  if (count >= 1800) {
    LEVELS.forEach((l, i) => {
      if (perLevel[i] < 300 || perLevel[i] > 400) warns.push(`${l.level}단계(${l.name}) 단어가 ${perLevel[i]}개 — 단계마다 300~400개가 기준`);
    });
  }
  const noMemory = [...dict.values()].filter((w) => w.level >= 2 && !w.memory);
  if (noMemory.length) warns.push(`2단계 이상인데 외우기(memory)가 없는 단어 ${noMemory.length}개: ${noMemory.slice(0, 12).map((w) => w.id).join(', ')}${noMemory.length > 12 ? ' …' : ''}`);

  // 시험 데이터
  const exams = readExams(DATA);
  const examIds = new Set<string>();
  let exampleCount = 0;
  for (const exam of exams) {
    const at = `exams/${exam.id}`;
    if (examIds.has(exam.id)) errors.push(`${at}: 시험 id 중복`);
    examIds.add(exam.id);
    if (!fs.existsSync(path.join(DATA, 'exams', exam.id, 'exam.json'))) errors.push(`${at}: exam.json 없음`);
    exampleCount += checkExam(exam, dict, { errors, warns });

    // 원형 누락 (그 시험의 파이프라인 작업물이 있을 때만)
    const work = path.join(workRoot, exam.id);
    const lemmasPath = path.join(work, 'lemmas.json');
    if (fs.existsSync(lemmasPath)) {
      const skipped = fs.existsSync(path.join(work, 'skipped.json')) ? readJson<Record<string, string>>(path.join(work, 'skipped.json')) : {};
      const lemmas = readJson<{ lemma: string; surfaces: Record<string, number> }[]>(lemmasPath);
      const missing = lemmas.filter((l) => !skipped[l.lemma] && !surfaces.has(l.lemma) && !Object.keys(l.surfaces).some((s) => surfaces.has(s.toLowerCase())));
      if (missing.length) {
        errors.push(`${exam.id} 원형 ${missing.length}개 누락: ${missing.slice(0, 40).map((m) => m.lemma).join(', ')}${missing.length > 40 ? ' …' : ''}`);
        fs.writeFileSync(path.join(work, 'missing.json'), JSON.stringify(missing.map((m) => m.lemma)));
      }
    }
  }
  if (!exams.length) warns.push('시험 데이터(data/exams)가 없음');

  return { errors, warns, count, exams: exams.length, examples: exampleCount, perLevel };
}

if (isMain(import.meta.url)) {
  const { errors, warns, count, exams, examples, perLevel } = validateData(path.resolve(process.env.DATA_DIR ?? 'data'));
  for (const w of warns.slice(0, 30)) console.log(`  경고  ${w}`);
  if (warns.length > 30) console.log(`  … 경고 ${warns.length - 30}개 더`);
  for (const e of errors.slice(0, 60)) console.log(`  오류  ${e}`);
  if (errors.length > 60) console.log(`  … 오류 ${errors.length - 60}개 더`);
  console.log(`등급별 단어 수: ${LEVELS.map((l, i) => `${l.level}단계 ${perLevel[i]}`).join(' · ')}`);
  console.log(`단어 ${count}개, 시험 ${exams}개(예문 ${examples}개) 검사 — 오류 ${errors.length}개, 경고 ${warns.length}개`);
  process.exit(errors.length ? 1 : 0);
}

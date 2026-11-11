/**
 * 단어 데이터 검사 — npm run data:validate
 * 직접 단어를 추가·수정한 뒤 실행한다. 오류가 있으면 종료 코드 1.
 *
 * 사전(data/words): 필수 필드, 등급(level 1~6), 품사·분류 허용값, id 형식·중복, 파일 위치,
 *   같은 표현이 두 단어에 등록됐는지, 외우기(memory) 형식, 시험 전용 필드가 섞여 있지 않은지
 * 시험(data/exams/<id>): 문제 파일 목록, 출현 횟수·예문·노트의 단어가 사전에 있는지,
 *   예문 속 강조 표기, 문맥 뜻이 senses 에 있는지, 문장 색인 형식
 * (파이프라인 작업 폴더가 있으면) 시험별 원형 누락
 */
import fs from 'node:fs';
import path from 'node:path';
import { isQuizSource } from '../src/lib/exams';
import { normalizeWord, type RawWord } from '../src/lib/normalize';
import { DOMAINS, LEVELS, MAX_LEVEL, POS_LIST, type Word } from '../src/lib/schema';
import { isMain, readJson, WORK } from './lib/common';
import { readExams } from './lib/data';

/** 단어에서 시험 폴더로 옮긴 필드 — 사전에 남아 있으면 안 된다 */
const LEGACY = ['tier', 'basic', 'freq', 'sources', 'contexts', 'note'];
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
      for (const f of ['id', 'word', 'pos', 'meaning'] as const) {
        if (!r?.[f] || (Array.isArray(r[f]) && !(r[f] as unknown[]).length)) errors.push(`${where}: 필수 필드 "${f}" 없음`);
      }
      if (!r?.id || !r.word) continue;
      if (!ID_RE.test(r.id)) errors.push(`${where}: id 는 소문자·숫자·하이픈만`);
      const letter = /^[a-z]/.test(r.id) ? r.id[0] : '0';
      if (file !== `${letter}.json`) warns.push(`${where}: ${letter}.json 에 두는 것이 규칙`);
      if (ids.has(r.id)) errors.push(`${where}: id 중복 (${ids.get(r.id)})`);
      ids.set(r.id, file);

      const w = normalizeWord(r);
      for (const p of w.pos) if (!(POS_LIST as readonly string[]).includes(p)) errors.push(`${where}: 알 수 없는 품사 "${p}"`);
      for (const s of w.senses) if (!(POS_LIST as readonly string[]).includes(s.pos)) errors.push(`${where}: senses 품사 "${s.pos}"`);
      if (!(DOMAINS as readonly string[]).includes(w.domain)) errors.push(`${where}: 알 수 없는 domain "${w.domain}"`);
      if (!r.short) warns.push(`${where}: short 없음 (객관식 보기에 meaning 을 줄여 씀)`);
      else if (/[A-Za-z]/.test(r.short)) warns.push(`${where}: short 에 영어가 있음 — 보기에서 정답이 드러날 수 있음`);
      if (w.short.length > 26) warns.push(`${where}: short 가 김 (${w.short.length}자)`);
      if (r.level === undefined) errors.push(`${where}: level(1~${MAX_LEVEL}) 없음`);
      else if (!Number.isInteger(r.level) || r.level < 1 || r.level > MAX_LEVEL) errors.push(`${where}: level 은 1~${MAX_LEVEL} 의 정수`);
      for (const k of LEGACY) if (k in r) errors.push(`${where}: "${k}" 는 사전에 적지 않는다 — 시험 폴더(data/exams)로`);
      dict.set(w.id, w);

      if (r.memory !== undefined) {
        const m = r.memory;
        if (!m || typeof m !== 'object' || Array.isArray(m)) errors.push(`${where}: memory 는 객체`);
        else {
          if (!w.memory) errors.push(`${where}: memory 에 story(어원 장면)나 hook(발음 연상) 중 하나는 있어야 함`);
          for (const k of ['origin', 'story', 'hook'] as const) {
            if (m[k] !== undefined && typeof m[k] !== 'string') errors.push(`${where}: memory.${k} 는 문자열`);
          }
          if (m.roots !== undefined && !Array.isArray(m.roots)) errors.push(`${where}: memory.roots 는 배열`);
          else for (const x of m.roots ?? []) if (!x?.part?.trim() || !x.ko?.trim()) errors.push(`${where}: memory.roots 항목에 part·ko 가 다 있어야 함`);
          if (m.family !== undefined && !Array.isArray(m.family)) errors.push(`${where}: memory.family 는 배열`);
          else if (m.family?.some((f) => f.toLowerCase() === w.word.toLowerCase())) warns.push(`${where}: memory.family 에 자기 자신이 있음`);
          for (const [k, max] of [['story', 80], ['hook', 60], ['origin', 50]] as const) {
            const v = w.memory?.[k];
            if (v && v.length > max) warns.push(`${where}: memory.${k} 가 김 (${v.length}자)`);
          }
        }
      }

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
    if (!ID_RE.test(exam.id)) errors.push(`${at}: 시험 id 는 소문자·숫자·하이픈만`);
    if (examIds.has(exam.id)) errors.push(`${at}: 시험 id 중복`);
    examIds.add(exam.id);
    if (!fs.existsSync(path.join(DATA, 'exams', exam.id, 'exam.json'))) errors.push(`${at}: exam.json 없음`);
    if (!exam.name.trim()) errors.push(`${at}: name 없음`);
    const srcIds = new Set<string>();
    for (const s of exam.sources) {
      if (!s?.id || !ID_RE.test(s.id)) errors.push(`${at}: 문제 파일 id "${s?.id}" 는 소문자·숫자·하이픈만`);
      else if (srcIds.has(s.id)) errors.push(`${at}: 문제 파일 id 중복 "${s.id}"`);
      if (!s?.name?.trim()) errors.push(`${at}: 문제 파일 ${s?.id} 에 name 없음`);
      if (s?.kind && s.kind !== 'quiz' && s.kind !== 'wordbook') errors.push(`${at}: 문제 파일 ${s.id} 의 kind 는 quiz / wordbook`);
      if (s?.id) srcIds.add(s.id);
    }
    const quiz = new Set(exam.sources.filter(isQuizSource).map((s) => s.id));
    if (!quiz.size) warns.push(`${at}: 문제 파일이 하나도 없음`);

    for (const [id, bySrc] of Object.entries(exam.index)) {
      if (!dict.has(id)) errors.push(`${at}/index.json: 사전에 없는 단어 "${id}"`);
      if (!bySrc || typeof bySrc !== 'object' || !Object.keys(bySrc).length) errors.push(`${at}/index.json › ${id}: { 문제 파일: 횟수 } 가 비어 있음`);
      else {
        for (const [src, n] of Object.entries(bySrc)) {
          if (!quiz.has(src)) errors.push(`${at}/index.json › ${id}: 문제 파일 목록에 없는 "${src}"`);
          if (!Number.isInteger(n) || n < 1) errors.push(`${at}/index.json › ${id}: ${src} 의 횟수는 1 이상의 정수`);
        }
      }
    }
    for (const [src, byWord] of Object.entries(exam.examples)) {
      const file = `${at}/examples/${src}.json`;
      if (!srcIds.has(src)) errors.push(`${file}: exam.json 의 sources 에 없는 파일`);
      for (const [id, list] of Object.entries(byWord)) {
        const w = dict.get(id);
        if (!w) {
          errors.push(`${file}: 사전에 없는 단어 "${id}"`);
          continue;
        }
        if (!Array.isArray(list)) {
          errors.push(`${file} › ${id}: 예문 목록이 배열이 아님`);
          continue;
        }
        for (const c of list) {
          exampleCount++;
          if (!c || typeof c.en !== 'string' || typeof c.surface !== 'string' || typeof c.sense !== 'string' || typeof c.pos !== 'string') {
            errors.push(`${file} › ${id}: 예문에 en·surface·pos·sense 가 다 있어야 함`);
            continue;
          }
          if (!c.en.toLowerCase().includes(c.surface.toLowerCase())) errors.push(`${file} › ${id}: 예문에 "${c.surface}" 없음`);
          if (!w.senses.some((s) => s.ko === c.sense)) errors.push(`${file} › ${id}: 문맥 뜻 "${c.sense}" 가 senses 에 없음`);
          if (!(POS_LIST as readonly string[]).includes(c.pos)) errors.push(`${file} › ${id}: 알 수 없는 품사 "${c.pos}"`);
          if (c.q !== undefined && (!Number.isInteger(c.q) || c.q < 0)) errors.push(`${file} › ${id}: q 는 0 이상의 정수`);
          if (c.n !== undefined && typeof c.n !== 'number') errors.push(`${file} › ${id}: n 은 숫자`);
        }
      }
    }
    for (const [src, list] of Object.entries(exam.sentences)) {
      const file = `${at}/sentences/${src}.json`;
      if (!quiz.has(src)) errors.push(`${file}: exam.json 의 문제 파일 목록에 없는 파일`);
      if (!Array.isArray(list) || list.some((x) => !x || typeof x.en !== 'string')) errors.push(`${file}: [{ q, en, ko? }] 형식이 아님`);
    }
    for (const [id, md] of Object.entries(exam.notes)) {
      if (!dict.has(id)) errors.push(`${at}/notes.json: 사전에 없는 단어 "${id}"`);
      if (typeof md !== 'string') errors.push(`${at}/notes.json › ${id}: 노트는 문자열`);
    }

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

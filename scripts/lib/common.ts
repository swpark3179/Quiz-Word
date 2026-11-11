import fs from 'node:fs';
import path from 'node:path';
import type { VocabEntry } from '../../src/lib/matcher';

export const QUIZ_DATA_DIR_PATH =
  process.env.QUIZ_DATA_DIR ?? 'C:/Users/s-w.park/Desktop/Quiz-Bank/assets/quiz-data';
/** 파이프라인 작업 폴더 — 시험마다 pipeline/work/<시험 id>/ 를 쓴다 */
export const WORK = path.resolve('pipeline/work');

export function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

/** pipeline/exams.json 의 한 항목 — 파이프라인이 다루는 시험 */
export interface ExamConfig {
  /** 시험 id — data/exams/<id>, pipeline/work/<id> 폴더 이름 */
  id: string;
  /** 화면에 보일 이름 */
  name: string;
  /** 시험을 보여 줄 순서 */
  order?: number;
  /** 문제 원본에서의 세트 id — config.json 의 id 이자 문제 파일 폴더 이름 */
  set: string;
  /** 쓰지 않을 문제 파일 id 의 정규식 (예: 한글판 "-kor$") */
  exclude?: string[];
  /** 그 시험의 기존 단어장 (index.json + <id>.md). 예문과 노트만 가져온다 */
  wordbook?: { id: string; name: string; dir: string };
}

export function loadExamConfigs(file = path.resolve('pipeline/exams.json')): ExamConfig[] {
  return readJson<ExamConfig[]>(file);
}

/** 명령줄의 --exam <id> (또는 --exam=<id>) 로 시험을 고른다 */
export function examFromArgs(argv: string[] = process.argv.slice(2)): ExamConfig {
  const at = argv.indexOf('--exam');
  const id = at >= 0 ? argv[at + 1] : argv.find((a) => a.startsWith('--exam='))?.slice(7);
  const all = loadExamConfigs();
  const exam = all.find((e) => e.id === id);
  if (!exam) {
    console.error(`시험을 골라 주세요: --exam <id>  (pipeline/exams.json 에 있는 시험: ${all.map((e) => e.id).join(', ')})`);
    process.exit(1);
  }
  return exam;
}

export const workDirOf = (exam: Pick<ExamConfig, 'id'>) => path.join(WORK, exam.id);

/** 이 문제 파일을 뺄지 (exclude 정규식에 걸리는지) */
export function isExcluded(exam: Pick<ExamConfig, 'exclude'>, fileId: string): boolean {
  return (exam.exclude ?? []).some((re) => new RegExp(re).test(fileId));
}

/** 문제 원본의 config.json 에서 그 시험의 문제 파일 목록 (순서대로, 뺄 파일 제외) */
export function examFiles(quizDir: string, exam: ExamConfig): { id: string; name: string }[] {
  const config = readJson<{ id: string; files: { id: string; name: string; order: number }[] }[]>(path.join(quizDir, 'config.json'));
  const set = config.find((c) => c.id === exam.set);
  if (!set) throw new Error(`config.json 에 ${exam.set} 없음`);
  return [...set.files]
    .sort((a, b) => a.order - b.order)
    .filter((f) => !isExcluded(exam, f.id))
    .map((f) => ({ id: f.id, name: f.name }));
}

/** 기존 단어장 항목 목록 (단어장이 없는 시험이면 빈 목록) */
export function loadWordbook(quizDir: string, exam: ExamConfig): VocabEntry[] {
  if (!exam.wordbook) return [];
  return readJson<VocabEntry[]>(path.join(quizDir, exam.wordbook.dir, 'index.json'));
}

export function wordbookMdPath(quizDir: string, exam: ExamConfig, id: string) {
  return path.join(quizDir, exam.wordbook?.dir ?? '', `${id}.md`);
}

/** 단어장 <id>.md 의 "문제 속 쓰임" 인용문에서 (영어, 한글) 예문 쌍을 뽑는다 */
export function parseVocabExamples(md: string): { en: string; ko: string }[] {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^##\s*문제 속 쓰임/.test(l.trim()));
  if (start < 0) return [];
  const quotes: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const t = line.trim();
    if (t.startsWith('##')) break;
    if (t.startsWith('>')) quotes.push(t.replace(/^>\s*/, ''));
  }
  const clean = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').trim();
  const out: { en: string; ko: string }[] = [];
  for (let i = 0; i < quotes.length; i++) {
    const en = quotes[i];
    const ko = quotes[i + 1];
    if (!/[가-힣]/.test(en) && ko && /[가-힣]/.test(ko)) {
      out.push({ en: clean(en), ko: clean(ko) });
      i++;
    }
  }
  return out;
}

/** 단어장 항목 id → 그 항목의 예문 (vid = "<단어장 id>:<항목 id>.<번호>") */
export function loadVocabExamples(quizDir: string, exam: ExamConfig, vocab: VocabEntry[]) {
  const map = new Map<string, { vid: string; en: string; ko: string }[]>();
  if (!exam.wordbook) return map;
  for (const v of vocab) {
    const p = wordbookMdPath(quizDir, exam, v.id);
    if (!fs.existsSync(p)) continue;
    const ex = parseVocabExamples(fs.readFileSync(p, 'utf8'));
    if (ex.length) map.set(v.id, ex.map((e, i) => ({ vid: `${exam.wordbook!.id}:${v.id}.${i}`, ...e })));
  }
  return map;
}

/** 이 파일이 명령줄에서 직접 실행됐는지 (테스트가 import 할 때는 실행하지 않도록) */
export function isMain(metaUrl: string): boolean {
  const entry = process.argv[1];
  return !!entry && path.resolve(entry) === path.resolve(new URL(metaUrl).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
}

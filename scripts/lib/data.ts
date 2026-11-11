/**
 * data/ 폴더 읽기·쓰기 — 검사·단어 세트·이전·병합 스크립트가 함께 쓴다.
 *   data/words/{a..z,0}.json    공통 사전
 *   data/exams/<시험 id>/…       시험 데이터 (src/lib/exams.ts 의 ExamData)
 */
import fs from 'node:fs';
import path from 'node:path';
import { assembleExams, type ExamData, type ExamSentence, type RawExample } from '../../src/lib/exams';
import type { RawWord } from '../../src/lib/normalize';

const read = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;

/** 단어 파일 이름 → 내용 (파일 이름 순) */
export function readDictFiles(dataDir: string): Map<string, RawWord[]> {
  const dir = path.join(dataDir, 'words');
  const out = new Map<string, RawWord[]>();
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) out.set(f, read<RawWord[]>(path.join(dir, f)));
  return out;
}

export const readDict = (dataDir: string): RawWord[] => [...readDictFiles(dataDir).values()].flat();

/** 단어가 들어갈 파일 — 첫 글자, 영문자가 아니면 0.json */
export const dictFileOf = (id: string) => `${/^[a-z]/.test(id) ? id[0] : '0'}.json`;

const byId = (a: string, b: string) => a.localeCompare(b);

/** 사전을 글자별 파일로 쓴다 (id 순, 2칸 들여쓰기). 예전 파일은 지운다 */
export function writeDict(dataDir: string, words: readonly RawWord[]) {
  const dir = path.join(dataDir, 'words');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) fs.rmSync(path.join(dir, f));
  const files = new Map<string, RawWord[]>();
  for (const w of words) {
    const f = dictFileOf(w.id ?? '');
    if (!files.has(f)) files.set(f, []);
    files.get(f)!.push(w);
  }
  for (const [f, list] of files) {
    list.sort((a, b) => byId(a.id ?? '', b.id ?? ''));
    fs.writeFileSync(path.join(dir, f), JSON.stringify(list, null, 2) + '\n');
  }
}

/** 모든 .json 파일을 (경로, 내용) 으로 */
function walk(dir: string, out: [string, unknown][] = []): [string, unknown][] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => byId(a.name, b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json')) out.push([p, read<unknown>(p)]);
  }
  return out;
}

export function readExams(dataDir: string): ExamData[] {
  const dir = path.join(dataDir, 'exams');
  return fs.existsSync(dir) ? assembleExams(walk(dir)) : [];
}

/** { 키: 값 } 을 키 순으로, 값 하나를 한 줄에 — 사람이 고치고 diff 로 보기 좋게 */
function linesObject(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort(byId);
  return keys.length ? `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(obj[k])}`).join(',\n')}\n}\n` : '{}\n';
}

function linesArray(list: readonly unknown[]): string {
  return list.length ? `[\n${list.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n]\n` : '[]\n';
}

/** { 단어 id: [예문…] } — 예문 하나가 한 줄 */
function examplesFile(byWord: Record<string, RawExample[]>): string {
  const keys = Object.keys(byWord).sort(byId);
  if (!keys.length) return '{}\n';
  const body = keys.map((k) => `  ${JSON.stringify(k)}: [\n${byWord[k].map((e) => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]`);
  return `{\n${body.join(',\n')}\n}\n`;
}

/** 시험 하나를 data/exams/<id>/ 에 쓴다 — 그 시험 폴더만 새로 만들고 다른 시험은 건드리지 않는다 */
export function writeExam(dataDir: string, exam: ExamData) {
  const dir = path.join(dataDir, 'exams', exam.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'examples'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sentences'), { recursive: true });
  const meta = { id: exam.id, name: exam.name, ...(exam.order !== undefined ? { order: exam.order } : {}), sources: exam.sources };
  fs.writeFileSync(path.join(dir, 'exam.json'), JSON.stringify(meta, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'index.json'), linesObject(exam.index));
  fs.writeFileSync(path.join(dir, 'notes.json'), linesObject(exam.notes));
  for (const s of exam.sources) {
    const ex = exam.examples[s.id];
    if (ex && Object.keys(ex).length) fs.writeFileSync(path.join(dir, 'examples', `${s.id}.json`), examplesFile(ex));
    const sen: ExamSentence[] | undefined = exam.sentences[s.id];
    if (sen?.length) fs.writeFileSync(path.join(dir, 'sentences', `${s.id}.json`), linesArray(sen));
  }
}

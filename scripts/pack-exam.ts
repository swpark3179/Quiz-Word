/**
 * 저장소의 시험 하나를 시험 팩 파일로 — npm run data:pack-exam -- --exam <시험 id>
 * data/exams/<시험 id>/ 와 그 시험이 쓰는 단어 → wordset/<시험 id>.exampack.json
 * 그 시험만 iPhone 앱에 얹을 때 쓴다 (앱 → 설정 → 시험 → 시험 팩 불러오기).
 */
import fs from 'node:fs';
import path from 'node:path';
import { examPackFileName, packExam, validateExamPack } from '../src/lib/exampack';
import { isMain } from './lib/common';
import { readDict, readExams } from './lib/data';

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--exam');
  const id = at >= 0 ? argv[at + 1] : argv.find((a) => a.startsWith('--exam='))?.slice(7);
  const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
  const exams = readExams(dataDir);
  const exam = exams.find((e) => e.id === id);
  if (!exam) {
    console.error(`시험을 골라 주세요: --exam <id>  (data/exams 에 있는 시험: ${exams.map((e) => e.id).join(', ')})`);
    process.exit(2);
  }
  const pack = packExam(readDict(dataDir), exam);
  const text = JSON.stringify(pack);
  const { errors, warns } = validateExamPack(JSON.parse(text));
  for (const w of warns) console.log(`  경고  ${w}`);
  for (const e of errors.slice(0, 40)) console.log(`  오류  ${e}`);
  if (errors.length) {
    console.log(`시험 팩 검사 오류 ${errors.length}개 — 파일을 만들지 않았습니다 (data/ 의 그 단어·예문을 먼저 고치세요)`);
    process.exit(1);
  }
  const out = path.resolve('wordset');
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, examPackFileName(exam.id));
  fs.writeFileSync(file, text);
  console.log(`${exam.name}: 단어 ${pack.words.length}개 · 문제 파일 ${exam.sources.length}개 (${(Buffer.byteLength(text) / 1e6).toFixed(1)} MB) → ${path.relative(process.cwd(), file)}`);
}

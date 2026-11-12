/**
 * 시험 팩을 저장소의 data/ 에 합친다 — npm run data:add-pack <파일.exampack.json>
 *
 * 앱의 "시험 팩 불러오기"와 같은 규칙(src/lib/exampack.ts 의 mergeExamPack)으로 합친다:
 *   사전에 이미 있는 단어는 그대로 두고(새 뜻·변화형만 덧붙임), 없는 단어만 data/words 에 넣고,
 *   data/exams/<시험 id>/ 를 쓴다 (같은 id 의 시험이 있으면 그 폴더만 새로 쓴다). 다른 시험은 건드리지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { mergeExamPack, validateExamPack, type MergeReport } from '../src/lib/exampack';
import { isMain } from './lib/common';
import { dictFileOf, readDictFiles, readExams, writeExam } from './lib/data';
import { validateData } from './validate';

export interface AddPackResult {
  errors: string[];
  warns: string[];
  report?: MergeReport;
  /** 고쳐 쓴 사전 파일 */
  rewritten: string[];
}

export function addExamPack(file: string, dataDir: string): AddPackResult {
  const { errors, warns, pack } = validateExamPack(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')));
  if (!pack) return { errors, warns, rewritten: [] };

  const dictFiles = readDictFiles(dataDir);
  const merged = mergeExamPack({ words: [...dictFiles.values()].flat(), exams: readExams(dataDir) }, pack);

  // 사전: 글자별 파일로 다시 나눠, 내용이 바뀐 파일만 쓴다
  const next = new Map<string, typeof merged.words>();
  for (const w of merged.words) {
    const f = dictFileOf(w.id ?? '');
    if (!next.has(f)) next.set(f, []);
    next.get(f)!.push(w);
  }
  const wordsDir = path.join(dataDir, 'words');
  fs.mkdirSync(wordsDir, { recursive: true });
  const rewritten: string[] = [];
  for (const [f, list] of next) {
    list.sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));
    const text = JSON.stringify(list, null, 2) + '\n';
    const before = dictFiles.has(f) ? JSON.stringify(dictFiles.get(f), null, 2) + '\n' : undefined;
    if (text === before) continue;
    fs.writeFileSync(path.join(wordsDir, f), text);
    rewritten.push(f);
  }
  writeExam(dataDir, merged.exams.find((e) => e.id === pack.exam.id)!);
  return { errors: [], warns, report: merged.report, rewritten };
}

if (isMain(import.meta.url)) {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('사용법: npm run data:add-pack <파일.exampack.json>');
    process.exit(2);
  }
  const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
  const r = addExamPack(path.resolve(file), dataDir);
  for (const w of r.warns) console.log(`  경고  ${w}`);
  for (const e of r.errors) console.log(`  오류  ${e}`);
  if (!r.report) {
    console.log(`시험 팩 형식 오류 ${r.errors.length}개 — data/ 는 바꾸지 않았습니다`);
    process.exit(1);
  }
  const { report } = r;
  console.log(`${report.examName} (data/exams/${report.examId}) ${report.replacedExam ? '— 있던 시험을 바꿈' : '— 새 시험 추가'}: 문제 파일 ${report.sources}개 · 예문 ${report.examples}개`);
  console.log(`사전: 새 단어 ${report.addedWords.length}개 추가, 이미 있던 단어 ${report.keptWords.length}개는 그대로${report.addedSenses.length ? ` (그중 ${new Set(report.addedSenses.map((s) => s.id)).size}개에 뜻 ${report.addedSenses.length}개를 덧붙임)` : ''} — 파일 ${r.rewritten.length}개 고침`);
  for (const s of report.addedSenses.slice(0, 20)) console.log(`  뜻 추가  ${s.id}: ${s.ko}`);
  if (report.addedSenses.length > 20) console.log(`  … ${report.addedSenses.length - 20}개 더`);
  const v = validateData(dataDir);
  for (const e of v.errors.slice(0, 30)) console.log(`  오류  ${e}`);
  console.log(`data 검사 — 오류 ${v.errors.length}개, 경고 ${v.warns.length}개`);
  process.exit(v.errors.length ? 1 : 0);
}

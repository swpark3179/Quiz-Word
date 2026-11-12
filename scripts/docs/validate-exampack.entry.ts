/**
 * 시험 팩 검증기의 원본 — docs/validate-exampack.mjs 는 이 파일을 esbuild 로 묶은 것이다 (npm run docs:build).
 * 검사 규칙은 앱이 불러올 때 쓰는 것과 같은 코드(src/lib/exampack.ts 의 validateExamPack)다.
 *
 *   node validate-exampack.mjs <파일.exampack.json> [--json]
 *     종료 코드 0 = 불러올 수 있음, 1 = 오류 있음, 2 = 파일을 읽지 못함
 *   브라우저·다른 스크립트에서는 import { validateExamPack } from './validate-exampack.mjs'
 */
import { EXAMPACK_VERSION, validateExamPack } from '../../src/lib/exampack';

export { EXAMPACK_VERSION, validateExamPack };

export interface CheckSummary {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** 오류가 없을 때의 요약 */
  summary?: { exam: string; name: string; sources: number; words: number; examples: number; sentences: number };
}

/** 검사하고 요약까지 — 명령줄과 브라우저 검증기가 함께 쓴다 */
export function checkExamPack(data: unknown): CheckSummary {
  const { errors, warns, pack } = validateExamPack(data);
  if (!pack) return { ok: false, errors, warnings: warns };
  const examples = Object.values(pack.exam.examples).reduce((a, byWord) => a + Object.values(byWord).reduce((b, list) => b + list.length, 0), 0);
  const sentences = Object.values(pack.exam.sentences).reduce((a, list) => a + list.length, 0);
  return {
    ok: true,
    errors,
    warnings: warns,
    summary: { exam: pack.exam.id, name: pack.exam.name, sources: pack.exam.sources.length, words: pack.words.length, examples, sentences },
  };
}

async function main(argv: string[]): Promise<number> {
  const { readFileSync } = await import('node:fs');
  const json = argv.includes('--json');
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('사용법: node validate-exampack.mjs <파일.exampack.json> [--json]');
    return 2;
  }
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    if (json) console.log(JSON.stringify({ ok: false, errors: [`파일을 읽지 못함: ${(e as Error).message}`], warnings: [] }));
    else console.error(`ERROR  파일을 읽지 못함 (JSON 형식 오류일 수 있음): ${(e as Error).message}`);
    return 2;
  }
  const r = checkExamPack(data);
  if (json) console.log(JSON.stringify(r, null, 2));
  else {
    for (const w of r.warnings) console.log(`WARN   ${w}`);
    for (const e of r.errors) console.log(`ERROR  ${e}`);
    if (r.summary) console.log(`시험 ${r.summary.exam} (${r.summary.name}) — 문제 파일 ${r.summary.sources}개 · 단어 ${r.summary.words}개 · 예문 ${r.summary.examples}개 · 문장 ${r.summary.sentences}개`);
    console.log(`RESULT: ${r.ok ? 'PASS' : 'FAIL'} errors=${r.errors.length} warnings=${r.warnings.length} (시험 팩 형식 버전 ${EXAMPACK_VERSION})`);
  }
  return r.ok ? 0 : 1;
}

// node 로 직접 실행했을 때만 명령줄로 동작한다 (브라우저나 import 로 쓸 때는 아무것도 하지 않는다)
if (typeof process !== 'undefined' && process.versions?.node && process.argv[1]) {
  const { realpathSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  let direct = false;
  try {
    direct = realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    // 경로를 확인하지 못하면 명령줄로 보지 않는다
  }
  if (direct) process.exitCode = await main(process.argv.slice(2));
}

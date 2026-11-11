/**
 * 웹과 공용인 로직(../src/lib)과 단어 데이터(../data)를 앱 안으로 복사한다 → src/generated/
 * Metro 가 저장소 밖 파일을 직접 읽으면 React 가 두 벌 로드될 수 있어 복사 방식을 쓴다.
 * npm install(postinstall)·npm start(prestart)·npm run export:ios 때 자동으로 실행된다.
 * 여기서 복사한 단어는 앱에 내장되는 "앱 기본 단어 세트"다. 설정에서 단어 세트 파일을 불러오면 그쪽을 쓴다.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, '..');
const repo = path.resolve(mobile, '..');
const out = path.join(mobile, 'src', 'generated');

// 웹 전용(브라우저 음성) 파일과 테스트는 빼고 복사
const LIB_SKIP = new Set(['tts.ts']);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'lib'), { recursive: true });
fs.mkdirSync(path.join(out, 'data', 'words'), { recursive: true });

const header = '// 자동 생성 파일 — 수정하지 마세요. 원본: ';
let libCount = 0;
for (const f of fs.readdirSync(path.join(repo, 'src', 'lib'))) {
  if (!f.endsWith('.ts') || LIB_SKIP.has(f)) continue;
  const src = fs.readFileSync(path.join(repo, 'src', 'lib', f), 'utf8');
  fs.writeFileSync(path.join(out, 'lib', f), `${header}src/lib/${f}\n${src}`);
  libCount++;
}

const wordFiles = fs
  .readdirSync(path.join(repo, 'data', 'words'))
  .filter((f) => f.endsWith('.json'))
  .sort();
for (const f of wordFiles) fs.copyFileSync(path.join(repo, 'data', 'words', f), path.join(out, 'data', 'words', f));

// 시험 데이터 (data/exams/<시험>/…) — 폴더째 복사하고, 파일 목록을 정적 require 로 만든다
const examFiles = [];
function copyExams(rel) {
  const from = path.join(repo, 'data', 'exams', rel);
  if (!fs.existsSync(from)) return;
  for (const e of fs.readdirSync(from, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const next = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) copyExams(next);
    else if (e.name.endsWith('.json')) {
      const to = path.join(out, 'data', 'exams', next);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(from, e.name), to);
      examFiles.push(next);
    }
  }
}
copyExams('');

/** 앱 기본 단어 세트의 날짜 — 단어 데이터를 마지막으로 커밋한 시각 (git 이 없으면 지금) */
function dataDate() {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', 'data'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) return new Date(out).toISOString();
  } catch {
    // git 이 없거나 저장소가 아님
  }
  return new Date().toISOString();
}

// Metro 는 동적 require 를 못 하므로 단어 파일 목록을 정적 require 로 만든다.
// 함수 안에서 require 하므로 부를 때에만 평가된다 — 불러온 단어 세트가 있으면 내장 데이터(수 MB)는 아예 읽지 않는다.
const index = [
  `${header}data/words · data/exams (scripts/sync-shared.mjs)`,
  "import { assembleExams, type ExamData } from './lib/exams';",
  "import type { RawWord } from './lib/normalize';",
  '',
  'export function loadBundledWords(): RawWord[] {',
  '  const files: RawWord[][] = [',
  ...wordFiles.map((f) => `    require('./data/words/${f}'),`),
  '  ];',
  '  return files.flat();',
  '}',
  '',
  'export function loadBundledExams(): ExamData[] {',
  '  const files: [string, unknown][] = [',
  ...examFiles.map((f) => `    ['${f}', require('./data/exams/${f}')],`),
  '  ];',
  '  return assembleExams(files);',
  '}',
  '',
  `export const BUNDLED_BUILT_AT = '${dataDate()}';`,
  '',
].join('\n');
fs.writeFileSync(path.join(out, 'wordFiles.ts'), index);

const words = wordFiles.reduce((n, f) => n + JSON.parse(fs.readFileSync(path.join(repo, 'data', 'words', f), 'utf8')).length, 0);
console.log(`[sync-shared] 공용 로직 ${libCount}개, 단어 파일 ${wordFiles.length}개(${words}단어), 시험 파일 ${examFiles.length}개 → src/generated`);

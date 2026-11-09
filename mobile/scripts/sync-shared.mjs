/**
 * 웹과 공용인 로직(../src/lib)과 단어 데이터(../data)를 앱 안으로 복사한다 → src/generated/
 * Metro 가 저장소 밖 파일을 직접 읽으면 React 가 두 벌 로드될 수 있어 복사 방식을 쓴다.
 * npm install(postinstall)·npm start(prestart)·OTA 배포(npm run ota) 때 자동으로 실행된다.
 */
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
for (const f of ['corpus.json', 'sources.json']) fs.copyFileSync(path.join(repo, 'data', f), path.join(out, 'data', f));

// Metro 는 동적 require 를 못 하므로 단어 파일 목록을 정적 require 로 만든다
const index = [
  `${header}data/words (scripts/sync-shared.mjs)`,
  "import type { RawWord } from './lib/normalize';",
  '',
  'export const WORD_FILES: RawWord[][] = [',
  ...wordFiles.map((f) => `  require('./data/words/${f}'),`),
  '];',
  '',
  `export const DATA_BUILT_AT = '${new Date().toISOString()}';`,
  '',
].join('\n');
fs.writeFileSync(path.join(out, 'wordFiles.ts'), index);

const words = wordFiles.reduce((n, f) => n + JSON.parse(fs.readFileSync(path.join(repo, 'data', 'words', f), 'utf8')).length, 0);
console.log(`[sync-shared] 공용 로직 ${libCount}개, 단어 파일 ${wordFiles.length}개(${words}단어) → src/generated`);

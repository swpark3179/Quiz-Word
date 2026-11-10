/**
 * 단어 세트 파일 만들기 — npm run data:pack (먼저 data:validate 를 통과해야 만든다)
 * data/words/*.json + corpus.json + sources.json → wordset/quiz-word-words-YYYYMMDD.json
 * 웹 설정의 "단어 세트 파일 내려받기"와 같은 파일이다. iPhone 으로 옮겨 앱 → 설정 → 단어 세트 → 파일에서 불러오기.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CorpusSentence } from '../src/lib/corpus';
import type { RawWord } from '../src/lib/normalize';
import type { SourceInfo } from '../src/lib/schema';
import { packWordSet, parseWordSet, wordSetFileName } from '../src/lib/wordset';
import { readJson } from './lib/common';

const DATA = path.resolve('data');
const OUT = path.resolve('wordset');

const words = fs
  .readdirSync(path.join(DATA, 'words'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .flatMap((f) => readJson<RawWord[]>(path.join(DATA, 'words', f)));
const set = packWordSet({
  words,
  corpus: readJson<CorpusSentence[]>(path.join(DATA, 'corpus.json')),
  sources: readJson<SourceInfo[]>(path.join(DATA, 'sources.json')),
});

const text = JSON.stringify(set);
parseWordSet(JSON.parse(text)); // 앱이 읽는 검사를 한 번 통과시켜 본다

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, wordSetFileName(set.builtAt));
fs.writeFileSync(file, text);
console.log(`단어 세트 ${set.count}개 (${(Buffer.byteLength(text) / 1e6).toFixed(1)} MB) → ${path.relative(process.cwd(), file)}`);
console.log('iPhone 으로 옮긴 뒤 앱 → 설정 → 단어 세트 → 파일에서 불러오기');

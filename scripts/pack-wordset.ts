/**
 * 단어 세트 파일 만들기 — npm run data:pack (먼저 data:validate 를 통과해야 만든다)
 * data/words/*.json + data/exams/** → wordset/quiz-word-words-YYYYMMDD.json
 * 웹 설정의 "단어 세트 파일 내려받기"와 같은 파일이다. iPhone 으로 옮겨 앱 → 설정 → 단어 세트 → 파일에서 불러오기.
 */
import fs from 'node:fs';
import path from 'node:path';
import { packWordSet, parseWordSet, wordSetFileName } from '../src/lib/wordset';
import { readDict, readExams } from './lib/data';

const DATA = path.resolve('data');
const OUT = path.resolve('wordset');

const set = packWordSet({ words: readDict(DATA), exams: readExams(DATA) });

const text = JSON.stringify(set);
parseWordSet(JSON.parse(text)); // 앱이 읽는 검사를 한 번 통과시켜 본다

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, wordSetFileName(set.builtAt));
fs.writeFileSync(file, text);
console.log(`단어 세트 ${set.count}개 · 시험 ${set.exams.length}개 (${(Buffer.byteLength(text) / 1e6).toFixed(1)} MB) → ${path.relative(process.cwd(), file)}`);
console.log('iPhone 으로 옮긴 뒤 앱 → 설정 → 단어 세트 → 파일에서 불러오기');

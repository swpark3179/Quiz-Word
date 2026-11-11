/**
 * 난이도 점수 → 6단계 등급 — npx tsx scripts/apply-levels.ts [--write]
 *
 * pipeline/work/levels/scores-*.txt 의 "id=점수"(10~69, 십의 자리가 교육과정 단계)를 읽어
 * 단계마다 300~400개가 되도록 경계 점수를 정하고 pipeline/work/levels/levels.json 에 적는다.
 * 같은 점수의 단어는 항상 같은 단계에 둔다. --write 를 주면 data/words 의 level 도 고친다.
 * 기준표는 pipeline/prompts/level.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LEVELS } from '../src/lib/schema';
import { readJson } from './lib/common';

const DIR = path.resolve('pipeline/work/levels');
const WORDS = path.resolve('data/words');
const MIN = 300;
const MAX = 400;
const N_LEVELS = LEVELS.length;

interface Entry {
  id: string;
  basic?: boolean;
}

const files = fs.readdirSync(WORDS).filter((f) => f.endsWith('.json')).sort();
const words: Entry[] = files.flatMap((f) => readJson<Entry[]>(path.join(WORDS, f)));
const known = new Set(words.map((w) => w.id));

const scores = new Map<string, number>();
const problems: string[] = [];
for (const f of fs.readdirSync(DIR).filter((x) => /^scores-.*\.txt$/.test(x)).sort()) {
  for (const tok of fs.readFileSync(path.join(DIR, f), 'utf8').split(/\s+/).filter(Boolean)) {
    const at = tok.lastIndexOf('=');
    const id = tok.slice(0, at);
    const score = Number(tok.slice(at + 1));
    if (at < 0 || !Number.isInteger(score) || score < 10 || score > 69) problems.push(`${f}: 잘못된 항목 "${tok}"`);
    else if (scores.has(id)) problems.push(`${f}: ${id} 가 두 번 나옴`);
    else if (!known.has(id)) problems.push(`${f}: 사전에 없는 id ${id}`);
    else scores.set(id, score);
  }
}
for (const w of words) if (!scores.has(w.id)) problems.push(`점수 없음: ${w.id}`);
if (problems.length) {
  for (const p of problems.slice(0, 40)) console.log(`  오류  ${p}`);
  console.log(`오류 ${problems.length}개 — 등급을 정하지 않았습니다`);
  process.exit(1);
}

// 점수별 단어 수 → 경계 5개를 모두 따져, 단계별 개수가 가장 고른 조합을 고른다
const distinct = [...new Set(scores.values())].sort((a, b) => a - b);
const countAt = new Map<number, number>();
for (const s of scores.values()) countAt.set(s, (countAt.get(s) ?? 0) + 1);
const cum: number[] = []; // cum[i] = distinct[i] 이하인 단어 수
distinct.reduce((acc, s, i) => (cum[i] = acc + countAt.get(s)!), 0);
const total = scores.size;
const ideal = total / N_LEVELS;

let best: { cuts: number[]; cost: number } | undefined;
function search(level: number, from: number, prev: number, cuts: number[], cost: number) {
  if (level === N_LEVELS - 1) {
    const size = total - prev;
    if (size < MIN || size > MAX) return;
    const c = cost + (size - ideal) ** 2;
    if (!best || c < best.cost) best = { cuts: [...cuts], cost: c };
    return;
  }
  for (let i = from; i < distinct.length - 1; i++) {
    const size = cum[i] - prev;
    if (size > MAX) break;
    if (size < MIN) continue;
    cuts.push(i);
    search(level + 1, i + 1, cum[i], cuts, cost + (size - ideal) ** 2);
    cuts.pop();
  }
}
search(0, 0, 0, [], 0);
if (!best) {
  console.log(`단계마다 ${MIN}~${MAX}개가 되는 경계를 찾지 못했습니다 — 점수를 더 잘게 나누어 주세요`);
  process.exit(1);
}

/** 각 단계의 최고 점수 (마지막 단계는 69) */
const upper = [...best.cuts.map((i) => distinct[i]), 69];
const levelOf = (score: number) => upper.findIndex((u) => score <= u) + 1;
const levels: Record<string, number> = {};
for (const w of words) levels[w.id] = levelOf(scores.get(w.id)!);

fs.writeFileSync(path.join(DIR, 'levels.json'), JSON.stringify({ upper, levels }, null, 1) + '\n');

const sizes = LEVELS.map((l) => Object.values(levels).filter((x) => x === l.level).length);
console.log(`단어 ${total}개`);
LEVELS.forEach((l, i) => console.log(`  ${l.level}단계 ${l.name.padEnd(8)} 점수 ${i ? upper[i - 1] + 1 : 10}~${upper[i]}  ${sizes[i]}개`));
if (words.some((w) => w.basic !== undefined)) {
  const basicUp = words.filter((w) => w.basic && levels[w.id] > 1).map((w) => `${w.id}(${levels[w.id]})`);
  const easyNew = words.filter((w) => !w.basic && levels[w.id] === 1).map((w) => w.id);
  console.log(`예전 기초인데 1단계가 아닌 단어 ${basicUp.length}개: ${basicUp.join(', ')}`);
  console.log(`기초가 아니었는데 1단계가 된 단어 ${easyNew.length}개: ${easyNew.join(', ')}`);
}

if (process.argv.includes('--write')) {
  for (const f of files) {
    const list = readJson<Record<string, unknown>[]>(path.join(WORDS, f));
    const next = list.map((w) => {
      const { id, word, level: _old, ...rest } = w;
      return { id, word, level: levels[id as string], ...rest };
    });
    fs.writeFileSync(path.join(WORDS, f), JSON.stringify(next, null, 2) + '\n');
  }
  console.log(`data/words 의 level 을 고쳤습니다 (${files.length}개 파일)`);
}

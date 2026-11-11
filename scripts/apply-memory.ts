/**
 * 외우기(memory) 생성 결과 검사·반영
 *   npx tsx scripts/apply-memory.ts --check [out 파일…]   검사만
 *   npx tsx scripts/apply-memory.ts                       pipeline/work/memory/out-*.json 을 data/words 에 반영
 *
 * 이미 memory 가 있는 단어는 절대 덮어쓰지 않는다. 형식 규칙은 pipeline/prompts/memory.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeMemory } from '../src/lib/normalize';
import type { Memory } from '../src/lib/schema';
import { readJson } from './lib/common';

const DIR = path.resolve('pipeline/work/memory');
const WORDS = path.resolve('data/words');
const LIMITS = { story: 80, hook: 60, origin: 50 } as const;
const KEYS = ['roots', 'origin', 'story', 'hook', 'family'];

type Entry = Record<string, unknown> & { id: string; word: string; memory?: Memory };

const check = process.argv.includes('--check');
const named = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const outFiles = named.length
  ? named.map((f) => path.resolve(f))
  : fs.readdirSync(DIR).filter((f) => /^out-\d+\.json$/.test(f)).sort().map((f) => path.join(DIR, f));

const wordFiles = fs.readdirSync(WORDS).filter((f) => f.endsWith('.json')).sort();
const dict = new Map<string, Entry[]>(wordFiles.map((f) => [f, readJson<Entry[]>(path.join(WORDS, f))]));
const byId = new Map<string, Entry>([...dict.values()].flat().map((w) => [w.id, w]));

const errors: string[] = [];
const warns: string[] = [];
const accepted = new Map<string, Memory>();
const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

for (const file of outFiles) {
  const name = path.basename(file);
  let out: Record<string, Memory>;
  try {
    out = readJson<Record<string, Memory>>(file);
  } catch (e) {
    errors.push(`${name}: JSON 형식 오류 — ${(e as Error).message}`);
    continue;
  }
  if (!out || typeof out !== 'object' || Array.isArray(out)) {
    errors.push(`${name}: 최상위는 { id: memory } 객체`);
    continue;
  }
  const inFile = path.join(path.dirname(file), name.replace(/^out-/, 'in-'));
  if (fs.existsSync(inFile)) {
    const want = readJson<{ id: string }[]>(inFile).map((x) => x.id);
    for (const id of want) if (!(id in out)) errors.push(`${name}: ${id} 가 빠짐`);
    for (const id of Object.keys(out)) if (!want.includes(id)) errors.push(`${name}: 입력에 없는 id ${id}`);
  }
  for (const [id, m] of Object.entries(out)) {
    const where = `${name} › ${id}`;
    const w = byId.get(id);
    if (!w) {
      errors.push(`${where}: 사전에 없는 단어`);
      continue;
    }
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      errors.push(`${where}: memory 는 객체`);
      continue;
    }
    for (const k of Object.keys(m)) if (!KEYS.includes(k)) errors.push(`${where}: 모르는 필드 "${k}"`);
    for (const k of ['origin', 'story', 'hook'] as const) {
      if (m[k] !== undefined && typeof m[k] !== 'string') errors.push(`${where}: ${k} 는 문자열`);
    }
    if (m.roots !== undefined && (!Array.isArray(m.roots) || m.roots.some((r) => !r || typeof r.part !== 'string' || typeof r.ko !== 'string' || !r.part.trim() || !r.ko.trim()))) {
      errors.push(`${where}: roots 는 [{ part, ko }]`);
      continue;
    }
    if (m.family !== undefined && (!Array.isArray(m.family) || m.family.some((f) => typeof f !== 'string'))) {
      errors.push(`${where}: family 는 문자열 배열`);
      continue;
    }
    const norm = normalizeMemory(m);
    if (!norm) {
      errors.push(`${where}: story 나 hook 중 하나는 있어야 함`);
      continue;
    }
    for (const [k, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
      const v = norm[k];
      if (v && v.length > max) errors.push(`${where}: ${k} 가 김 (${v.length}자, ${max}자 이하)`);
    }
    for (const k of ['story', 'hook'] as const) {
      const v = norm[k];
      if (v && !/[가-힣]/.test(v)) errors.push(`${where}: ${k} 에 한글 설명이 없음`);
      if (v && !v.includes('→')) warns.push(`${where}: ${k} 가 "→ 뜻" 으로 끝나지 않음`);
    }
    const self = w.word.toLowerCase();
    if (norm.family?.some((f) => f.toLowerCase() === self)) errors.push(`${where}: family 에 자기 자신이 있음`);
    if (norm.family?.some((f) => /[가-힣]/.test(f))) errors.push(`${where}: family 는 영어 단어만`);
    if (norm.family && norm.family.length > 5) warns.push(`${where}: family 가 많음 (${norm.family.length}개)`);
    const spelled = letters(w.word);
    for (const r of norm.roots ?? []) {
      const part = letters(r.part);
      if (part && !spelled.includes(part)) warns.push(`${where}: 어원 조각 "${r.part}" 이 철자 "${w.word}" 에 안 보임 — 확인`);
    }
    if (norm.roots && norm.roots.length > 5) warns.push(`${where}: roots 가 많음 (${norm.roots.length}개)`);
    if (accepted.has(id)) errors.push(`${where}: 다른 배치에도 있음`);
    accepted.set(id, norm);
  }
}

for (const w of warns.slice(0, 60)) console.log(`  경고  ${w}`);
if (warns.length > 60) console.log(`  … 경고 ${warns.length - 60}개 더`);
for (const e of errors.slice(0, 80)) console.log(`  오류  ${e}`);
if (errors.length > 80) console.log(`  … 오류 ${errors.length - 80}개 더`);
console.log(`외우기 ${accepted.size}개 (${outFiles.length}개 파일) — 오류 ${errors.length}개, 경고 ${warns.length}개`);
if (errors.length) process.exit(1);
if (check) process.exit(0);

let added = 0;
let kept = 0;
for (const [f, list] of dict) {
  let changed = false;
  for (const w of list) {
    const m = accepted.get(w.id);
    if (!m) continue;
    if (w.memory) {
      kept++;
      continue;
    }
    w.memory = m;
    added++;
    changed = true;
  }
  if (changed) fs.writeFileSync(path.join(WORDS, f), JSON.stringify(list, null, 2) + '\n');
}
console.log(`반영 ${added}개, 이미 있어서 그대로 둔 단어 ${kept}개`);

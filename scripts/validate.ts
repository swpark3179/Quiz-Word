/**
 * 단어 데이터 검사 — npm run data:validate
 * 직접 단어를 추가·수정한 뒤 실행한다. 오류가 있으면 종료 코드 1.
 *
 * 검사: 필수 필드, 품사·분류 허용값, id 형식·중복, 파일 위치, 같은 표현이 두 단어에 등록됐는지,
 *       예문 속 강조 표기, 문맥 뜻이 senses 에 있는지, (파이프라인 작업 폴더가 있으면) ccar-f 원형 누락
 */
import fs from 'node:fs';
import path from 'node:path';
import { DOMAINS, POS_LIST } from '../src/lib/schema';
import { normalizeWord, type RawWord } from '../src/lib/normalize';
import { readJson, WORK } from './lib/common';

const DIR = path.resolve('data/words');
const errors: string[] = [];
const warns: string[] = [];
const sources = new Set(readJson<{ id: string }[]>(path.resolve('data/sources.json')).map((s) => s.id));

const ids = new Map<string, string>();
const surfaces = new Map<string, string>();
let count = 0;

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  let raw: RawWord[];
  try {
    raw = readJson<RawWord[]>(path.join(DIR, file));
  } catch (e) {
    errors.push(`${file}: JSON 형식 오류 — ${(e as Error).message}`);
    continue;
  }
  if (!Array.isArray(raw)) {
    errors.push(`${file}: 최상위가 배열이 아님`);
    continue;
  }
  for (const r of raw) {
    count++;
    const where = `${file} › ${r?.id ?? '(id 없음)'}`;
    for (const f of ['id', 'word', 'pos', 'meaning'] as const) {
      if (!r?.[f] || (Array.isArray(r[f]) && !(r[f] as unknown[]).length)) errors.push(`${where}: 필수 필드 "${f}" 없음`);
    }
    if (!r?.id || !r.word) continue;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) errors.push(`${where}: id 는 소문자·숫자·하이픈만`);
    const letter = /^[a-z]/.test(r.id) ? r.id[0] : '0';
    if (file !== `${letter}.json`) warns.push(`${where}: ${letter}.json 에 두는 것이 규칙`);
    if (ids.has(r.id)) errors.push(`${where}: id 중복 (${ids.get(r.id)})`);
    ids.set(r.id, file);

    const w = normalizeWord(r);
    for (const p of w.pos) if (!(POS_LIST as readonly string[]).includes(p)) errors.push(`${where}: 알 수 없는 품사 "${p}"`);
    for (const s of w.senses) if (!(POS_LIST as readonly string[]).includes(s.pos)) errors.push(`${where}: senses 품사 "${s.pos}"`);
    if (!(DOMAINS as readonly string[]).includes(w.domain)) errors.push(`${where}: 알 수 없는 domain "${w.domain}"`);
    if (!r.short) warns.push(`${where}: short 없음 (객관식 보기에 meaning 을 줄여 씀)`);
    else if (/[A-Za-z]/.test(r.short)) warns.push(`${where}: short 에 영어가 있음 — 보기에서 정답이 드러날 수 있음`);
    if (w.short.length > 26) warns.push(`${where}: short 가 김 (${w.short.length}자)`);
    if (r.tier && r.tier !== 'core' && r.tier !== 'extra') errors.push(`${where}: tier 는 core / extra`);

    for (const c of w.contexts) {
      if (!c.en.toLowerCase().includes(c.surface.toLowerCase())) errors.push(`${where}: 예문에 "${c.surface}" 없음`);
      if (!w.senses.some((s) => s.ko === c.sense)) errors.push(`${where}: 문맥 뜻 "${c.sense}" 가 senses 에 없음`);
      if (!sources.has(c.src)) errors.push(`${where}: 알 수 없는 출처 "${c.src}"`);
    }

    for (const s of [w.word, ...(w.forms ?? [])].map((x) => x.toLowerCase())) {
      const owner = surfaces.get(s);
      if (owner && owner !== w.id) errors.push(`${where}: 표현 "${s}" 가 ${owner} 에도 등록됨`);
      surfaces.set(s, w.id);
    }
  }
}

// ccar-f 원형 누락 (파이프라인 작업물이 있을 때만)
const lemmasPath = path.join(WORK, 'lemmas.json');
if (fs.existsSync(lemmasPath)) {
  const skipped = fs.existsSync(path.join(WORK, 'skipped.json'))
    ? readJson<Record<string, string>>(path.join(WORK, 'skipped.json'))
    : {};
  const lemmas = readJson<{ lemma: string; surfaces: Record<string, number> }[]>(lemmasPath);
  const missing = lemmas.filter(
    (l) =>
      !skipped[l.lemma] &&
      !surfaces.has(l.lemma) &&
      !Object.keys(l.surfaces).some((s) => surfaces.has(s.toLowerCase())),
  );
  if (missing.length) {
    errors.push(`ccar-f 원형 ${missing.length}개 누락: ${missing.slice(0, 40).map((m) => m.lemma).join(', ')}${missing.length > 40 ? ' …' : ''}`);
    fs.writeFileSync(path.join(WORK, 'missing.json'), JSON.stringify(missing.map((m) => m.lemma)));
  }
}

for (const w of warns.slice(0, 30)) console.log(`  경고  ${w}`);
if (warns.length > 30) console.log(`  … 경고 ${warns.length - 30}개 더`);
for (const e of errors.slice(0, 60)) console.log(`  오류  ${e}`);
if (errors.length > 60) console.log(`  … 오류 ${errors.length - 60}개 더`);
console.log(`단어 ${count}개 검사 — 오류 ${errors.length}개, 경고 ${warns.length}개`);
process.exit(errors.length ? 1 : 0);

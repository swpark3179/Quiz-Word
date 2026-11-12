/**
 * GitHub Pages(docs/)에 올리는 생성물 만들기 — npm run docs:build
 *
 *   docs/validate-exampack.mjs   시험 팩 검증기 (앱이 쓰는 검사 코드를 esbuild 로 묶은 것, 의존성 없음)
 *   docs/exampack.schema.json    JSON Schema (품사·분류·단계 허용값은 src/lib/schema.ts 에서 가져온다)
 *
 * 생성물은 커밋한다. 검사 규칙(src/lib/checks.ts, exampack.ts)이나 허용값을 고쳤으면 다시 만들어야 한다 —
 * 잊으면 테스트(scripts/__tests__/docs.test.ts)가 알려 준다.
 *   docs/exam-pack-guide.md      가이드의 "완성 예시" 자리에 example.exampack.json 을 끼워 넣는다 (나머지는 손으로 쓴다)
 * 손으로 쓰는 파일: docs/exam-pack-guide.md(예시 자리 빼고), docs/example.exampack.json, docs/index.html, docs/llms.txt
 *
 *   npm run docs:build -- --check   다시 만들지 않고 커밋된 것이 최신인지만 확인
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { MEMORY_LIMITS } from '../src/lib/checks';
import { EXAMPACK_APP, EXAMPACK_KIND, EXAMPACK_VERSION, validateExamPack } from '../src/lib/exampack';
import { DOMAINS, MAX_LEVEL, POS_LIST } from '../src/lib/schema';
import { isMain } from './lib/common';

export const DOCS = path.resolve('docs');
export const PAGES_URL = 'https://swpark3179.github.io/Quiz-Word';
const ID_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';

/** 시험 팩의 구조·필수 필드·허용값. 단어끼리 맞물리는 규칙(예문의 뜻이 senses 에 있는지 등)은 검증기가 본다 */
export function examPackSchema() {
  const id = { type: 'string', pattern: ID_PATTERN };
  const pos = { enum: [...POS_LIST] };
  const sense = { type: 'object', required: ['pos', 'ko'], additionalProperties: false, properties: { pos, ko: { type: 'string', minLength: 1 } } };
  const memory = {
    type: 'object',
    description: '외우기 — story 나 hook 중 하나는 있어야 한다',
    additionalProperties: false,
    anyOf: [{ required: ['story'] }, { required: ['hook'] }],
    properties: {
      roots: { type: 'array', items: { type: 'object', required: ['part', 'ko'], additionalProperties: false, properties: { part: { type: 'string', minLength: 1 }, ko: { type: 'string', minLength: 1 } } } },
      origin: { type: 'string', maxLength: MEMORY_LIMITS.origin },
      story: { type: 'string', minLength: 1, maxLength: MEMORY_LIMITS.story },
      hook: { type: 'string', minLength: 1, maxLength: MEMORY_LIMITS.hook },
      family: { type: 'array', items: { type: 'string', minLength: 1 } },
    },
  };
  const word = {
    type: 'object',
    required: ['id', 'word', 'level', 'pos', 'meaning', 'short', 'senses', 'domain'],
    additionalProperties: false,
    properties: {
      id: { ...id, description: '표제어를 소문자로, 아포스트로피는 지우고, 영문자·숫자가 아닌 것은 하이픈 하나로' },
      word: { type: 'string', minLength: 1 },
      level: { type: 'integer', minimum: 1, maximum: MAX_LEVEL },
      pos: { type: 'array', minItems: 1, items: pos },
      ipa: { type: 'string' },
      meaning: { type: 'string', minLength: 1 },
      short: { type: 'string', minLength: 1 },
      senses: { type: 'array', minItems: 1, items: sense },
      forms: { type: 'array', items: { type: 'string', minLength: 1 } },
      synonyms: { type: 'array', items: { type: 'string', minLength: 1 } },
      domain: { enum: [...DOMAINS] },
      memory,
    },
    // 2단계 이상이면 외우기 필수
    if: { properties: { level: { type: 'integer', minimum: 2 } }, required: ['level'] },
    then: { required: ['memory'] },
  };
  const example = {
    type: 'object',
    required: ['en', 'surface', 'pos', 'sense'],
    additionalProperties: false,
    properties: {
      n: { type: 'number', description: '그 단어의 예문을 보여 줄 순서 (작은 것부터)' },
      q: { type: 'integer', minimum: 0, description: '문제 번호' },
      en: { type: 'string', minLength: 1 },
      surface: { type: 'string', minLength: 1, description: 'en 안에 실제로 나온 표기' },
      pos,
      sense: { type: 'string', minLength: 1, description: '그 단어 senses 의 ko 중 하나와 글자 그대로 같아야 한다' },
      ko: { type: 'string' },
    },
  };
  const sentence = { type: 'object', required: ['en'], additionalProperties: false, properties: { q: { type: 'integer', minimum: 0 }, en: { type: 'string', minLength: 1 }, ko: { type: 'string' } } };
  const byId = (value: object) => ({ type: 'object', propertyNames: { pattern: ID_PATTERN }, additionalProperties: value });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${PAGES_URL}/exampack.schema.json`,
    title: `Quiz Word 시험 팩 (버전 ${EXAMPACK_VERSION})`,
    description: '시험 하나와 그 시험이 쓰는 단어를 담은 파일. 구조·필수 필드·허용값만 본다 — 전체 검사는 validate-exampack.mjs 로.',
    type: 'object',
    required: ['app', 'kind', 'version', 'builtAt', 'exam', 'words'],
    additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      app: { const: EXAMPACK_APP },
      kind: { const: EXAMPACK_KIND },
      version: { const: EXAMPACK_VERSION },
      builtAt: { type: 'string', format: 'date-time' },
      exam: {
        type: 'object',
        required: ['id', 'name', 'sources', 'index'],
        additionalProperties: false,
        properties: {
          id,
          name: { type: 'string', minLength: 1 },
          order: { type: 'number' },
          sources: {
            type: 'array',
            minItems: 1,
            items: { type: 'object', required: ['id', 'name'], additionalProperties: false, properties: { id, name: { type: 'string', minLength: 1 }, kind: { enum: ['quiz', 'wordbook'] } } },
          },
          index: { ...byId(byId({ type: 'integer', minimum: 1 })), minProperties: 1, description: '단어 id → 문제 파일 id → 나온 횟수' },
          examples: { ...byId(byId({ type: 'array', items: example })), description: '문제 파일 id → 단어 id → 예문' },
          sentences: { ...byId({ type: 'array', items: sentence }), description: '문제 파일 id → 문제 문장' },
          notes: { ...byId({ type: 'string' }), description: '단어 id → 마크다운 노트' },
        },
      },
      words: { type: 'array', minItems: 1, items: word },
    },
  };
}

const EXAMPLE_START = '<!-- example:start -->';
const EXAMPLE_END = '<!-- example:end -->';

/** 가이드의 "완성 예시" 자리에 예시 파일의 내용을 끼워 넣는다 — 가이드만 읽어도 완성본을 볼 수 있게 */
export function guideWithExample(guide: string, example: string): string {
  const a = guide.indexOf(EXAMPLE_START);
  const b = guide.indexOf(EXAMPLE_END);
  if (a < 0 || b < a) throw new Error('가이드에 example:start / example:end 표시가 없습니다');
  return `${guide.slice(0, a + EXAMPLE_START.length)}\n\`\`\`json\n${example.trim()}\n\`\`\`\n${guide.slice(b)}`;
}

/** 생성물을 outDir 에 만든다 (가이드의 예시 자리도 채운다) */
export async function buildDocs(outDir: string = DOCS): Promise<string[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const validator = path.join(outDir, 'validate-exampack.mjs');
  await build({
    entryPoints: [path.resolve('scripts/docs/validate-exampack.entry.ts')],
    outfile: validator,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    external: ['node:*'],
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
    banner: {
      js: [
        `// Quiz Word 시험 팩 검증기 (형식 버전 ${EXAMPACK_VERSION}) — 자동 생성 파일, 고치지 마세요.`,
        '// 원본: scripts/docs/validate-exampack.entry.ts + src/lib/exampack.ts (npm run docs:build)',
        '// 사용: node validate-exampack.mjs <파일.exampack.json> [--json]   종료 코드 0 = 통과, 1 = 오류, 2 = 파일을 읽지 못함',
        `// 가이드: ${PAGES_URL}/exam-pack-guide.md`,
      ].join('\n'),
    },
  });
  const schema = path.join(outDir, 'exampack.schema.json');
  fs.writeFileSync(schema, JSON.stringify(examPackSchema(), null, 2) + '\n');
  const guide = path.join(outDir, 'exam-pack-guide.md');
  fs.writeFileSync(guide, guideWithExample(fs.readFileSync(path.join(DOCS, 'exam-pack-guide.md'), 'utf8'), fs.readFileSync(path.join(DOCS, 'example.exampack.json'), 'utf8')));
  return [validator, schema, guide];
}

if (isMain(import.meta.url)) {
  const check = process.argv.includes('--check');
  const out = check ? fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'quiz-word-docs-')) : DOCS;
  const files = await buildDocs(out);
  if (check) {
    const stale = files.map((f) => path.basename(f)).filter((f) => !fs.existsSync(path.join(DOCS, f)) || fs.readFileSync(path.join(DOCS, f), 'utf8') !== fs.readFileSync(path.join(out, f), 'utf8'));
    fs.rmSync(out, { recursive: true, force: true });
    if (stale.length) {
      console.error(`docs/ 의 생성물이 최신이 아닙니다: ${stale.join(', ')} — npm run docs:build`);
      process.exit(1);
    }
    console.log('docs/ 의 생성물이 최신입니다');
  } else {
    for (const f of files) console.log(`${path.relative(process.cwd(), f)} (${(fs.statSync(f).size / 1024).toFixed(0)} KB)`);
  }
  // 예시 파일은 손으로 쓰지만 항상 검사를 통과해야 한다
  const example = path.join(DOCS, 'example.exampack.json');
  const { errors } = validateExamPack(JSON.parse(fs.readFileSync(example, 'utf8')));
  if (errors.length) {
    console.error(`docs/example.exampack.json 이 검사를 통과하지 못합니다:\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
}

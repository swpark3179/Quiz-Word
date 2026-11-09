/**
 * 문장 분리·토큰화·원형 추정 — extract 스크립트와 테스트가 함께 쓴다.
 */
import lemmatizer from 'wink-lemmatizer';

/** 마크다운 강조 기호를 걷어 표시용 문장으로 만든다 (인라인 코드 백틱은 유지) */
export function cleanMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, '$1') // [text](url) → text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[\s(])\*(\S[^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/(^|[\s(])_(\S[^_]*?)_(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ABBREVIATIONS = ['e.g.', 'i.e.', 'etc.', 'vs.', 'approx.', 'Dr.', 'Mr.', 'Ms.', 'Inc.', 'No.', 'U.S.'];

/** 영어 문단을 문장으로 나눈다. 인라인 코드 안의 마침표에서는 나누지 않는다. */
export function splitSentences(text: string): string[] {
  // 인라인 코드와 약어를 자리표시자로 감싼다
  const saved: string[] = [];
  let t = text.replace(/`[^`]*`/g, (m) => {
    saved.push(m);
    return `\u0000${saved.length - 1}\u0000`;
  });
  for (const ab of ABBREVIATIONS) {
    t = t.split(ab).join(ab.replace(/\./g, '\u0001'));
  }
  // 앞의 [Scenario: …] 표시는 따로 뗀다
  const parts: string[] = [];
  const scenario = t.match(/^\s*\[[^\]]{3,80}\]\s*/);
  if (scenario) {
    parts.push(scenario[0].trim());
    t = t.slice(scenario[0].length);
  }
  const re = /(?<=[.!?])["')\]]?\s+(?=["'(\[`\u0000]?[A-Z0-9\u0000])/g;
  let last = 0;
  for (const m of t.matchAll(re)) {
    const end = m.index! + m[0].length;
    parts.push(t.slice(last, end).trim());
    last = end;
  }
  parts.push(t.slice(last).trim());
  return parts
    .filter((p) => p.length > 0)
    .map((p) =>
      p
        .replace(/\u0001/g, '.')
        .replace(/\u0000(\d+)\u0000/g, (_, i) => saved[Number(i)]),
    );
}

/** 토큰화에서 제외할 부분(인라인 코드·URL·경로)을 같은 길이의 공백으로 가린다 */
export function maskNonProse(s: string): string {
  const blank = (m: string) => ' '.repeat(m.length);
  return s
    .replace(/`[^`]*`/g, blank)
    .replace(/https?:\/\/\S+/g, blank)
    .replace(/\b[\w.-]+\/[\w./-]+/g, blank) // 경로 (src/api, .claude/rules)
    .replace(/\b[\w-]+\.(md|json|py|ts|js|yaml|yml|txt|sh|toml|csv|pdf)\b/gi, blank) // 파일 이름
    .replace(/--?[a-z][\w-]*/g, (m, offset: number, whole: string) =>
      offset === 0 || /\s/.test(whole[offset - 1]) ? blank(m) : m,
    ); // CLI 플래그 (--resume)
}

export interface RawToken {
  text: string;
  start: number;
  /** 문장 첫 단어인지 (대문자 고유명사 판별용) */
  initial: boolean;
}

/** 영문 단어 토큰. 하이픈·아포스트로피 결합어는 한 토큰 */
export function tokenize(masked: string): RawToken[] {
  const out: RawToken[] = [];
  const re = /[A-Za-z0-9_]+(?:['’][A-Za-z]+)?(?:-[A-Za-z0-9_]+(?:['’][A-Za-z]+)?)*/g;
  for (const m of masked.matchAll(re)) {
    const before = masked.slice(0, m.index!).replace(/[\s"'(\[*>#-]+$/, '');
    const initial = before.length === 0 || /[.!?:\]]$/.test(before);
    out.push({ text: m[0], start: m.index!, initial });
  }
  return out;
}

const KEEP_AS_IS = new Set(['data', 'media', 'news', 'series', 'species', 'its', 'this', 'analysis', 'basis', 'status', 'bias', 'always', 'perhaps', 'news']);

/** 소문자 단어의 원형 추정 (최종 원형은 생성 단계에서 확정한다) */
export function guessLemma(w: string): string {
  if (KEEP_AS_IS.has(w) || w.length <= 3) return w;
  const v = lemmatizer.verb(w);
  const n = lemmatizer.noun(w);
  const a = lemmatizer.adjective(w);
  if (/(ing|ed)$/.test(w)) return v !== w ? v : w;
  if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) return n !== w ? n : v !== w ? v : w;
  if (/(er|est)$/.test(w) && a !== w) return a;
  if (v !== w) return v;
  if (n !== w) return n;
  return w;
}

/** 소유격·축약 정리. 결과가 null 이면 버린다 (can't, it's 같은 기능어 축약) */
export function normalizeToken(raw: string): string | null {
  let w = raw.replace(/’/g, "'");
  if (/n't$/i.test(w) || /'(re|ve|ll|d|m)$/i.test(w)) return null;
  w = w.replace(/'s?$/i, '');
  return w;
}

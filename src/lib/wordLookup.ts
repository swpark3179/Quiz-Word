/**
 * 다른 앱에서 단어 상세 열기 — `quizword://lookup?word=…&x-source=…&x-error=…`
 *
 * x-callback-url 방식: 찾는 단어가 하나도 없으면 호출한 앱이 넘긴 `x-error` 주소를 열어
 * '결과 없음'을 알린다(그 앱이 다시 앞으로 온다). 단어가 있으면 단어장 앱에서 상세를 보여 주고 따로 알리지 않는다.
 * 앱(mobile)의 +native-intent 와 단어장 화면이 쓰고, React Native 의존성이 없어 vitest 로 검증한다.
 */
import type { Word } from './schema';
import { searchWords } from './search';

/** lookup 주소의 동작 이름 (`quizword://lookup`) */
export const LOOKUP_ACTION = 'lookup';
/** 콜백으로 열어 줄 수 있는 스킴 — 아무 주소나 열지 않게 아는 앱만 둔다 */
export const CALLBACK_SCHEMES = ['quizbank'];
/** 찾을 단어의 최대 길이 (구까지 넉넉히) */
export const MAX_LOOKUP_LENGTH = 64;

export interface LookupRequest {
  /** 찾을 단어 (공백 정리됨) */
  word: string;
  /** 결과가 없을 때 열 주소 (허용 스킴만, 아니면 없음) */
  xError?: string;
  /** 호출한 앱 이름 (표시용) */
  source?: string;
}

export type LookupResult = { kind: 'exact'; word: Word } | { kind: 'partial'; count: number } | { kind: 'none' };

/** 앞뒤 공백을 걷고 연속 공백을 한 칸으로, 너무 길면 자른다 */
export function cleanLookupWord(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, MAX_LOOKUP_LENGTH).trim();
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/** 쿼리 문자열 → 키별 첫 값 (React Native 의 URL 구현에 기대지 않고 직접 나눈다) */
function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = decode(eq < 0 ? part : part.slice(0, eq));
    const v = eq < 0 ? '' : decode(part.slice(eq + 1));
    if (!(k in out)) out[k] = v;
  }
  return out;
}

/** 스킴 (소문자) — 없으면 '' */
function schemeOf(url: string): string {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  return m ? m[1].toLowerCase() : '';
}

/** 허용된 스킴의 콜백 주소만 남긴다 */
export function safeCallback(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  return CALLBACK_SCHEMES.includes(schemeOf(u)) ? u : undefined;
}

/**
 * 들어온 주소가 단어 찾기 요청이면 내용을, 아니면 null.
 * `quizword://lookup?…` · `quizword:///lookup?…` · `/lookup?…` · `lookup?…` 를 모두 받는다 (Expo Go 의 `exp://…/--/lookup?…` 도).
 */
export function parseLookupUrl(url: string): LookupRequest | null {
  if (!url) return null;
  const q = url.indexOf('?');
  const head = (q < 0 ? url : url.slice(0, q)).replace(/#.*$/, '');
  const query = q < 0 ? '' : url.slice(q + 1).replace(/#.*$/, '');
  // 스킴과 '//' 를 떼고, Expo Go 의 '--/' 뒤만 본다
  let path = head.replace(/^[a-z][a-z0-9+.-]*:/i, '').replace(/^\/\//, '');
  const dash = path.indexOf('/--/');
  if (dash >= 0) path = path.slice(dash + 4);
  const segments = path.split('/').filter(Boolean);
  if (segments[segments.length - 1] !== LOOKUP_ACTION) return null;
  // 주소 앞부분이 lookup 하나뿐이어야 한다 (Expo Go 는 호스트:포트가 앞에 붙으므로 '--/' 로 이미 걸렀다)
  if (segments.length !== 1) return null;
  const params = parseQuery(query);
  const word = cleanLookupWord(params.word ?? params.q ?? '');
  if (!word) return null;
  const xError = safeCallback(params['x-error']);
  const source = cleanLookupWord(params['x-source'] ?? '') || undefined;
  return { word, ...(xError ? { xError } : {}), ...(source ? { source } : {}) };
}

/**
 * 단어 찾기 — 표제어·변화형이 정확히 같으면(대소문자 무시) 그 단어,
 * 아니면 단어장 검색(searchWords)에 걸리는 단어 수, 하나도 없으면 none.
 */
export function resolveLookup(word: string, bySurface: Map<string, Word>, words: Word[]): LookupResult {
  const key = cleanLookupWord(word).toLowerCase();
  if (!key) return { kind: 'none' };
  const exact = bySurface.get(key);
  if (exact) return { kind: 'exact', word: exact };
  const count = searchWords(words, key).length;
  return count > 0 ? { kind: 'partial', count } : { kind: 'none' };
}

/** 주소 끝에 쿼리 파라미터를 붙인다 */
export function appendQuery(url: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  if (!qs) return url;
  const hash = url.indexOf('#');
  const base = hash < 0 ? url : url.slice(0, hash);
  const frag = hash < 0 ? '' : url.slice(hash);
  const sep = !base.includes('?') ? '?' : base.endsWith('?') || base.endsWith('&') ? '' : '&';
  return `${base}${sep}${qs}${frag}`;
}

/** 결과 없음 콜백 주소 (x-callback-url 의 errorCode·errorMessage + 찾던 단어). 허용되지 않은 주소면 null */
export function notFoundCallbackUrl(xError: string | undefined, word: string): string | null {
  const safe = safeCallback(xError);
  if (!safe) return null;
  return appendQuery(safe, { errorCode: 'not_found', errorMessage: '단어장에 없는 단어예요', word: cleanLookupWord(word) });
}

/** 단어장 화면으로 넘길 경로 — t 는 같은 단어를 다시 찾아도 화면이 한 번 더 처리하게 하는 표시 */
export function lookupHref(req: LookupRequest, nonce: string | number): string {
  return appendQuery('/words', { lookup: req.word, t: String(nonce), ...(req.xError ? { xerr: req.xError } : {}) });
}

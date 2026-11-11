/**
 * data/words/*.json 의 항목(공통 사전)을 앱이 쓰는 Word 로 맞춘다.
 * 직접 추가한 단어는 최소 필드(id, word, pos, meaning)만 있어도 되도록 나머지를 기본값으로 채운다.
 *   pos: "명사·동사" 처럼 문자열로 적어도 된다
 *   short 없으면 meaning 에서 만든다, senses 없으면 meaning 하나로, domain 없으면 "일반", level 없으면 4
 * 시험에 딸린 값(freq·occ·contexts·notes)은 비워 두고, buildWordData(exams.ts)가 시험 데이터를 읽어 채운다.
 */
import { DEFAULT_LEVEL, MAX_LEVEL, type Level, type Memory, type Sense, type Word } from './schema';

/** 공통 사전의 단어 한 항목 (data/words/*.json 에 적는 모양) */
export interface RawWord {
  id?: string;
  word?: string;
  level?: number;
  pos?: string | string[];
  ipa?: string;
  meaning?: string;
  short?: string;
  senses?: Sense[];
  forms?: string[];
  synonyms?: string[];
  domain?: string;
  memory?: Memory;
}

/** 1~6 의 정수가 아니면 기본 단계 */
export function normalizeLevel(v: unknown): Level {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_LEVEL ? (v as Level) : DEFAULT_LEVEL;
}

const splitPos = (p: string | string[] | undefined): string[] =>
  (Array.isArray(p) ? p : (p ?? '').split(/[·,/]/)).map((x) => x.trim()).filter(Boolean);

/** meaning 에서 객관식 보기용 짧은 뜻을 만든다 (①②·영어 괄호·— 뒤 설명 제거) */
export function shortFromMeaning(meaning: string): string {
  const first = meaning.split(/②/)[0];
  return (
    first
      .replace(/[①-⑨]/g, '')
      .replace(/\([^)]*[A-Za-z][^)]*\)/g, '')
      .split(/\s[—–-]\s/)[0]
      .replace(/\s+/g, ' ')
      .trim() || meaning
  );
}

/** 빈 조각·빈 문자열을 걷어 낸다. 장면(story)도 발음 연상(hook)도 없으면 보여 줄 게 없으니 버린다 */
export function normalizeMemory(m: Memory | undefined): Memory | undefined {
  if (!m) return undefined;
  const text = (s: string | undefined) => s?.trim() || undefined;
  const story = text(m.story);
  const hook = text(m.hook);
  if (!story && !hook) return undefined;
  const roots = (m.roots ?? []).filter((x) => x?.part?.trim() && x.ko?.trim()).map((x) => ({ part: x.part.trim(), ko: x.ko.trim() }));
  const family = (m.family ?? []).map((x) => x?.trim()).filter((x): x is string => !!x);
  const origin = text(m.origin);
  return {
    ...(roots.length ? { roots } : {}),
    ...(origin ? { origin } : {}),
    ...(story ? { story } : {}),
    ...(hook ? { hook } : {}),
    ...(family.length ? { family } : {}),
  };
}

export function normalizeWord(r: RawWord): Word {
  const pos = splitPos(r.pos);
  const meaning = r.meaning ?? '';
  const senses: Sense[] = r.senses?.length ? r.senses : [{ pos: pos[0] ?? '명사', ko: shortFromMeaning(meaning) }];
  const memory = normalizeMemory(r.memory);
  return {
    id: r.id ?? '',
    word: r.word ?? '',
    level: normalizeLevel(r.level),
    pos,
    ...(r.ipa ? { ipa: r.ipa.replace(/^\/|\/$/g, '') } : {}),
    meaning,
    short: r.short?.trim() || shortFromMeaning(meaning),
    senses,
    ...(r.forms?.length ? { forms: r.forms } : {}),
    ...(r.synonyms?.length ? { synonyms: r.synonyms } : {}),
    domain: r.domain ?? '일반',
    ...(memory ? { memory } : {}),
    freq: 0,
    occ: {},
    contexts: [],
  };
}

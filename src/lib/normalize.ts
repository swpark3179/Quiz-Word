/**
 * data/words/*.json 의 항목을 앱이 쓰는 Word 로 맞춘다.
 * 직접 추가한 단어는 최소 필드(id, word, pos, meaning)만 있어도 되도록 나머지를 기본값으로 채운다.
 *   pos: "명사·동사" 처럼 문자열로 적어도 된다
 *   short 없으면 meaning 에서 만든다, senses 없으면 meaning 하나로, domain 없으면 "일반", tier 없으면 "extra"
 */
import type { Context, Sense, Word } from './schema';

export type RawWord = Partial<Omit<Word, 'pos'>> & { pos?: string | string[] };

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

export function normalizeWord(r: RawWord): Word {
  const pos = splitPos(r.pos);
  const meaning = r.meaning ?? '';
  const senses: Sense[] = r.senses?.length ? r.senses : [{ pos: pos[0] ?? '명사', ko: shortFromMeaning(meaning) }];
  const contexts: Context[] = (r.contexts ?? []).map((c) => ({ ...c, q: c.q ?? 0 }));
  return {
    id: r.id ?? '',
    word: r.word ?? '',
    tier: r.tier === 'core' ? 'core' : 'extra',
    ...(r.basic ? { basic: true } : {}),
    pos,
    ...(r.ipa ? { ipa: r.ipa.replace(/^\/|\/$/g, '') } : {}),
    meaning,
    short: r.short?.trim() || shortFromMeaning(meaning),
    senses,
    ...(r.forms?.length ? { forms: r.forms } : {}),
    ...(r.synonyms?.length ? { synonyms: r.synonyms } : {}),
    domain: r.domain ?? '일반',
    freq: r.freq ?? 0,
    sources: r.sources ?? [],
    contexts,
    ...(r.note ? { note: r.note } : {}),
  };
}

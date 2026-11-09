/**
 * 1단계 — ccar-f 문제 파일에서 문장과 단어(원형)를 뽑는다.
 *
 * 출력 (pipeline/work/):
 *   questions.json  문제별 한글 번역 참고본 {key, src, q, koRef}
 *   sentences.json  문장 {sid, key, src, q, part, en, lang}
 *   lemmas.json     원형별 {lemma, vocabId?, surfaces, freq, sources, sids}
 *
 * 실행: npm run data:extract  (QUIZ_DATA_DIR 로 원본 위치를 바꿀 수 있다)
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseQuizMarkdown } from './lib/quizParser';
import { createVocabMatcher, surfacesOf, type VocabEntry } from '../src/lib/matcher';
import { FUNCTION_WORDS, PROPER_TECH } from './stopwords';
import { cleanMarkdown, guessLemma, maskNonProse, normalizeToken, splitSentences, tokenize } from './lib/text';

export const QUIZ_DATA_DIR =
  process.env.QUIZ_DATA_DIR ?? 'C:/Users/s-w.park/Desktop/Quiz-Bank/assets/quiz-data';
export const SET_ID = 'ccar-f';
const WORK = path.resolve('pipeline/work');

interface SentenceRec {
  sid: string;
  key: string;
  src: string;
  q: number;
  part: 'stem' | 'body' | 'choice';
  en: string;
  lang: 'en' | 'ko';
}

interface LemmaRec {
  lemma: string;
  vocabId?: string;
  surfaces: Record<string, number>;
  freq: number;
  sources: string[];
  sids: string[];
  /** 문장 중간에서 대문자로만 나옴 — 고유명사일 수 있음 (생성 단계에서 판단) */
  maybeProper?: boolean;
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

/** 해설 안의 "📝 문제 번역" 구역 (문제·보기 한글 번역) */
function extractKoRef(explanation: string): string | undefined {
  const lines = explanation.split('\n');
  const start = lines.findIndex((l) => l.includes('문제 번역'));
  if (start < 0) return undefined;
  const out: string[] = [];
  let inFence = false;
  for (const line of lines.slice(start + 1)) {
    const t = line.trim();
    if (t.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^>\s*\*\*(핵심|정답)/.test(t) || /^\d+\.\s*\*\*(정답|오답)/.test(t) || /^>\s*🏷/.test(t)) break;
    if (t) out.push(cleanMarkdown(t.replace(/^-\s*/, '')));
  }
  return out.length ? out.join('\n') : undefined;
}

/** 문제 본문 아래 추가 마크다운에서 코드 블록·표를 뺀 문장 */
function proseOfBody(body: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (t.startsWith('```') || t.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !t || t.startsWith('|')) continue;
    out.push(t.replace(/^[-*>]\s*/, ''));
  }
  return out;
}

const hasHangul = (s: string) => /[가-힣]/.test(s);

export function main() {
  const config = readJson<{ id: string; files: { id: string; name: string; order: number }[] }[]>(
    path.join(QUIZ_DATA_DIR, 'config.json'),
  );
  const set = config.find((c) => c.id === SET_ID);
  if (!set) throw new Error(`config.json 에 ${SET_ID} 없음`);
  const files = [...set.files].sort((a, b) => a.order - b.order);

  const vocab = readJson<VocabEntry[]>(path.join(QUIZ_DATA_DIR, 'vocab/index.json'));
  const matcher = createVocabMatcher(vocab);
  const vocabBySurface = new Map<string, VocabEntry>();
  for (const v of vocab) for (const s of surfacesOf(v)) if (!vocabBySurface.has(s)) vocabBySurface.set(s, v);
  const vocabLookup = (w: string) =>
    vocabBySurface.get(w) ??
    (w.endsWith('s') ? vocabBySurface.get(w.slice(0, -1)) : undefined) ??
    (w.endsWith('es') ? vocabBySurface.get(w.slice(0, -2)) : undefined);

  const questions: { key: string; src: string; q: number; koRef?: string }[] = [];
  const sentences: SentenceRec[] = [];
  const lemmas = new Map<string, LemmaRec>();
  // 대문자 판별: 문장 중간에서 대문자로만 나오면 고유명사
  const capStats = new Map<string, { lower: number; capMid: number }>();
  const occurrences: { key: string; surface: string; sid: string; src: string; vocabId?: string }[] = [];

  for (const file of files) {
    const md = fs.readFileSync(path.join(QUIZ_DATA_DIR, SET_ID, `${file.id}.md`), 'utf8');
    const qs = parseQuizMarkdown(md, file.id);
    for (const q of qs) {
      const key = `${file.id}#${q.id}`;
      questions.push({ key, src: file.id, q: q.id, koRef: extractKoRef(q.explanation) });

      const blocks: { part: SentenceRec['part']; text: string }[] = [{ part: 'stem', text: q.question }];
      if (q.questionBody) for (const t of proseOfBody(q.questionBody)) blocks.push({ part: 'body', text: t });
      for (const c of q.choices) blocks.push({ part: 'choice', text: c.label.replace(/^(\d+[.)]|[①-⑧])\s*/, '') });

      let idx = 0;
      for (const b of blocks) {
        const clean = cleanMarkdown(b.text);
        const pieces = b.part === 'choice' ? [clean] : splitSentences(clean);
        for (const en of pieces) {
          if (!/[A-Za-z]{2,}/.test(maskNonProse(en))) continue;
          const sid = `${key}.${idx++}`;
          const lang = hasHangul(en) ? 'ko' : 'en';
          sentences.push({ sid, key, src: file.id, q: q.id, part: b.part, en, lang });

          // 1) vocab 표현(구 포함)을 먼저 찾고, 2) 나머지를 토큰으로
          const masked = maskNonProse(en);
          const covered = new Uint8Array(masked.length);
          let offset = 0;
          for (const seg of matcher.split(masked)) {
            if (seg.entry) {
              occurrences.push({ key: seg.entry.word.toLowerCase(), surface: seg.text.toLowerCase(), sid, src: file.id, vocabId: seg.entry.id });
              covered.fill(1, offset, offset + seg.text.length);
            }
            offset += seg.text.length;
          }
          for (const tok of tokenize(masked)) {
            if (covered[tok.start]) continue;
            const norm = normalizeToken(tok.text);
            if (!norm) continue;
            if (/[0-9_]/.test(norm)) continue; // 숫자·snake_case
            if (/[a-z][A-Z]/.test(norm)) continue; // camelCase
            if (norm.length >= 2 && norm === norm.toUpperCase()) continue; // 약어 (JSON, PII)
            const lower = norm.toLowerCase();
            const parts = lower.includes('-') ? lower.split('-') : [lower];
            for (const p of parts) {
              const st = capStats.get(p) ?? { lower: 0, capMid: 0 };
              if (norm[0] === norm[0].toLowerCase()) st.lower++;
              else if (!tok.initial) st.capMid++;
              capStats.set(p, st);
            }
            for (const p of parts) {
              if (p.length < 2 || FUNCTION_WORDS.has(p) || PROPER_TECH.has(p)) continue;
              const v = vocabLookup(p) ?? vocabLookup(guessLemma(p));
              const lemma = v ? v.word.toLowerCase() : guessLemma(p);
              if (!v && (FUNCTION_WORDS.has(lemma) || PROPER_TECH.has(lemma))) continue;
              occurrences.push({ key: lemma, surface: p, sid, src: file.id, vocabId: v?.id });
            }
            // 하이픈 결합어 자체도 후보로 기록 (생성 단계에서 넣을지 판단)
            if (parts.length > 1 && parts.every((p) => /^[a-z]+$/.test(p))) {
              occurrences.push({ key: lower, surface: lower, sid, src: file.id });
            }
          }
        }
      }
    }
  }

  // 고유명사: 소문자로 한 번도 안 나오고 문장 중간에서 대문자로 나온 단어
  const proper = new Set(
    [...capStats].filter(([, s]) => s.lower === 0 && s.capMid > 0).map(([w]) => w),
  );

  for (const o of occurrences) {
    let rec = lemmas.get(o.key);
    if (!rec) {
      rec = { lemma: o.key, vocabId: o.vocabId, surfaces: {}, freq: 0, sources: [], sids: [] };
      lemmas.set(o.key, rec);
    }
    rec.vocabId ??= o.vocabId;
    rec.freq++;
    rec.surfaces[o.surface] = (rec.surfaces[o.surface] ?? 0) + 1;
    if (!rec.sources.includes(o.src)) rec.sources.push(o.src);
    if (!rec.sids.includes(o.sid)) rec.sids.push(o.sid);
  }

  for (const rec of lemmas.values()) {
    if (!rec.vocabId && Object.keys(rec.surfaces).every((s) => proper.has(s))) rec.maybeProper = true;
  }

  // 하이픈 결합어는 2회 이상 나왔거나 vocab 에 있을 때만 남긴다
  for (const [k, rec] of lemmas) {
    if (k.includes('-') && !rec.vocabId && rec.freq < 2) lemmas.delete(k);
  }

  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(path.join(WORK, 'questions.json'), JSON.stringify(questions, null, 1));
  fs.writeFileSync(path.join(WORK, 'sentences.json'), JSON.stringify(sentences, null, 1));
  const list = [...lemmas.values()].sort((a, b) => b.freq - a.freq);
  fs.writeFileSync(path.join(WORK, 'lemmas.json'), JSON.stringify(list, null, 1));
  fs.writeFileSync(path.join(WORK, 'proper-nouns.json'), JSON.stringify([...proper].sort(), null, 1));

  const inVocab = list.filter((l) => l.vocabId).length;
  console.log(`문제 ${questions.length}개, 문장 ${sentences.length}개 (영어 ${sentences.filter((s) => s.lang === 'en').length})`);
  console.log(`원형 ${list.length}개 — vocab 에 있음 ${inVocab}, 새 단어 ${list.length - inVocab}`);
  console.log(`고유명사 후보 ${[...lemmas.values()].filter((l) => l.maybeProper).length}개 (생성 단계에서 판단)`);
}

main();

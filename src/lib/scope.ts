/**
 * 학습 범위 — 어떤 단어를 몇 개, 어떤 순서로 공부할지.
 */
import { freqIn, inExam, isQuizSource } from './exams';
import { MAX_LEVEL, type ExamInfo, type Word } from './schema';
import { isDue, statusOf, type StoredCard } from './srs';
import { shuffle, sortByWord } from './text';

export interface Scope {
  /** exam: 시험(·문제 파일)에 나온 단어 / all: 사전의 모든 단어 / wrong: 오답노트 / notebook: 학습장 */
  set: 'exam' | 'all' | 'wrong' | 'notebook';
  /** set 이 exam 일 때 시험 id */
  cat?: string;
  /** set 이 exam 일 때 그 시험의 문제 파일 id (없으면 시험 전체) */
  file?: string;
  /** set 이 notebook 일 때 학습장 id */
  notebook?: string;
  /** 이 단계 이상의 단어만 (1 = 전부) */
  minLevel: number;
  status: 'any' | 'new' | 'learning' | 'unmastered' | 'due';
  count: number; // 0 = 전부
  order: 'freq' | 'random' | 'new-first' | 'alpha';
}

/** cat 은 비워 둔다 — normalizeScope 가 첫 시험으로 채운다 */
export const DEFAULT_SCOPE: Scope = {
  set: 'exam',
  minLevel: 2,
  status: 'unmastered',
  count: 20,
  order: 'freq',
};

const STATUSES = ['any', 'new', 'learning', 'unmastered', 'due'] as const;
const ORDERS = ['freq', 'random', 'new-first', 'alpha'] as const;

const clampLevel = (n: number) => Math.min(MAX_LEVEL, Math.max(1, Math.round(n)));

/**
 * 저장해 둔 범위(예전 형식 포함)나 URL 에서 읽은 범위를 지금 시험 목록에 맞는 값으로 고친다.
 *   예전 set: core → 시험 전체, file → 그 문제 파일이 있는 시험 (없어진 파일이면 시험 전체)
 *   예전 includeBasic: true → 1단계 이상, false → 2단계 이상
 *   모르는 시험·문제 파일은 버리고, 시험이 비어 있으면 첫 시험을 쓴다
 */
export function normalizeScope(raw: unknown, exams: readonly ExamInfo[]): Scope {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s: Scope = { ...DEFAULT_SCOPE };
  const set = r.set;
  if (set === 'exam' || set === 'all' || set === 'wrong' || set === 'notebook') s.set = set;
  else if (set === 'core' || set === 'file') s.set = 'exam';
  if (typeof r.status === 'string' && (STATUSES as readonly string[]).includes(r.status)) s.status = r.status as Scope['status'];
  if (typeof r.order === 'string' && (ORDERS as readonly string[]).includes(r.order)) s.order = r.order as Scope['order'];
  if (typeof r.count === 'number' && r.count >= 0) s.count = Math.floor(r.count);
  if (typeof r.minLevel === 'number' && Number.isFinite(r.minLevel)) s.minLevel = clampLevel(r.minLevel);
  else if (typeof r.includeBasic === 'boolean') s.minLevel = r.includeBasic ? 1 : 2;
  if (s.set === 'notebook' && typeof r.notebook === 'string') s.notebook = r.notebook;
  if (s.set === 'exam') {
    const hasFile = (e: ExamInfo, f: string) => e.sources.some((x) => x.id === f && isQuizSource(x));
    const file = set !== 'core' && typeof r.file === 'string' && r.file ? r.file : undefined;
    const exam = exams.find((e) => e.id === r.cat) ?? (file ? exams.find((e) => hasFile(e, file)) : undefined) ?? exams[0];
    if (exam) {
      s.cat = exam.id;
      if (file && hasFile(exam, file)) s.file = file;
    }
  }
  return s;
}

export interface ProgressView {
  cards: Record<string, StoredCard>;
  wrong: Record<string, unknown>;
  notebooks?: { id: string; ids: string[] }[];
}

export function filterScope(words: Word[], scope: Scope, p: ProgressView, now: Date = new Date()): Word[] {
  const inNotebook = scope.set === 'notebook' ? new Set(p.notebooks?.find((n) => n.id === scope.notebook)?.ids ?? []) : undefined;
  return words.filter((w) => {
    if (inNotebook) {
      // 학습장·오답노트는 직접 고른 단어라 시험·단계 조건을 보지 않는다
      if (!inNotebook.has(w.id)) return false;
    } else if (scope.set === 'wrong') {
      if (!p.wrong[w.id]) return false;
    } else {
      if (scope.set === 'exam' && !inExam(w, scope.cat, scope.file)) return false;
      if (w.level < scope.minLevel) return false;
    }
    const c = p.cards[w.id];
    const st = statusOf(c);
    switch (scope.status) {
      case 'new':
        return st === 'new';
      case 'learning':
        return st === 'learning';
      case 'unmastered':
        return st !== 'mastered';
      case 'due':
        return isDue(c, now);
      default:
        return true;
    }
  });
}

export function selectWords(words: Word[], scope: Scope, p: ProgressView, rng: () => number = Math.random): Word[] {
  let list = filterScope(words, scope, p);
  // 자주 나온 순은 고른 시험·문제 파일에서 나온 횟수로 따진다
  const freq = (w: Word) => (scope.set === 'exam' ? freqIn(w, scope.cat, scope.file) : w.freq);
  switch (scope.order) {
    case 'random':
      list = shuffle(list, rng);
      break;
    case 'alpha':
      list = sortByWord(list);
      break;
    case 'new-first':
      list = [...list].sort((a, b) => Number(!!p.cards[a.id]) - Number(!!p.cards[b.id]) || freq(b) - freq(a));
      break;
    default:
      list = [...list].sort((a, b) => freq(b) - freq(a));
  }
  return scope.count > 0 ? list.slice(0, scope.count) : list;
}

/**
 * URL 쿼리 ↔ 범위 (세션 페이지가 ?set=wrong 처럼 받는다).
 * exams 를 주면 시험·문제 파일이 실제로 있는지까지 맞춘다. 예전 주소(set=core·file, basic=1)도 받는다.
 */
export function scopeFromParams(params: URLSearchParams, base: Scope = DEFAULT_SCOPE, exams?: readonly ExamInfo[]): Scope {
  const raw: Record<string, unknown> = { ...base };
  const set = params.get('set');
  if (set) {
    raw.set = set;
    // 범위 종류가 바뀌면 앞 범위의 시험·문제 파일은 따라오지 않는다
    delete raw.cat;
    delete raw.file;
    delete raw.notebook;
  }
  if (params.get('cat')) raw.cat = params.get('cat');
  if (params.get('file')) raw.file = params.get('file');
  if (params.get('notebook')) raw.notebook = params.get('notebook');
  if (params.get('lv')) raw.minLevel = Number(params.get('lv')) || base.minLevel;
  else if (params.get('basic')) raw.minLevel = params.get('basic') === '1' ? 1 : 2;
  if (params.get('status')) raw.status = params.get('status');
  if (params.get('count')) raw.count = Number(params.get('count')) || 0;
  if (params.get('order')) raw.order = params.get('order');
  const s = normalizeScope(raw, exams ?? []);
  if (!exams && s.set === 'exam') {
    // 시험 목록을 모르면 적힌 값을 그대로 둔다
    if (typeof raw.cat === 'string') s.cat = raw.cat;
    if (typeof raw.file === 'string' && raw.set !== 'core') s.file = raw.file;
  }
  if (!(STATUSES as readonly string[]).includes(String(raw.status))) s.status = base.status;
  if (!(ORDERS as readonly string[]).includes(String(raw.order))) s.order = base.order;
  return s;
}

export function scopeToParams(s: Scope): string {
  const p = new URLSearchParams();
  p.set('set', s.set);
  if (s.set === 'exam' && s.cat) p.set('cat', s.cat);
  if (s.set === 'exam' && s.file) p.set('file', s.file);
  if (s.set === 'notebook' && s.notebook) p.set('notebook', s.notebook);
  p.set('lv', String(s.minLevel));
  p.set('status', s.status);
  p.set('count', String(s.count));
  p.set('order', s.order);
  return p.toString();
}

/** 학습장 하나를 통째로 무작위 순서로 — 학습장 화면의 학습 버튼 */
export function notebookScope(id: string): Scope {
  return { ...DEFAULT_SCOPE, set: 'notebook', notebook: id, status: 'any', count: 0, order: 'random', minLevel: 1 };
}

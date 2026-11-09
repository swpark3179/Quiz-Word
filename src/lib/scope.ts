/**
 * 학습 범위 — 어떤 단어를 몇 개, 어떤 순서로 공부할지.
 */
import type { Word } from './schema';
import { isDue, statusOf, type StoredCard } from './srs';
import { shuffle } from './text';

export interface Scope {
  /** core: ccar-f 단어 / all: 확장 포함 / wrong: 오답노트 / file: 특정 문제 파일 */
  set: 'core' | 'all' | 'wrong' | 'file';
  file?: string;
  includeBasic: boolean;
  status: 'any' | 'new' | 'learning' | 'unmastered' | 'due';
  count: number; // 0 = 전부
  order: 'freq' | 'random' | 'new-first' | 'alpha';
}

export const DEFAULT_SCOPE: Scope = {
  set: 'core',
  includeBasic: false,
  status: 'unmastered',
  count: 20,
  order: 'freq',
};

export interface ProgressView {
  cards: Record<string, StoredCard>;
  wrong: Record<string, unknown>;
}

export function filterScope(words: Word[], scope: Scope, p: ProgressView, now: Date = new Date()): Word[] {
  return words.filter((w) => {
    if (scope.set === 'wrong') {
      if (!p.wrong[w.id]) return false;
    } else {
      if (scope.set === 'core' && w.tier !== 'core') return false;
      if (scope.set === 'file' && (!scope.file || !w.sources.includes(scope.file))) return false;
      if (!scope.includeBasic && w.basic) return false;
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
  switch (scope.order) {
    case 'random':
      list = shuffle(list, rng);
      break;
    case 'alpha':
      list = [...list].sort((a, b) => a.word.localeCompare(b.word));
      break;
    case 'new-first':
      list = [...list].sort((a, b) => Number(!!p.cards[a.id]) - Number(!!p.cards[b.id]) || b.freq - a.freq);
      break;
    default:
      list = [...list].sort((a, b) => b.freq - a.freq);
  }
  return scope.count > 0 ? list.slice(0, scope.count) : list;
}

/** URL 쿼리 ↔ 범위 (세션 페이지가 ?set=wrong 처럼 받는다) */
export function scopeFromParams(params: URLSearchParams, base: Scope = DEFAULT_SCOPE): Scope {
  const s: Scope = { ...base };
  const set = params.get('set');
  if (set === 'core' || set === 'all' || set === 'wrong' || set === 'file') s.set = set;
  if (params.get('file')) s.file = params.get('file')!;
  if (params.get('basic')) s.includeBasic = params.get('basic') === '1';
  const status = params.get('status');
  if (status && ['any', 'new', 'learning', 'unmastered', 'due'].includes(status)) s.status = status as Scope['status'];
  if (params.get('count')) s.count = Number(params.get('count')) || 0;
  const order = params.get('order');
  if (order && ['freq', 'random', 'new-first', 'alpha'].includes(order)) s.order = order as Scope['order'];
  return s;
}

export function scopeToParams(s: Scope): string {
  const p = new URLSearchParams();
  p.set('set', s.set);
  if (s.file) p.set('file', s.file);
  p.set('basic', s.includeBasic ? '1' : '0');
  p.set('status', s.status);
  p.set('count', String(s.count));
  p.set('order', s.order);
  return p.toString();
}

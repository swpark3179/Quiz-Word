/** 학습 모드별 마지막 범위 기억 + 세션 시작 주소 만들기 */
import { router } from 'expo-router';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_SCOPE, levelsLabel, levelsToParam, normalizeScope, scopeFromParams, type Scope } from '@shared/scope';
import { EXAMS, examName, sourceName } from '@/data/words';
import { syncStorage } from '@/lib/kv';
import { useProgress } from '@/store/progress';

export type StudyMode = 'flash' | 'quiz-meaning' | 'quiz-context' | 'quiz-mixed';

export const MODE_INFO: Record<StudyMode, { title: string; desc: string; icon: 'rectangle.stack.fill' | 'list.bullet.rectangle.fill' | 'text.quote' | 'shuffle' }> = {
  flash: { title: '플래시카드', desc: '단어 → 안다/모른다 → 뜻·예문', icon: 'rectangle.stack.fill' },
  'quiz-meaning': { title: '객관식', desc: '영어 단어를 보고 한글 뜻 고르기', icon: 'list.bullet.rectangle.fill' },
  'quiz-context': { title: '문맥 뜻', desc: '문제 속 문장에서 쓰인 뜻 고르기', icon: 'text.quote' },
  'quiz-mixed': { title: '섞어서', desc: '단어 → 뜻과 문맥 뜻을 번갈아', icon: 'shuffle' },
};

interface ScopeState {
  scopes: Partial<Record<StudyMode, Scope>>;
  setScope: (mode: StudyMode, scope: Scope) => void;
}

export const useScopes = create<ScopeState>()(
  persist(
    (set, get) => ({
      scopes: {},
      setScope: (mode, scope) => set({ scopes: { ...get().scopes, [mode]: scope } }),
    }),
    {
      name: 'quiz-word:scopes',
      storage: createJSONStorage(() => syncStorage),
    },
  ),
);

/** 저장해 둔 범위 — 예전 형식(CCAR-F 전체·문제 파일별·기초 포함)이나 없어진 시험·문제 파일은 읽을 때 지금 형식으로 고친다 */
export const scopeOf = (mode: StudyMode, scopes: Partial<Record<StudyMode, Scope>>): Scope => normalizeScope(scopes[mode], EXAMS);

/** "CCAR-F 전체 · 2~6단계 · 못 익힌 단어 · 20개" */
export function scopeSummary(s: Scope): string {
  const set =
    s.set === 'all'
      ? '모든 단어'
      : s.set === 'wrong'
        ? '오답노트'
        : s.set === 'notebook'
          ? (useProgress.getState().notebooks.find((n) => n.id === s.notebook)?.name ?? '학습장')
          : s.cat && s.file
            ? sourceName(s.cat, s.file)
            : s.cat
              ? `${examName(s.cat)} 전체`
              : '모든 단어';
  const status = { unmastered: '못 익힌 단어', new: '새 단어', learning: '학습 중', any: '전체', due: '복습할 단어' }[s.status];
  // 오답노트·학습장은 직접 고른 단어라 단계를 따지지 않는다
  const level = (s.set === 'exam' || s.set === 'all') && s.levels.length ? ` · ${levelsLabel(s.levels)}` : '';
  return `${set}${level} · ${status} · ${s.count ? `${s.count}개` : '전부'}`;
}

/** 범위 → 쿼리 문자열 (RN 의 URLSearchParams 는 일부 메서드가 없어 직접 만든다) */
export function scopeQuery(s: Scope): string {
  const parts: [string, string][] = [
    ['set', s.set],
    ['lvs', levelsToParam(s.levels)],
    ['status', s.status],
    ['count', String(s.count)],
    ['order', s.order],
  ];
  if (s.set === 'exam' && s.cat) parts.push(['cat', s.cat]);
  if (s.set === 'exam' && s.file) parts.push(['file', s.file]);
  if (s.set === 'notebook' && s.notebook) parts.push(['notebook', s.notebook]);
  return parts.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

/** 라우트 파라미터 → 범위 (공용 scopeFromParams 에 get 만 있는 객체를 넘긴다) */
export function scopeFromRoute(params: Record<string, string | string[] | undefined>): Scope {
  const get = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
  return scopeFromParams({ get } as unknown as URLSearchParams, DEFAULT_SCOPE, EXAMS);
}

export function sessionHref(mode: StudyMode, scope: Scope) {
  const q = scopeQuery(scope);
  if (mode === 'flash') return `/session/flash?${q}`;
  const quizMode = mode === 'quiz-meaning' ? 'meaning' : mode === 'quiz-context' ? 'context' : 'mixed';
  return `/session/quiz?${q}&mode=${quizMode}`;
}

/** 범위 시트를 닫은 뒤 세션을 띄운다 (시트 닫힘 애니메이션이 끝난 뒤) */
export function startFromSheet(href: string) {
  router.back();
  setTimeout(() => router.push(href as never), 380);
}

/**
 * 지금 보고 있는 시험·문제 파일 — 예문을 그쪽 것부터 보여 주는 데 쓴다.
 * 학습 화면은 고른 범위의 시험을, 단어 상세는 단어장에서 고른 시험을 넘긴다.
 * 넘기지 않은 곳에서는 설정의 주 시험을 쓴다.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { mainExam } from '../data/words';
import type { ExamplePref } from '../lib/corpus';
import type { Scope } from '../lib/scope';
import { useProgress } from '../store/progress';

const Ctx = createContext<ExamplePref | undefined>(undefined);

export function ExamPrefProvider({ pref, children }: { pref: ExamplePref | undefined; children: ReactNode }) {
  const cat = pref?.cat;
  const file = pref?.file;
  const value = useMemo(() => (cat ? { cat, ...(file ? { file } : {}) } : undefined), [cat, file]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExamPref(): ExamplePref {
  const given = useContext(Ctx);
  const main = useProgress((s) => s.settings.exam);
  return useMemo(() => given ?? { cat: mainExam(main) }, [given, main]);
}

/** 학습 범위에서 예문 기준을 뽑는다 (시험을 고른 범위일 때만) */
export const prefOfScope = (scope: Scope | undefined): ExamplePref | undefined =>
  scope?.set === 'exam' && scope.cat ? { cat: scope.cat, file: scope.file } : undefined;

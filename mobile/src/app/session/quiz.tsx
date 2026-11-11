import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import type { ExamplePref } from '@shared/corpus';
import { selectWords } from '@shared/scope';
import { shuffle } from '@shared/text';
import { ExamPrefProvider, prefOfScope } from '@/components/ExamPref';
import { QuizSession, type QuizMode } from '@/components/QuizSession';
import { Button, Empty } from '@/components/ui';
import { WORD_BY_ID, WORDS } from '@/data/words';
import { useProgress } from '@/store/progress';
import { scopeFromRoute } from '@/store/session';
import { useTheme } from '@/theme';

const TITLES: Record<QuizMode, string> = { meaning: '객관식', context: '문맥 뜻', mixed: '객관식 · 섞어서' };

export default function QuizScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams();
  const record = useProgress((s) => s.record);
  const mode: QuizMode = params.mode === 'context' || params.mode === 'mixed' ? params.mode : 'meaning';
  // pref: 고른 시험·문제 파일 — 문맥 문제와 해설에 그쪽 예문을 먼저 쓴다
  const [{ ids, pref }] = useState<{ ids: string[]; pref?: ExamplePref }>(() => {
    const explicit = typeof params.ids === 'string' ? params.ids : '';
    if (explicit) return { ids: explicit.split(',').filter((id) => WORD_BY_ID.has(id)) };
    const { cards, wrong, notebooks } = useProgress.getState();
    const scope = scopeFromRoute(params);
    // 범위에서 고른 단어를 섞어서 낸다
    return { ids: shuffle(selectWords(WORDS, scope, { cards, wrong, notebooks }).map((w) => w.id)), pref: prefOfScope(scope) };
  });

  const onResult = useCallback((id: string, correct: boolean) => record(id, correct, { source: 'quiz' }), [record]);

  if (!ids.length) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
        <Empty icon="list.bullet.rectangle" title="낼 문제가 없어요" desc="범위나 상태 조건을 바꿔 보세요." action={<Button title="돌아가기" variant="tinted" onPress={() => router.back()} />} />
      </View>
    );
  }
  return (
    <ExamPrefProvider pref={pref}>
      <QuizSession ids={ids} mode={mode} title={TITLES[mode]} onResult={onResult} />
    </ExamPrefProvider>
  );
}

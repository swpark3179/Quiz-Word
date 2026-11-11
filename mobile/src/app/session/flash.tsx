import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import type { ExamplePref } from '@shared/corpus';
import { flashSourceName } from '@shared/notebook';
import { selectWords } from '@shared/scope';
import { ExamPrefProvider, prefOfScope } from '@/components/ExamPref';
import { FlashSession } from '@/components/FlashSession';
import { Button, Empty } from '@/components/ui';
import { WORD_BY_ID, WORDS } from '@/data/words';
import { useProgress } from '@/store/progress';
import { scopeFromRoute } from '@/store/session';
import { useTheme } from '@/theme';

export default function FlashScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams();
  const record = useProgress((s) => s.record);
  // source: 그만할 때 만드는 학습장 이름 앞부분 (어디서 시작했는지)
  // pref: 고른 시험·문제 파일 — 카드 뒷면에 그쪽 예문을 먼저 보여 준다
  const [{ ids, source, pref }] = useState<{ ids: string[]; source?: string; pref?: ExamplePref }>(() => {
    const explicit = typeof params.ids === 'string' ? params.ids : '';
    if (explicit) return { ids: explicit.split(',').filter((id) => WORD_BY_ID.has(id)) };
    const { cards, wrong, notebooks } = useProgress.getState();
    const scope = scopeFromRoute(params);
    return { ids: selectWords(WORDS, scope, { cards, wrong, notebooks }).map((w) => w.id), source: flashSourceName(scope, notebooks), pref: prefOfScope(scope) };
  });

  // SRS·통계에는 이 세션의 첫 판정만 반영한다
  const onAnswer = useCallback((id: string, known: boolean, first: boolean) => {
    if (first) record(id, known, { source: 'flash' });
  }, [record]);

  if (!ids.length) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
        <Empty icon="rectangle.stack" title="학습할 단어가 없어요" desc="범위나 상태 조건을 바꿔 보세요." action={<Button title="돌아가기" variant="tinted" onPress={() => router.back()} />} />
      </View>
    );
  }
  return (
    <ExamPrefProvider pref={pref}>
      <FlashSession ids={ids} title="플래시카드" source={source} onAnswer={onAnswer} />
    </ExamPrefProvider>
  );
}

/** 간격 반복 복습 — 오늘 기한이 된 단어 + 오늘의 새 단어 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { reviewPlan } from '@shared/reviewPlan';
import { dayKey } from '@shared/text';
import { FlashSession } from '@/components/FlashSession';
import { QuizSession } from '@/components/QuizSession';
import { Button, Empty } from '@/components/ui';
import { WORDS } from '@/data/words';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';

export default function ReviewScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ style?: string }>();
  const record = useProgress((s) => s.record);
  const [ids] = useState<string[]>(() => {
    const { cards, settings, days } = useProgress.getState();
    const plan = reviewPlan(WORDS, cards, settings.newPerDay, days[dayKey()]?.newWords ?? 0);
    return [...plan.due, ...plan.fresh];
  });

  // 복습에서는 다시 나온 카드의 판정도 SRS 학습 단계에 반영한다
  const onAnswer = useCallback((id: string, known: boolean) => record(id, known, { source: 'review' }), [record]);

  if (!ids.length) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
        <Empty icon="checkmark.seal" title="지금 복습할 단어가 없어요" desc="오늘 할 복습을 모두 마쳤어요." action={<Button title="닫기" variant="tinted" onPress={() => router.back()} />} />
      </View>
    );
  }
  if (params.style === 'quiz') return <QuizSession ids={ids} mode="mixed" title="객관식 복습" onResult={onAnswer} />;
  return <FlashSession ids={ids} title="플래시카드 복습" onAnswer={onAnswer} />;
}

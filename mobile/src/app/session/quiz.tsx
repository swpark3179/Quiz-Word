import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { selectWords } from '@shared/scope';
import { shuffle } from '@shared/text';
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
  const [ids] = useState<string[]>(() => {
    const explicit = typeof params.ids === 'string' ? params.ids : '';
    if (explicit) return explicit.split(',').filter((id) => WORD_BY_ID.has(id));
    const { cards, wrong, notebooks } = useProgress.getState();
    // 범위에서 고른 단어를 섞어서 낸다
    return shuffle(selectWords(WORDS, scopeFromRoute(params), { cards, wrong, notebooks }).map((w) => w.id));
  });

  const onResult = useCallback((id: string, correct: boolean) => record(id, correct, { source: 'quiz' }), [record]);

  if (!ids.length) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
        <Empty icon="list.bullet.rectangle" title="낼 문제가 없어요" desc="범위나 상태 조건을 바꿔 보세요." action={<Button title="돌아가기" variant="tinted" onPress={() => router.back()} />} />
      </View>
    );
  }
  return <QuizSession ids={ids} mode={mode} title={TITLES[mode]} onResult={onResult} />;
}

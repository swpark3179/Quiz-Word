/** 학습장 목록 — 빈 학습장을 만들거나 오답노트를 통째로 옮겨 시작, 둘 이상은 하나로 합치기. 길게 누르면 이름 바꾸기·삭제 */
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { timeAgo } from '@shared/text';
import { Button, Empty, Icon, PressableScale, T } from '@/components/ui';
import { WORD_BY_ID } from '@/data/words';
import { notebookFromWrong, notebookMenu, promptNewNotebook } from '@/lib/notebookActions';
import { useProgress } from '@/store/progress';
import { elevation, useTheme } from '@/theme';

export default function Notebooks() {
  const { c, dark } = useTheme();
  const reduced = useReducedMotion();
  const notebooks = useProgress((s) => s.notebooks);
  const wrongN = useProgress((s) => Object.keys(s.wrong).filter((id) => WORD_BY_ID.has(id)).length);

  const actions = (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="새 학습장" icon="plus" variant="primary" style={{ flex: 1 }} onPress={promptNewNotebook} />
        <Button title="오답노트 복사" icon="doc.on.doc" variant="tinted" style={{ flex: 1 }} disabled={!wrongN} onPress={notebookFromWrong} />
      </View>
      {/* 합치기는 목록에서만 연다 — 학습장 화면에서 열어 기존 학습장을 지우면 열려 있던 화면이 사라진다 */}
      {notebooks.length >= 2 && <Button title="학습장 합치기" icon="arrow.triangle.merge" variant="secondary" onPress={() => router.push('/notebook-merge')} />}
      <T v="footnote" color="muted">
        {wrongN ? `오답노트 ${wrongN}개를 통째로 담은 학습장을 만들 수 있어요.` : '오답노트가 비어 있어 복사할 단어가 없어요.'}
        {notebooks.length >= 2 ? ' 여러 학습장은 겹치는 단어 없이 하나로 합칠 수 있어요.' : ''} 길게 누르면 이름 바꾸기·삭제.
      </T>
    </View>
  );

  if (!notebooks.length) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 120 }}>
        <Empty icon="books.vertical" title="아직 학습장이 없어요" desc="시험 직전에 볼 단어, 자꾸 헷갈리는 단어처럼 따로 모아 반복할 단어 묶음을 만들어 보세요." />
        <View style={{ paddingHorizontal: 16 }}>{actions}</View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {actions}
      {notebooks.map((nb, i) => {
        const n = nb.ids.filter((id) => WORD_BY_ID.has(id)).length;
        return (
          <Animated.View
            key={nb.id}
            entering={reduced ? undefined : FadeInDown.springify().damping(16).delay(Math.min(i, 8) * 30)}
            exiting={reduced ? undefined : FadeOut.duration(200)}
            layout={reduced ? undefined : LinearTransition.springify().damping(18)}
          >
            <PressableScale
              onPress={() => router.push({ pathname: '/notebooks/[id]', params: { id: nb.id } })}
              onLongPress={() => notebookMenu(nb.id)}
              hapticOnPress
              accessibilityRole="button"
              accessibilityLabel={`${nb.name}, 단어 ${n}개`}
              style={[styles.card, { backgroundColor: c.surface }, elevation(c, dark)]}
            >
              <View style={[styles.icon, { backgroundColor: c.primarySoft }]}>
                <Icon name="books.vertical.fill" size={19} color={c.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="headline" numberOfLines={1}>
                  {nb.name}
                </T>
                <T v="footnote" color="text2">
                  {n}개 단어 · {timeAgo(nb.updatedAt)} 수정
                </T>
              </View>
              <Icon name="chevron.right" size={13} color={c.muted} />
            </PressableScale>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderCurve: 'continuous' },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});

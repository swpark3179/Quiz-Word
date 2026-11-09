/** 오답노트 — 많이 틀린 순/최근 순, 쓸어서 빼기, 오답만 학습 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { DEFAULT_SCOPE } from '@shared/scope';
import { Button, Empty, Icon, PosBadge, Segmented, T } from '@/components/ui';
import { WORD_BY_ID } from '@/data/words';
import { useProgress } from '@/store/progress';
import { sessionHref } from '@/store/session';
import { type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

const WRONG_SCOPE = { ...DEFAULT_SCOPE, set: 'wrong' as const, status: 'any' as const, count: 0, order: 'random' as const, includeBasic: true };

function ago(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

export default function Wrong() {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const wrong = useProgress((s) => s.wrong);
  const graduate = useProgress((s) => s.settings.wrongGraduate);
  const removeWrong = useProgress((s) => s.removeWrong);
  const [sort, setSort] = useState<'count' | 'recent'>('count');

  const rows = useMemo(
    () =>
      Object.entries(wrong)
        .map(([id, e]) => ({ id, e, w: WORD_BY_ID.get(id)! }))
        .filter((r) => r.w)
        .sort((a, b) => (sort === 'count' ? b.e.count - a.e.count || b.e.lastAt - a.e.lastAt : b.e.lastAt - a.e.lastAt)),
    [wrong, sort],
  );

  if (!rows.length) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <Empty icon="bookmark" title="오답노트가 비어 있어요" desc="객관식에서 틀리거나 플래시카드에서 모른다고 한 단어가 여기에 모입니다." />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.top}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="오답 플래시카드" icon="rectangle.stack.fill" variant="primary" style={{ flex: 1 }} onPress={() => router.push(sessionHref('flash', WRONG_SCOPE) as never)} />
          <Button title="오답 객관식" icon="list.bullet" variant="tinted" style={{ flex: 1 }} onPress={() => router.push(sessionHref('quiz-meaning', WRONG_SCOPE) as never)} />
        </View>
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: 'count', label: '많이 틀린 순' },
            { value: 'recent', label: '최근 순' },
          ]}
        />
        <T v="footnote" color="muted">
          {rows.length}개 · {graduate}번 연속으로 맞히면 자동으로 빠져요. 왼쪽으로 쓸면 바로 뺄 수 있어요.
        </T>
      </View>

      {rows.map(({ id, e, w }) => (
        <Animated.View key={id} exiting={reduced ? undefined : FadeOut.duration(200)} layout={reduced ? undefined : LinearTransition.springify().damping(18)}>
          <ReanimatedSwipeable
            friction={2}
            rightThreshold={60}
            overshootRight={false}
            onSwipeableOpen={() => {
              void haptic.warning();
              removeWrong(id);
            }}
            renderRightActions={() => (
              <View style={[styles.delete, { backgroundColor: c.danger }]}>
                <Icon name="trash.fill" size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>빼기</Text>
              </View>
            )}
          >
            <Pressable
              onPress={() => router.push({ pathname: '/word/[id]', params: { id } })}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface2 : c.bg, borderBottomColor: c.separator }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text numberOfLines={1} style={[type.headline, { color: c.text, flexShrink: 1 }]}>
                    {w.word}
                  </Text>
                  {!!w.pos[0] && <PosBadge pos={w.pos[0]} small />}
                </View>
                <Text numberOfLines={1} style={[type.subhead, { color: c.text2, marginTop: 2 }]}>
                  {w.short}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <Text style={[type.footnote, { color: c.muted }]}>
                  <Text style={{ color: c.danger, fontWeight: '700' }}>{e.count}회</Text> · {ago(e.lastAt)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {Array.from({ length: graduate }).map((_, i) => (
                    <View key={i} style={{ width: 14, height: 5, borderRadius: 3, backgroundColor: i < e.streak ? c.success : c.surface3 }} />
                  ))}
                </View>
              </View>
            </Pressable>
          </ReanimatedSwipeable>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  delete: { width: 96, alignItems: 'center', justifyContent: 'center', gap: 4 },
});

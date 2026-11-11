/**
 * 오답노트 — 많이 틀린 순/최근 순, 쓸어서 빼기, 오답만 학습
 * 수백 개가 쌓여도 부드럽게: FlashList 로 보이는 줄만 그리고, 줄은 자기 항목이 바뀔 때만 다시 그린다.
 */
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useReducedMotion } from 'react-native-reanimated';
import type { WrongEntry } from '@shared/progressStore';
import type { Word } from '@shared/schema';
import { DEFAULT_SCOPE } from '@shared/scope';
import { timeAgo as ago } from '@shared/text';
import { Button, Empty, Icon, PosBadge, Segmented, T } from '@/components/ui';
import { WORD_BY_ID } from '@/data/words';
import { useProgress } from '@/store/progress';
import { sessionHref } from '@/store/session';
import { type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

const WRONG_SCOPE = { ...DEFAULT_SCOPE, set: 'wrong' as const, status: 'any' as const, count: 0, order: 'random' as const, minLevel: 1 };

interface WrongRowData {
  id: string;
  e: WrongEntry;
  w: Word;
}

export default function Wrong() {
  const reduced = useReducedMotion();
  const wrong = useProgress((s) => s.wrong);
  const graduate = useProgress((s) => s.settings.wrongGraduate);
  const [sort, setSort] = useState<'count' | 'recent'>('count');
  const listRef = useRef<FlashListRef<WrongRowData>>(null);

  const rows = useMemo(
    () =>
      Object.entries(wrong)
        .map(([id, e]) => ({ id, e, w: WORD_BY_ID.get(id)! }))
        .filter((r) => r.w)
        .sort((a, b) => (sort === 'count' ? b.e.count - a.e.count || b.e.lastAt - a.e.lastAt : b.e.lastAt - a.e.lastAt)),
    [wrong, sort],
  );

  // 쓸어서 빼면 아래 줄들이 부드럽게 올라오게 (동작 줄이기를 켜면 바로)
  const remove = useCallback(
    (id: string) => {
      void haptic.warning();
      if (!reduced) {
        listRef.current?.prepareForLayoutAnimationRender();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      useProgress.getState().removeWrong(id);
    },
    [reduced],
  );

  const renderItem = useCallback<ListRenderItem<WrongRowData>>(({ item }) => <WrongRow key={item.id} row={item} graduate={graduate} onRemove={remove} />, [graduate, remove]);

  if (!rows.length) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <Empty icon="bookmark" title="오답노트가 비어 있어요" desc="객관식에서 틀리거나 플래시카드에서 모른다고 한 단어가 여기에 모입니다." />
      </ScrollView>
    );
  }

  return (
    <FlashList
      ref={listRef}
      data={rows}
      keyExtractor={(r) => r.id}
      renderItem={renderItem}
      extraData={graduate}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 120 }}
      ListHeaderComponent={
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
      }
    />
  );
}

/**
 * 오답노트 한 줄. key 를 항목 id 로 주어 재활용될 때 쓸어 연 상태가 다른 줄에 남지 않게 한다.
 * (FlashList 는 화면 밖으로 나간 줄을 다른 항목에 다시 쓴다)
 */
const WrongRow = memo(function WrongRow({ row, graduate, onRemove }: { row: WrongRowData; graduate: number; onRemove: (id: string) => void }) {
  const { c } = useTheme();
  const { id, e, w } = row;
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={60}
      overshootRight={false}
      onSwipeableOpen={() => onRemove(id)}
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
  );
},
// 줄 객체는 목록을 만들 때마다 새로 생기므로, 실제로 바뀐 항목(오답 기록·단어)만 비교한다
(a, b) => a.row.e === b.row.e && a.row.w === b.row.w && a.graduate === b.graduate && a.onRemove === b.onRemove);

const styles = StyleSheet.create({
  top: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  delete: { width: 96, alignItems: 'center', justifyContent: 'center', gap: 4 },
});

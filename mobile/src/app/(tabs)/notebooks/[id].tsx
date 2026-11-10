/**
 * 학습장 하나 — 검색창으로 단어 담기, 쓸어서 바로 빼기, 플래시카드·객관식·문맥 뜻
 * 수백 단어 학습장도 부드럽게: 담긴 단어·검색 결과를 FlashList 하나로 그리고(보이는 줄만),
 * 줄은 자기 단어의 학습 상태만 구독한다.
 */
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useReducedMotion } from 'react-native-reanimated';
import type { Word } from '@shared/schema';
import { notebookScope } from '@shared/scope';
import { searchWords } from '@shared/search';
import { statusOf } from '@shared/srs';
import { timeAgo } from '@shared/text';
import { Button, Empty, Icon, PosBadge, PressableScale, StatusDot, T } from '@/components/ui';
import { WORD_BY_ID, WORDS } from '@/data/words';
import { notebookMenu } from '@/lib/notebookActions';
import { useProgress } from '@/store/progress';
import { MODE_INFO, sessionHref, type StudyMode } from '@/store/session';
import { type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

/** 검색 결과로 보여 줄 개수 */
const RESULT_LIMIT = 30;

export default function NotebookScreen() {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const nb = useProgress((s) => s.notebooks.find((n) => n.id === id));
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const listRef = useRef<FlashListRef<Word>>(null);

  const words = useMemo(() => (nb?.ids ?? []).filter((x) => WORD_BY_ID.has(x)).map((x) => WORD_BY_ID.get(x)!), [nb]);
  const inBook = useMemo(() => new Set(nb?.ids ?? []), [nb]);
  const results = useMemo(() => (dq.trim() ? searchWords(WORDS, dq).slice(0, RESULT_LIMIT) : []), [dq]);

  const toggle = useCallback(
    (w: Word) => {
      const st = useProgress.getState();
      const book = st.notebooks.find((n) => n.id === id);
      if (!book) return;
      if (book.ids.includes(w.id)) {
        st.removeFromNotebook(id, w.id);
        void haptic.select();
      } else {
        st.addToNotebook(id, w.id);
        void haptic.success();
      }
    },
    [id],
  );

  // 쓸어서 빼기 — 빠르게 정리할 수 있게 묻지 않고 바로 뺀다. 아래 줄들은 부드럽게 올라온다(동작 줄이기를 켜면 바로)
  const remove = useCallback(
    (wordId: string) => {
      void haptic.warning();
      if (!reduced) {
        listRef.current?.prepareForLayoutAnimationRender();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      useProgress.getState().removeFromNotebook(id, wordId);
    },
    [id, reduced],
  );

  const searching = !!dq.trim();
  const renderItem = useCallback<ListRenderItem<Word>>(
    ({ item }) =>
      searching ? <ResultRow w={item} added={inBook.has(item.id)} onToggle={toggle} /> : <BookWordRow key={item.id} w={item} onRemove={remove} />,
    [searching, inBook, toggle, remove],
  );

  const screenOptions = (
    <Stack.Screen
      options={{
        title: nb?.name ?? '학습장',
        headerRight: nb
          ? () => (
              <PressableScale accessibilityRole="button" accessibilityLabel="학습장 메뉴" hitSlop={10} onPress={() => notebookMenu(nb.id, () => router.back())}>
                <Icon name="ellipsis.circle" size={21} color={c.primary} />
              </PressableScale>
            )
          : undefined,
        headerSearchBarOptions: nb
          ? {
              placeholder: '단어 검색해서 담기',
              autoCapitalize: 'none',
              hideWhenScrolling: false,
              cancelButtonText: '완료',
              onChangeText: (e) => setQ(e.nativeEvent.text),
              onCancelButtonPress: () => setQ(''),
            }
          : undefined,
      }}
    />
  );

  if (!nb) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        {screenOptions}
        <Empty
          icon="books.vertical"
          title="학습장을 찾을 수 없어요"
          desc="지워졌거나 다른 기기에서 만든 학습장이에요."
          action={<Button title="학습장 목록으로" variant="tinted" onPress={() => router.back()} />}
        />
      </ScrollView>
    );
  }

  const start = (mode: StudyMode) => router.push(sessionHref(mode, notebookScope(nb.id)) as never);
  const n = words.length;

  const header = searching ? (
    /* ───── 검색 중: 결과를 눌러 담기·빼기 ───── */
    <T v="footnote" color="muted" style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
      {results.length ? `눌러서 ${nb.name}에 담아요 · 담긴 단어는 다시 누르면 빠져요` : `"${dq.trim()}" 에 맞는 단어가 없어요`}
    </T>
  ) : (
    /* ───── 평소: 학습 버튼 + 담은 단어 ───── */
    <View>
      <View style={styles.top}>
        <Button title={`${MODE_INFO.flash.title}${n ? ` ${n}장` : ''}`} icon={MODE_INFO.flash.icon} variant="primary" disabled={!n} onPress={() => start('flash')} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={MODE_INFO['quiz-meaning'].title} icon={MODE_INFO['quiz-meaning'].icon} variant="tinted" style={{ flex: 1 }} disabled={!n} onPress={() => start('quiz-meaning')} />
          <Button title={MODE_INFO['quiz-context'].title} icon={MODE_INFO['quiz-context'].icon} variant="tinted" style={{ flex: 1 }} disabled={!n} onPress={() => start('quiz-context')} />
        </View>
        <T v="footnote" color="muted">
          {n}개 · {timeAgo(nb.updatedAt)} 수정 · 위 검색창에서 단어를 찾아 담고, 왼쪽으로 쓸면 바로 빠져요.
        </T>
      </View>
      {n === 0 && <Empty icon="magnifyingglass" title="아직 담은 단어가 없어요" desc="위 검색창에 영어 단어나 한글 뜻을 입력하고 눌러서 담아 보세요." />}
    </View>
  );

  return (
    <>
      {screenOptions}
      {/* 검색 중에도 같은 목록을 써서 검색창·스크롤 위치가 흔들리지 않게 한다 */}
      <FlashList
        ref={listRef}
        data={searching ? results : words}
        keyExtractor={(w) => w.id}
        getItemType={() => (searching ? 'result' : 'word')}
        renderItem={renderItem}
        extraData={inBook}
        ListHeaderComponent={header}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </>
  );
}

/** 검색 결과 한 줄 — 누르면 담기·빼기 */
const ResultRow = memo(function ResultRow({ w, added, onToggle }: { w: Word; added: boolean; onToggle: (w: Word) => void }) {
  const { c } = useTheme();
  const status = useProgress((s) => statusOf(s.cards[w.id]));
  return (
    <Pressable
      onPress={() => onToggle(w)}
      accessibilityRole="button"
      accessibilityLabel={added ? `${w.word} 학습장에서 빼기` : `${w.word} 학습장에 담기`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface2 : c.bg, borderBottomColor: c.separator }]}
    >
      <StatusDot status={status} />
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
      <Icon name={added ? 'checkmark.circle.fill' : 'plus.circle'} size={24} color={added ? c.success : c.primary} />
    </Pressable>
  );
});

/**
 * 담긴 단어 한 줄 — 쓸면 빠진다. key 를 단어 id 로 주어 재활용될 때 쓸어 연 상태가 다른 줄에 남지 않게 한다.
 */
const BookWordRow = memo(function BookWordRow({ w, onRemove }: { w: Word; onRemove: (id: string) => void }) {
  const { c } = useTheme();
  const status = useProgress((s) => statusOf(s.cards[w.id]));
  const inWrong = useProgress((s) => !!s.wrong[w.id]);
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={60}
      overshootRight={false}
      onSwipeableOpen={() => onRemove(w.id)}
      renderRightActions={() => (
        <View style={[styles.delete, { backgroundColor: c.danger }]}>
          <Icon name="trash.fill" size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>빼기</Text>
        </View>
      )}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/word/[id]', params: { id: w.id } })}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface2 : c.bg, borderBottomColor: c.separator }]}
      >
        <StatusDot status={status} />
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
        {inWrong && <Icon name="bookmark.fill" size={12} color={c.danger} />}
      </Pressable>
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  top: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  delete: { width: 96, alignItems: 'center', justifyContent: 'center', gap: 4 },
});

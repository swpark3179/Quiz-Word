/**
 * 단어장 — 네이티브 검색창, 필터 칩, 정렬, A–Z 스크러버
 * 행은 자기 단어의 학습 상태만 구독한다(WordRow) — 학습 중 판정 하나에 바뀐 행 하나만 다시 그려진다.
 */
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, runOnJS } from 'react-native-reanimated';
import type { Word } from '@shared/schema';
import { searchWords } from '@shared/search';
import { statusOf, type WordStatus } from '@shared/srs';
import { useToast } from '@/components/motion';
import { Icon, PosBadge, Segmented, StatusDot, T } from '@/components/ui';
import { QUIZ_SOURCES, sourceName, WORDS, WORDS_BY_FREQ } from '@/data/words';
import { speak } from '@/lib/tts';
import { useProgress } from '@/store/progress';
import { type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

type Sort = 'freq' | 'alpha';
type StatusFilter = '' | WordStatus | 'wrong';
type TierFilter = '' | 'core' | 'extra' | 'basic';

const POS_FILTERS = ['명사', '동사', '형용사', '부사', '구'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ROW_H = 64;

function pick<T extends string>(title: string, options: { value: T; label: string }[], onPick: (v: T) => void) {
  ActionSheetIOS.showActionSheetWithOptions(
    { title, options: [...options.map((o) => o.label), '취소'], cancelButtonIndex: options.length },
    (i) => {
      if (i < options.length) {
        void haptic.select();
        onPick(options[i].value);
      }
    },
  );
}

export default function WordsScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ src?: string }>();
  const [q, setQ] = useState('');
  const [src, setSrc] = useState(params.src ?? '');
  const [pos, setPos] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [tier, setTier] = useState<TierFilter>('');
  const [sort, setSort] = useState<Sort>('freq');
  const [bubble, setBubble] = useState<string | null>(null);
  const toast = useToast((s) => s.show);
  const listRef = useRef<FlashListRef<Word>>(null);
  // 검색어는 한 박자 늦게 반영 — 빠르게 칠 때 글자 입력이 밀리지 않게
  const dq = useDeferredValue(q);
  // 학습 상태로 거를 때만 진행 기록에 따라 목록이 바뀐다 (그 밖에는 판정해도 목록을 다시 만들지 않는다)
  const statusCards = useProgress((s) => (status && status !== 'wrong' ? s.cards : null));
  const statusWrong = useProgress((s) => (status === 'wrong' ? s.wrong : null));

  const list = useMemo(() => {
    let base = sort === 'alpha' ? WORDS : WORDS_BY_FREQ;
    if (src) base = base.filter((w) => w.sources.includes(src));
    if (pos) base = base.filter((w) => (pos === '구' ? w.pos.some((p) => p.endsWith('구')) : w.pos.includes(pos)));
    if (tier) base = base.filter((w) => (tier === 'basic' ? w.basic : w.tier === tier && !w.basic));
    if (statusWrong) base = base.filter((w) => statusWrong[w.id]);
    else if (statusCards) base = base.filter((w) => statusOf(statusCards[w.id]) === status);
    return dq.trim() ? searchWords(base, dq) : base;
  }, [dq, src, pos, tier, status, sort, statusCards, statusWrong]);

  const letterIndex = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((w, i) => {
      const L = w.word[0]?.toUpperCase();
      if (L && !m.has(L)) m.set(L, i);
    });
    return m;
  }, [list]);

  const lastLetter = useRef('');
  const jump = useCallback(
    (y: number, done = false) => {
      if (done) {
        setBubble(null);
        lastLetter.current = '';
        return;
      }
      const L = LETTERS[Math.max(0, Math.min(LETTERS.length - 1, Math.floor(y / 17)))];
      if (L === lastLetter.current) return;
      lastLetter.current = L;
      setBubble(L);
      void haptic.select();
      const idx = letterIndex.get(L);
      if (idx !== undefined) listRef.current?.scrollToIndex({ index: idx, animated: false });
    },
    [letterIndex],
  );
  const scrub = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(jump)(e.y))
    .onUpdate((e) => runOnJS(jump)(e.y))
    .onFinalize(() => runOnJS(jump)(0, true));

  const onLongPress = useCallback((w: Word) => {
    const { wrong, addWrong, removeWrong } = useProgress.getState();
    const inWrong = !!wrong[w.id];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: w.word, message: w.short, options: [inWrong ? '오답노트에서 빼기' : '오답노트에 담기', '발음 듣기', '취소'], cancelButtonIndex: 2, destructiveButtonIndex: inWrong ? 0 : undefined },
      (i) => {
        if (i === 0) {
          if (inWrong) removeWrong(w.id);
          else addWrong(w.id);
          toast(inWrong ? '오답노트에서 뺐어요' : '오답노트에 담았어요');
          void haptic.success();
        } else if (i === 1) speak(w.word);
      },
    );
  }, [toast]);

  const filtersOn = !!(src || pos || status || tier);
  const showScrubber = sort === 'alpha' && !dq.trim();

  const renderItem = useCallback<ListRenderItem<Word>>(({ item }) => <WordRow w={item} scrubber={showScrubber} onLongPress={onLongPress} />, [showScrubber, onLongPress]);

  const header = useMemo(() => (
    <View style={{ gap: 10, paddingBottom: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        <FilterChip
          label={src ? sourceName(src) : '문제 파일'}
          active={!!src}
          onPress={() => pick('문제 파일', [{ value: '', label: '모든 문제 파일' }, ...QUIZ_SOURCES.map((s) => ({ value: s.id, label: s.name }))], setSrc)}
        />
        <FilterChip label={pos ? (pos === '구' ? '구(여러 단어)' : pos) : '품사'} active={!!pos} onPress={() => pick('품사', [{ value: '', label: '모든 품사' }, ...POS_FILTERS.map((p) => ({ value: p, label: p === '구' ? '구(여러 단어)' : p }))], setPos)} />
        <FilterChip
          label={status ? { new: '새 단어', learning: '학습 중', mastered: '익힘', wrong: '오답노트' }[status] : '학습 상태'}
          active={!!status}
          onPress={() =>
            pick<StatusFilter>('학습 상태', [
              { value: '', label: '모든 상태' },
              { value: 'new', label: '새 단어' },
              { value: 'learning', label: '학습 중' },
              { value: 'mastered', label: '익힘' },
              { value: 'wrong', label: '오답노트' },
            ], setStatus)
          }
        />
        <FilterChip
          label={tier ? { core: '핵심', extra: '확장', basic: '기초' }[tier] : '핵심 + 확장'}
          active={!!tier}
          onPress={() =>
            pick<TierFilter>('단어 범위', [
              { value: '', label: '핵심 + 확장' },
              { value: 'core', label: '핵심 (CCAR-F)' },
              { value: 'extra', label: '확장 (다른 회차)' },
              { value: 'basic', label: '기초 단어' },
            ], setTier)
          }
        />
        {filtersOn && (
          <Pressable
            onPress={() => {
              setSrc('');
              setPos('');
              setStatus('');
              setTier('');
            }}
            style={{ justifyContent: 'center', paddingHorizontal: 6 }}
          >
            <T v="subhead" color="primary" style={{ fontWeight: '600' }}>
              초기화
            </T>
          </Pressable>
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <View style={{ flex: 1 }}>
          <Segmented<Sort>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'freq', label: '자주 나온 순' },
              { value: 'alpha', label: 'ABC' },
            ]}
          />
        </View>
        <T v="footnote" color="muted" style={{ fontVariant: ['tabular-nums'] }}>
          {list.length.toLocaleString()}개
        </T>
      </View>
    </View>
  ), [src, pos, status, tier, sort, filtersOn, list.length]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: '단어 또는 뜻',
            autoCapitalize: 'none',
            hideWhenScrolling: false,
            cancelButtonText: '취소',
            onChangeText: (e) => setQ(e.nativeEvent.text),
          },
        }}
      />
      <FlashList
        ref={listRef}
        data={list}
        keyExtractor={(w) => w.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        ListEmptyComponent={<T v="subhead" color="muted" style={{ textAlign: 'center', marginTop: 50 }}>찾는 단어가 없어요</T>}
        contentContainerStyle={{ paddingBottom: 120 }}
        extraData={showScrubber}
        renderItem={renderItem}
      />

      {showScrubber && (
        <GestureDetector gesture={scrub}>
          <View style={styles.scrubber} hitSlop={{ left: 12 }}>
            {LETTERS.map((L) => (
              <Text key={L} style={[styles.scrubLetter, { color: letterIndex.has(L) ? c.primary : c.separator }]}>
                {L}
              </Text>
            ))}
          </View>
        </GestureDetector>
      )}
      {bubble && (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(160)} pointerEvents="none" style={[styles.bubble, { backgroundColor: c.surface3 }]}>
          <Text style={{ fontSize: 40, fontWeight: '800', color: c.text }}>{bubble}</Text>
        </Animated.View>
      )}
    </View>
  );
}

/** 단어장 한 줄 — 자기 단어의 학습 상태·오답 여부만 구독한다 */
const WordRow = memo(function WordRow({ w, scrubber, onLongPress }: { w: Word; scrubber: boolean; onLongPress: (w: Word) => void }) {
  const { c } = useTheme();
  const status = useProgress((s) => statusOf(s.cards[w.id]));
  const inWrong = useProgress((s) => !!s.wrong[w.id]);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/word/[id]', params: { id: w.id } })}
      onLongPress={() => onLongPress(w)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface2 : c.bg, paddingRight: scrubber ? 30 : 16 }]}
    >
      <StatusDot status={status} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text numberOfLines={1} style={[type.headline, { color: c.text, flexShrink: 1 }]}>
            {w.word}
          </Text>
          {!!w.ipa && (
            <Text numberOfLines={1} style={[type.footnote, { color: c.muted, flexShrink: 1 }]}>
              /{w.ipa}/
            </Text>
          )}
        </View>
        <Text numberOfLines={1} style={[type.subhead, { color: c.text2, marginTop: 2 }]}>
          {w.short}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {inWrong && <Icon name="bookmark.fill" size={12} color={c.danger} />}
          {!!w.pos[0] && <PosBadge pos={w.pos[0]} small />}
        </View>
        {w.freq > 0 && (
          <T v="caption" color="muted" style={{ fontVariant: ['tabular-nums'] }}>
            {w.freq}회
          </T>
        )}
      </View>
    </Pressable>
  );
});

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? c.primarySoft : c.surface, borderColor: active ? c.primary : c.separator }]}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: active ? c.primaryText : c.text2 }} numberOfLines={1}>
        {label}
      </Text>
      <Icon name="chevron.down" size={10} color={active ? c.primaryText : c.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7, maxWidth: 200 },
  scrubber: { position: 'absolute', right: 2, top: '28%', width: 22, alignItems: 'center' },
  scrubLetter: { height: 17, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  bubble: { position: 'absolute', alignSelf: 'center', top: '42%', width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

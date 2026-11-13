/**
 * 단어장 — 네이티브 검색창, 필터 칩, 정렬, A–Z 스크러버
 * 행은 자기 단어의 학습 상태만 구독한다(WordRow) — 학습 중 판정 하나에 바뀐 행 하나만 다시 그려진다.
 * 단어장 화면에서 단어장 탭을 한 번 더 누르면 목록 맨 위로 올라간다.
 */
import { useScrollToTop } from '@react-navigation/native';
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { memo, type RefObject, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, runOnJS } from 'react-native-reanimated';
import type { SearchBarCommands } from 'react-native-screens';
import { freqIn, inExam, isExtra, isQuizSource, NO_EXAM } from '@shared/exams';
import { LEVELS, type Word } from '@shared/schema';
import { inLevels, toggleLevel } from '@shared/scope';
import { searchWords } from '@shared/search';
import { statusOf, type WordStatus } from '@shared/srs';
import { notFoundCallbackUrl, resolveLookup } from '@shared/wordLookup';
import { useToast } from '@/components/motion';
import { Icon, PosBadge, Segmented, StatusDot, T } from '@/components/ui';
import { EXAMS, examName, quizSources, sourceName, WORD_BY_SURFACE, WORDS, WORDS_BY_FREQ } from '@/data/words';
import { afterFrame } from '@/lib/afterFrame';
import { showActionSheet } from '@/lib/sheet';
import { speak } from '@/lib/tts';
import { useProgress } from '@/store/progress';
import { type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

type Sort = 'freq' | 'alpha';
type StatusFilter = '' | WordStatus | 'wrong';

const POS_FILTERS = ['명사', '동사', '형용사', '부사', '구'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ROW_H = 64;

/** 마지막으로 처리한 다른 앱의 단어 찾기 표시(t) — 화면이 다시 만들어져도 같은 요청을 두 번 처리하지 않게 모듈에 둔다 */
let handledLookup = '';

function pick<T extends string>(title: string, options: { value: T; label: string }[], onPick: (v: T) => void) {
  showActionSheet(
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
  // lookup·t·xerr: 다른 앱(문제은행)이 quizword://lookup 으로 단어를 찾을 때 (+native-intent.tsx 가 넘긴다)
  const params = useLocalSearchParams<{ cat?: string; src?: string; lookup?: string; t?: string; xerr?: string }>();
  const [q, setQ] = useState('');
  // 시험: '' = 모든 시험, NO_EXAM = 어느 시험 문제에도 안 나온 단어(확장). 문제 파일만 넘어오면 그 파일이 있는 시험으로 맞춘다
  const [cat, setCatOnly] = useState(
    () => (params.cat === NO_EXAM || EXAMS.some((e) => e.id === params.cat) ? params.cat! : (EXAMS.find((e) => params.src && e.sources.some((x) => x.id === params.src && isQuizSource(x)))?.id ?? '')),
  );
  const [src, setSrc] = useState(params.src ?? '');
  /** 고른 단계들 — 비어 있으면 모든 단계 */
  const [levels, setLevels] = useState<readonly number[]>([]);
  /** 시험을 바꾸면 문제 파일 선택은 푼다 (문제 파일은 시험 안에서 고른다) */
  const setCat = useCallback((v: string) => {
    setCatOnly(v);
    setSrc('');
  }, []);
  const files = useMemo(() => (cat && cat !== NO_EXAM ? quizSources(cat) : []), [cat]);
  const file = files.some((x) => x.id === src) ? src : '';
  const [pos, setPos] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [sort, setSort] = useState<Sort>('freq');
  const [bubble, setBubble] = useState<string | null>(null);
  const toast = useToast((s) => s.show);
  const listRef = useRef<FlashListRef<Word>>(null);
  // 탭을 다시 누르면 맨 위로 — 안드로이드 탭은 tabPress 를 보내고 여기서 올린다.
  // iOS 네이티브 탭은 이 이벤트 없이 탭 쪽에서 직접 맨 위로 올린다 ((tabs)/_layout.tsx 의 NativeTabs 기본 동작)
  useScrollToTop(listRef);
  const searchRef = useRef<SearchBarCommands>(null);
  // 검색어는 한 박자 늦게 반영 — 빠르게 칠 때 글자 입력이 밀리지 않게
  const dq = useDeferredValue(q);
  // 학습 상태로 거를 때만 진행 기록에 따라 목록이 바뀐다 (그 밖에는 판정해도 목록을 다시 만들지 않는다)
  const statusCards = useProgress((s) => (status && status !== 'wrong' ? s.cards : null));
  const statusWrong = useProgress((s) => (status === 'wrong' ? s.wrong : null));

  const list = useMemo(() => {
    let base = sort === 'alpha' ? WORDS : WORDS_BY_FREQ;
    if (cat === NO_EXAM) base = base.filter(isExtra);
    else if (cat) {
      base = base.filter((w) => inExam(w, cat, file || undefined));
      // 자주 나온 순은 고른 시험·문제 파일에서 나온 횟수로
      if (sort === 'freq') {
        base = base
          .map((w, i) => ({ w, i, f: freqIn(w, cat, file || undefined) }))
          .sort((a, b) => b.f - a.f || a.i - b.i)
          .map((x) => x.w);
      }
    }
    if (levels.length) base = base.filter((w) => inLevels(w.level, levels));
    if (pos) base = base.filter((w) => (pos === '구' ? w.pos.some((p) => p.endsWith('구')) : w.pos.includes(pos)));
    if (statusWrong) base = base.filter((w) => statusWrong[w.id]);
    else if (statusCards) base = base.filter((w) => statusOf(statusCards[w.id]) === status);
    return dq.trim() ? searchWords(base, dq) : base;
  }, [dq, cat, file, levels, pos, status, sort, statusCards, statusWrong]);

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
    showActionSheet(
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

  // 다른 앱에서 단어 찾기: 모든 단어에서 검색 → 표제어·변화형이 정확히 맞으면 상세, 하나도 없으면 그 앱에 '결과 없음' 알림
  useEffect(() => {
    const word = params.lookup;
    if (!word || !params.t || handledLookup === params.t) return;
    handledLookup = params.t;
    setCat('');
    setPos('');
    setStatus('');
    setLevels([]);
    setQ(word);
    const result = resolveLookup(word, WORD_BY_SURFACE, WORDS);
    afterFrame(() => {
      searchRef.current?.setText(word);
      if (result.kind === 'exact') router.push({ pathname: '/word/[id]', params: { id: result.word.id } });
    });
    if (result.kind === 'none' && Platform.OS !== 'web') {
      const callback = notFoundCallbackUrl(params.xerr, word);
      if (callback) Linking.openURL(callback).catch(() => {});
    }
  }, [params.lookup, params.t, params.xerr, setCat]);

  const filtersOn = !!(cat || pos || status || levels.length);
  const showScrubber = sort === 'alpha' && !dq.trim();

  const examCat = cat && cat !== NO_EXAM ? cat : '';
  const renderItem = useCallback<ListRenderItem<Word>>(
    ({ item }) => <WordRow w={item} scrubber={showScrubber} onLongPress={onLongPress} cat={examCat} file={file} />,
    [showScrubber, onLongPress, examCat, file],
  );

  const header = useMemo(() => (
    <View style={{ gap: 10, paddingBottom: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        <FilterChip
          label={cat === NO_EXAM ? '확장' : cat ? examName(cat) : '시험'}
          active={!!cat}
          onPress={() => pick('시험', [{ value: '', label: '모든 시험' }, ...EXAMS.map((e) => ({ value: e.id, label: e.name })), { value: NO_EXAM, label: '확장 (문제 밖 단어)' }], setCat)}
        />
        {/* 문제 파일은 시험을 고른 뒤에 그 시험 안에서 고른다 */}
        {files.length > 0 && (
          <FilterChip
            label={file ? sourceName(cat, file) : '문제 파일'}
            active={!!file}
            onPress={() => pick('문제 파일', [{ value: '', label: '모든 문제 파일' }, ...files.map((s) => ({ value: s.id, label: s.name }))], setSrc)}
          />
        )}
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
        {filtersOn && (
          <Pressable
            onPress={() => {
              setCat('');
              setPos('');
              setStatus('');
              setLevels([]);
            }}
            style={{ justifyContent: 'center', paddingHorizontal: 6 }}
          >
            <T v="subhead" color="primary" style={{ fontWeight: '600' }}>
              초기화
            </T>
          </Pressable>
        )}
      </ScrollView>
      {/* 단계는 여러 개 고를 수 있다 — 아무것도 안 고르면(전체) 모든 단계 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, alignItems: 'center' }}>
        <T v="footnote" color="muted" style={{ fontWeight: '700', marginRight: 4 }}>
          단계
        </T>
        <LevelChip label="전체" active={!levels.length} onPress={() => setLevels([])} />
        {LEVELS.map((l) => (
          <LevelChip
            key={l.level}
            label={String(l.level)}
            accessibilityLabel={`${l.level}단계 ${l.name}`}
            active={levels.includes(l.level)}
            onPress={() => setLevels((v) => toggleLevel(v, l.level))}
          />
        ))}
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
  ), [cat, file, files, levels, setCat, pos, status, sort, filtersOn, list.length]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            // react-native-screens 의 타입이 React 19 의 RefObject<T | null> 을 아직 받지 않는다
            ref: searchRef as RefObject<SearchBarCommands>,
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
const WordRow = memo(function WordRow({ w, scrubber, onLongPress, cat, file }: { w: Word; scrubber: boolean; onLongPress: (w: Word) => void; cat: string; file: string }) {
  const { c } = useTheme();
  const status = useProgress((s) => statusOf(s.cards[w.id]));
  const inWrong = useProgress((s) => !!s.wrong[w.id]);
  const freq = cat ? freqIn(w, cat, file || undefined) : w.freq;
  return (
    <Pressable
      // 고른 시험·문제 파일을 함께 넘겨 상세에서 그쪽 예문을 먼저 보여 준다
      onPress={() => router.push({ pathname: '/word/[id]', params: { id: w.id, ...(cat ? { cat } : {}), ...(cat && file ? { src: file } : {}) } })}
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
        <T v="caption" color="muted" style={{ fontVariant: ['tabular-nums'] }}>
          {w.level}단계{freq > 0 ? ` · ${freq}회` : ''}
        </T>
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

/** 단계 켜고 끄기 — 여러 개를 함께 켤 수 있다 */
function LevelChip({ label, active, onPress, accessibilityLabel }: { label: string; active: boolean; onPress: () => void; accessibilityLabel?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        void haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.levelChip, { backgroundColor: active ? c.primarySoft : c.surface, borderColor: active ? c.primary : c.separator }]}
    >
      <Text style={{ fontSize: 14, fontWeight: active ? '700' : '600', color: active ? c.primaryText : c.text2, fontVariant: ['tabular-nums'] }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7, maxWidth: 200 },
  levelChip: { minWidth: 38, alignItems: 'center', borderRadius: 99, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 },
  scrubber: { position: 'absolute', right: 2, top: '28%', width: 22, alignItems: 'center' },
  scrubLetter: { height: 17, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  bubble: { position: 'absolute', alignSelf: 'center', top: '42%', width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

/**
 * 플래시카드 세션 — 단어 → (좌우 스와이프 / 버튼) 안다·모른다 → 카드가 뒤집혀 상세 → (위로 쓸기 / 다음)
 * 모른다 카드는 몇 장 뒤에 다시 나온다 (공용 flashQueue).
 */
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type AlertButton, type LayoutRectangle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { answer, createQueue, currentId, isFinished, split, summary, type FlashQueue, type SplitPart } from '@shared/flashQueue';
import { flashSourceName, flashSplitNotebookName } from '@shared/notebook';
import type { Word } from '@shared/schema';
import { CountUp, ProgressRing } from '@/components/motion';
import { Button, Icon, PosBadge, PressableScale, ProgressBar, ScreenSafeArea, T } from '@/components/ui';
import { SpeakButton, WordBrief } from '@/components/word';
import { WORD_BY_ID } from '@/data/words';
import { afterFrame } from '@/lib/afterFrame';
import { alertButtons } from '@/lib/sheet';
import { speak } from '@/lib/tts';
import { useBackClose } from '@/lib/useBackClose';
import { useProgress } from '@/store/progress';
import { elevation, motion, type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

export interface FlashSessionProps {
  ids: string[];
  title: string;
  /** 어디서 시작했는지 (학습장 이름 등) — 그만할 때 만드는 학습장 이름 앞부분. 없으면 "플래시카드 11/11" */
  source?: string;
  /** 판정을 확정할 때마다 (first = 이 세션에서 처음 본 카드인지) */
  onAnswer: (id: string, known: boolean, first: boolean) => void;
}

const THRESHOLD = 0.35;

const SPLIT_LABEL: Record<SplitPart, string> = { done: '진행한 단어', left: '남은 단어' };

export function FlashSession({ ids, title, source, onAnswer }: FlashSessionProps) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const settings = useProgress((s) => s.settings);
  const [queue, setQueue] = useState<FlashQueue>(() => createQueue(ids));
  const [judged, setJudged] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [stage, setStage] = useState<LayoutRectangle | null>(null);
  const [counter, setCounter] = useState<LayoutRectangle | null>(null);
  const [chipKey, setChipKey] = useState(0);
  const [round, setRound] = useState(0);

  const total = useMemo(() => new Set([...queue.order, ...queue.done]).size, [queue]);
  const id = currentId(queue);
  const w = id ? WORD_BY_ID.get(id) : undefined;
  const keyOf = useCallback((cid: string) => `${round}:${cid}#${queue.misses[cid] ?? 0}`, [queue.misses, round]);

  // 새 카드가 나오면 자동 발음
  const spokenFor = useRef('');
  useEffect(() => {
    if (!w || judged !== null || !settings.autoSpeak) return;
    const k = keyOf(w.id);
    if (spokenFor.current === k) return;
    spokenFor.current = k;
    speak(w.word, { voice: settings.ttsVoice, rate: settings.ttsRate }, w.word);
  }, [w, judged, settings, keyOf]);

  // 카드 더미의 콜백은 항상 같은 함수로 넘긴다(DeckCard 가 memo 라서) — 최신 상태는 ref 로 읽는다
  const latest = useRef({ judged, leaving, id, queue, onAnswer, reduced });
  latest.current = { judged, leaving, id, queue, onAnswer, reduced };

  const commit = useCallback((known: boolean) => {
    const { judged: j, leaving: l, id: cur } = latest.current;
    if (j !== null || l || !cur) return;
    latest.current.judged = known; // 다시 그려지기 전에 두 번 판정되지 않게
    void (known ? haptic.success() : haptic.warning());
    setJudged(known);
  }, []);

  const next = useCallback(() => {
    const { judged: known, leaving: l, id: cur, queue: q, onAnswer: report, reduced: r } = latest.current;
    if (known === null || l || !cur) return;
    latest.current.leaving = true; // 빠르게 두 번 눌러도 한 번만 넘어가게
    setLeaving(true);
    if (!known) setChipKey((k) => k + 1);
    const first = !(cur in q.first);
    setTimeout(
      () => {
        setQueue((qq) => answer(qq, known));
        setJudged(null);
        setLeaving(false);
        // 기록(SRS·통계·오답노트)은 다음 카드가 앞으로 오는 프레임 뒤에
        afterFrame(() => report(cur, known, first));
      },
      r ? 120 : 240,
    );
  }, []);

  const toggle = useCallback(() => setJudged((j) => (j === null ? j : !j)), []);

  /**
   * 그만하기 — 진행한 단어 / 남은 단어를 각각 학습장으로 남길 수 있다.
   * 하나를 만들면 확인창을 다시 띄워(만든 쪽 버튼은 빼고) 나머지도 만들거나 그만둘 수 있게 한다.
   * (토스트는 이 전체 화면 모달 뒤에 가려져 보이지 않으므로 확인창 문구로 알린다)
   */
  const exit = (made: { part: SplitPart; name: string }[] = []) => {
    if (!made.length && !queue.done.length && judged === null) return router.back();
    const parts = split(queue);
    const save = (part: SplitPart) => {
      const name = flashSplitNotebookName(part, source ?? flashSourceName({ set: '' }, []));
      useProgress.getState().createNotebook(name, parts[part]);
      void haptic.success();
      // 닫히는 확인창 위에 바로 띄우면 뜨지 않을 수 있어 잠깐 기다린다
      setTimeout(() => exit([...made, { part, name }]), 350);
    };
    const buttons: AlertButton[] = (['done', 'left'] as const)
      .filter((part) => parts[part].length > 0 && !made.some((m) => m.part === part))
      .map((part) => ({ text: `${SPLIT_LABEL[part]} ${parts[part].length}개로 학습장 만들기`, onPress: () => save(part) }));
    buttons.push({ text: '그만하기', style: 'destructive', onPress: () => router.back() }, { text: '계속하기', style: 'cancel' });
    const last = made[made.length - 1];
    // 버튼이 4개까지 나온다 — 안드로이드 기본 확인창은 3개까지라 lib/sheet 의 것을 쓴다
    alertButtons(
      last ? '학습장을 만들었어요' : '학습을 그만할까요?',
      last
        ? `'${last.name}' 학습장에 ${SPLIT_LABEL[last.part]}를 담았어요.`
        : '지금까지의 결과는 저장돼요.\n진행한 단어·남은 단어를 학습장으로 남겨 두면 나중에 이어서 볼 수 있어요.',
      buttons,
    );
  };

  const restartWith = (list: string[]) => {
    setQueue(createQueue(list));
    setJudged(null);
    setRound((r) => r + 1);
  };

  // 안드로이드 뒤로 가기 — 학습 중이면 그만할지 묻고, 결과 화면이면 바로 닫는다
  const finished = isFinished(queue);
  useBackClose(() => (finished ? router.back() : exit()));

  if (finished) {
    return <FlashSummary queue={queue} title={title} onAgain={restartWith} />;
  }

  const top = queue.order.slice(0, 3);
  const repeat = !!id && id in queue.first;

  return (
    <ScreenSafeArea style={{ backgroundColor: c.bg }}>
      {/* 상단 막대 */}
      <View style={styles.bar}>
        <Pressable onPress={() => exit()} hitSlop={10} style={[styles.close, { backgroundColor: c.surface2 }]} accessibilityLabel="닫기">
          <Icon name="xmark" size={14} color={c.text2} />
        </Pressable>
        <ProgressBar value={queue.done.length} max={total} style={{ flex: 1 }} />
        <View onLayout={(e) => setCounter(e.nativeEvent.layout)}>
          <Text style={[type.footnote, { color: c.muted, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' }]}>
            {queue.done.length}/{total}
          </Text>
        </View>
      </View>

      {/* 카드 더미 */}
      <View style={styles.stage} onLayout={(e) => setStage(e.nativeEvent.layout)}>
        {stage &&
          [...top].reverse().map((cid) => {
            const depth = top.indexOf(cid);
            const word = WORD_BY_ID.get(cid);
            if (!word) return null;
            return (
              <DeckCard
                key={keyOf(cid)}
                w={word}
                depth={depth}
                width={stage.width}
                height={stage.height}
                judged={depth === 0 ? judged : null}
                leaving={depth === 0 && leaving}
                repeat={depth === 0 && repeat}
                onCommit={commit}
                onNext={next}
                onToggle={toggle}
              />
            );
          })}
      </View>

      {/* 하단 */}
      <T v="footnote" color="muted" style={{ textAlign: 'center', marginBottom: 8 }}>
        {judged === null ? '← 모른다 · 안다 →' : '↑ 위로 쓸어도 다음'}
      </T>
      <View style={styles.actions}>
        {judged === null ? (
          <>
            <Button title="모른다" icon="xmark" variant="danger" big style={{ flex: 1 }} onPress={() => commit(false)} />
            <Button title="안다" icon="checkmark" variant="success" big style={{ flex: 1 }} onPress={() => commit(true)} />
          </>
        ) : (
          <Button title="다음" icon="arrow.up" variant="primary" big style={{ flex: 1 }} onPress={next} />
        )}
      </View>

      {/* 모른다 → "+N장 뒤 다시" 칩이 카운터로 날아간다 */}
      {chipKey > 0 && stage && counter && <RequeueChip key={chipKey} from={{ x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 }} to={{ x: counter.x, y: counter.y }} reduced={reduced} />}
    </ScreenSafeArea>
  );
}

/* ───────────────── 카드 한 장 ───────────────── */
const DeckCard = memo(function DeckCard({
  w,
  depth,
  width,
  height,
  judged,
  leaving,
  repeat,
  onCommit,
  onNext,
  onToggle,
}: {
  w: Word;
  depth: number;
  width: number;
  height: number;
  judged: boolean | null;
  leaving: boolean;
  repeat: boolean;
  onCommit: (known: boolean) => void;
  onNext: () => void;
  onToggle: () => void;
}) {
  const { c, dark } = useTheme();
  const reduced = useReducedMotion();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const flip = useSharedValue(0);
  const out = useSharedValue(0);
  const d = useSharedValue(Math.min(depth + 1, 3));
  const crossed = useSharedValue(0);

  // 더미 안 위치: 앞으로 올 때 spring (딜 모션)
  useEffect(() => {
    d.value = withSpring(depth, motion.gentle);
  }, [depth, d]);

  // 판정 → 가운데로 돌아오며 뒤집기 ("사실 알았어요" 로 판정만 바꿀 때는 다시 움직이지 않는다)
  const flipped = useRef(false);
  useEffect(() => {
    if (judged === null || flipped.current) return;
    flipped.current = true;
    const nudge = tx.value === 0 && !reduced ? (judged ? 26 : -26) : tx.value;
    tx.value = withSequence(withTiming(nudge, { duration: 100 }), withSpring(0, motion.gentle));
    ty.value = withSpring(0, motion.gentle);
    flip.value = withTiming(1, reduced ? { duration: 180 } : motion.flip);
    crossed.value = 0;
  }, [judged]); // eslint-disable-line react-hooks/exhaustive-deps

  // 다음 → 위로 날아감
  useEffect(() => {
    if (!leaving) return;
    out.value = withTiming(1, { duration: reduced ? 150 : 260 });
  }, [leaving, out, reduced]);

  // 제스처는 판정·위치가 바뀔 때만 새로 만든다 (매 렌더마다 만들면 네이티브 쪽에 다시 붙인다)
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(depth === 0 && judged === null)
        .onUpdate((e) => {
          tx.value = e.translationX;
          ty.value = e.translationY * 0.15;
          const over = Math.abs(e.translationX) > width * THRESHOLD ? 1 : 0;
          if (over !== crossed.value) {
            crossed.value = over;
            if (over) runOnJS(haptic.threshold)();
          }
        })
        .onEnd((e) => {
          const far = Math.abs(e.translationX) > width * THRESHOLD;
          const fast = Math.abs(e.velocityX) > 900 && Math.abs(e.translationX) > 40;
          if (far || fast) runOnJS(onCommit)(e.translationX > 0);
          else {
            tx.value = withSpring(0, motion.gentle);
            ty.value = withSpring(0, motion.gentle);
            crossed.value = 0;
          }
        }),
    [depth, judged, width, onCommit, tx, ty, crossed],
  );

  const swipeUp = useMemo(
    () =>
      Gesture.Pan()
        .enabled(depth === 0 && judged !== null)
        .activeOffsetY(-12)
        .onUpdate((e) => {
          ty.value = Math.min(0, e.translationY);
        })
        .onEnd((e) => {
          if (e.translationY < -80 || e.velocityY < -800) runOnJS(onNext)();
          else ty.value = withSpring(0, motion.gentle);
        }),
    [depth, judged, onNext, ty],
  );

  const cardStyle = useAnimatedStyle(() => {
    const k = d.value;
    const scale = interpolate(k, [0, 1, 2, 3], [1, 0.94, 0.88, 0.84]);
    // 가운데 기준으로 줄어든 만큼 내려 아래 가장자리를 맞춘 뒤 10·20px 더 내려, 뒤 카드가 앞 카드 아래로 살짝 보이게 한다
    const y0 = (height / 2) * (1 - scale) + interpolate(k, [0, 1, 2, 3], [0, 10, 20, 26]);
    const opacity = interpolate(k, [0, 1, 2, 3], [1, 0.6, 0.3, 0]) * (1 - out.value);
    const rot = reduced ? 0 : (tx.value / width) * 12 - out.value * 4;
    return {
      opacity,
      transform: [{ translateX: tx.value }, { translateY: y0 + ty.value - out.value * height * 1.15 }, { rotate: `${rot}deg` }, { scale }],
    };
  });
  const frontStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - flip.value }
      : { transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }] },
  );
  const backStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: flip.value }
      : { transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180 + 180}deg` }] },
  );
  const tintStyle = useAnimatedStyle(() => ({
    backgroundColor: tx.value > 0 ? c.success : c.danger,
    opacity: Math.min(1, Math.abs(tx.value) / (width * THRESHOLD)) * 0.22,
  }));
  const knowStamp = useAnimatedStyle(() => {
    const k = tx.value > 0 ? Math.min(1, tx.value / (width * THRESHOLD)) : 0;
    return { opacity: k, transform: [{ rotate: '-12deg' }, { scale: 0.8 + 0.2 * k + crossed.value * 0.08 }] };
  });
  const dontStamp = useAnimatedStyle(() => {
    const k = tx.value < 0 ? Math.min(1, -tx.value / (width * THRESHOLD)) : 0;
    return { opacity: k, transform: [{ rotate: '12deg' }, { scale: 0.8 + 0.2 * k + crossed.value * 0.08 }] };
  });

  const face = [styles.face, { backgroundColor: c.surface }, elevation(c, dark, 2)];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { bottom: 24 }, cardStyle]} pointerEvents={depth === 0 ? 'auto' : 'none'}>
      {/* 앞면 */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[face, styles.front, frontStyle]}>
          {repeat && <RepeatBadge />}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
            {w.pos.slice(0, 2).map((p) => (
              <PosBadge key={p} pos={p} />
            ))}
          </View>
          <Text adjustsFontSizeToFit numberOfLines={2} maxFontSizeMultiplier={1.3} style={[type.cardWord, { color: c.text, textAlign: 'center' }]}>
            {w.word}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 12 }}>
            {!!w.ipa && <Text style={[type.title3, { color: c.muted, fontWeight: '400' }]}>/{w.ipa}/</Text>}
            <SpeakButton text={w.word} size={20} speakKey={w.word} />
          </View>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 26 }, tintStyle]} />
          <Animated.View pointerEvents="none" style={[styles.stamp, { left: 22, borderColor: c.success }, knowStamp]}>
            <Text style={[styles.stampText, { color: c.success }]}>안다</Text>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.stamp, { right: 22, borderColor: c.danger }, dontStamp]}>
            <Text style={[styles.stampText, { color: c.danger }]}>모른다</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* 뒷면 */}
      <Animated.View style={[face, backStyle]} pointerEvents={judged === null ? 'none' : 'auto'}>
        <GestureDetector gesture={swipeUp}>
          <View>
            <View style={[styles.verdict, { backgroundColor: judged ? c.successSoft : c.dangerSoft }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                <Icon name={judged ? 'checkmark' : 'xmark'} size={13} color={judged ? c.success : c.danger} weight="bold" />
                <Text style={[type.footnote, { color: judged ? c.success : c.danger, fontWeight: '700' }]}>{judged ? '안다고 했어요' : '모른다 — 몇 장 뒤에 다시'}</Text>
              </View>
              <Pressable onPress={onToggle} hitSlop={8}>
                <Text style={[type.footnote, { color: judged ? c.success : c.danger, fontWeight: '600', opacity: 0.85 }]}>{judged ? '사실 몰랐어요' : '사실 알았어요'}</Text>
              </Pressable>
            </View>
            <View style={styles.backHead}>
              <Text style={[type.title3, { color: c.text, fontWeight: '700' }]}>{w.word}</Text>
              {!!w.ipa && <Text style={[type.subhead, { color: c.muted }]}>/{w.ipa}/</Text>}
              <View style={{ flex: 1 }} />
              <PressableScale onPress={() => router.push({ pathname: '/word/[id]', params: { id: w.id } })} hitSlop={8}>
                <Text style={[type.footnote, { color: c.primary, fontWeight: '600' }]}>상세 ›</Text>
              </PressableScale>
            </View>
          </View>
        </GestureDetector>
        {judged !== null && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
            <WordBrief w={w} contextLimit={2} memory />
          </ScrollView>
        )}
      </Animated.View>
    </Animated.View>
  );
});

function RepeatBadge() {
  const { c } = useTheme();
  const k = useSharedValue(1);
  useEffect(() => {
    k.value = withSequence(withTiming(0.25, { duration: 300 }), withTiming(1, { duration: 300 }), withTiming(0.25, { duration: 300 }), withTiming(1, { duration: 300 }));
  }, [k]);
  const a = useAnimatedStyle(() => ({ opacity: k.value }));
  return (
    <Animated.View style={[styles.repeat, { backgroundColor: c.warningSoft }, a]}>
      <Text style={{ color: c.warning, fontSize: 12, fontWeight: '700' }}>다시 나온 카드</Text>
    </Animated.View>
  );
}

function RequeueChip({ from, to, reduced }: { from: { x: number; y: number }; to: { x: number; y: number }; reduced: boolean }) {
  const { c } = useTheme();
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withTiming(1, { duration: reduced ? 1 : 600 });
  }, [k, reduced]);
  const a = useAnimatedStyle(() => {
    const t = k.value;
    const lift = t < 0.3 ? interpolate(t, [0, 0.3], [0, -30]) : interpolate(t, [0.3, 1], [-30, 0]);
    const p = t < 0.3 ? 0 : (t - 0.3) / 0.7;
    return {
      opacity: t < 0.75 ? 1 : interpolate(t, [0.75, 1], [1, 0]),
      transform: [
        { translateX: from.x - 60 + (to.x - from.x + 20) * p },
        { translateY: from.y + lift + (to.y - from.y) * p },
        { scale: interpolate(t, [0, 0.3, 1], [1, 1.05, 0.5]) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.chip, { backgroundColor: c.warning }, a]}>
      <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>몇 장 뒤 다시</Text>
    </Animated.View>
  );
}

/* ───────────────── 요약 ───────────────── */
function FlashSummary({ queue, title, onAgain }: { queue: FlashQueue; title: string; onAgain: (ids: string[]) => void }) {
  const { c } = useTheme();
  const s = summary(queue);
  const pct = s.total ? s.known / s.total : 0;
  useEffect(() => {
    void haptic.done();
  }, []);
  return (
    <ScreenSafeArea style={{ backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.summary}>
        <T v="subhead" color="muted">
          {title}
        </T>
        <ProgressRing pct={pct} size={160} stroke={13} duration={900}>
          <CountUp to={Math.round(pct * 100)} duration={900} suffix="%" style={{ fontSize: 36, fontWeight: '800', color: c.text }} />
        </ProgressRing>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <T v="title2">끝까지 봤어요</T>
          <T v="subhead" color="muted">
            처음에 바로 안 단어 비율
          </T>
        </View>
        <View style={styles.stat3}>
          <Stat n={s.total} label="전체" color={c.text} />
          <Stat n={s.known} label="바로 앎" color={c.success} />
          <Stat n={s.unknown.length} label="모름" color={c.danger} />
        </View>
        {s.unknown.length > 0 && (
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            <T v="footnote" color="muted" style={{ fontWeight: '700' }}>
              모른 단어 · 오답노트에 담겼어요
            </T>
            {s.unknown.map((uid, i) => {
              const uw = WORD_BY_ID.get(uid);
              return (
                <Animated.View key={uid} entering={FadeInDown.delay(300 + i * 40)}>
                  <Pressable onPress={() => router.push({ pathname: '/word/[id]', params: { id: uid } })} style={[styles.unknownRow, { backgroundColor: c.surface }]}>
                    <Text style={[type.headline, { color: c.text }]}>{uw?.word}</Text>
                    <Text numberOfLines={1} style={[type.subhead, { color: c.text2, flex: 1, textAlign: 'right' }]}>
                      {uw?.short}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <Animated.View entering={FadeIn.delay(400)} style={styles.summaryActions}>
        {s.unknown.length > 0 && <Button title="모른 단어만 다시" icon="arrow.counterclockwise" variant="primary" big onPress={() => onAgain(s.unknown)} />}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="전체 다시" variant="secondary" style={{ flex: 1 }} onPress={() => onAgain(Object.keys(queue.first))} />
          <Button title="닫기" variant="tinted" style={{ flex: 1 }} onPress={() => router.back()} />
        </View>
      </Animated.View>
    </ScreenSafeArea>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  const { c, dark } = useTheme();
  return (
    <View style={[styles.statBox, { backgroundColor: c.surface }, elevation(c, dark)]}>
      <CountUp to={n} style={{ fontSize: 24, fontWeight: '800', color }} />
      <T v="caption" color="muted">
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, marginHorizontal: 20, marginTop: 4 },
  face: { ...StyleSheet.absoluteFillObject, borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden', backfaceVisibility: 'hidden' },
  front: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  stamp: { position: 'absolute', top: 28, borderWidth: 3, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  stampText: { fontSize: 20, fontWeight: '800' },
  repeat: { position: 'absolute', top: 20, alignSelf: 'center', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  verdict: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 18, paddingVertical: 12 },
  backHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
  chip: { position: 'absolute', left: 0, top: 0, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  summary: { alignItems: 'center', gap: 20, padding: 24, paddingBottom: 40 },
  stat3: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  statBox: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, borderRadius: 16 },
  unknownRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  summaryActions: { gap: 10, paddingHorizontal: 20, paddingBottom: 10 },
});

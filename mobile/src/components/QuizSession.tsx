/**
 * 객관식 세션 — 영어 단어(또는 문제 속 문장의 단어)를 보고 한글 뜻 고르기.
 * 오답 보기는 공용 distractors(같은 품사·비슷한 뜻 분류, 동의어 제외)로 만든다.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { buildContextQuestion, buildMeaningQuestion, type Question } from '@shared/distractors';
import type { Word } from '@shared/schema';
import { CountUp, ProgressRing } from '@/components/motion';
import { Button, Icon, PosBadge, ProgressBar, ScreenSafeArea, T } from '@/components/ui';
import { Highlighted, SpeakButton, WordBrief } from '@/components/word';
import { contextsOf, WORD_BY_ID, WORDS } from '@/data/words';
import { afterFrame } from '@/lib/afterFrame';
import { speak } from '@/lib/tts';
import type { ExamplePref } from '@shared/corpus';
import { useExamPref } from '@/components/ExamPref';
import { useProgress } from '@/store/progress';
import { elevation, motion, type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

export type QuizMode = 'meaning' | 'context' | 'mixed';

const POOL_ALL = WORDS;
/** 1단계(아주 쉬운 단어)의 뜻은 오답 보기로 너무 쉬워서, 1단계 단어를 낼 때만 쓴다 */
const POOL_NO_EASY = WORDS.filter((w) => w.level > 1);

function makeQuestion(w: Word, mode: QuizMode, choices: number, pref: ExamplePref): Question {
  const pool = w.level === 1 ? POOL_ALL : POOL_NO_EASY;
  const useContext = mode === 'context' || (mode === 'mixed' && w.contexts.length > 0 && Math.random() < 0.5);
  if (useContext) {
    const ctx = contextsOf(w, 4, pref).filter((x) => !/[가-힣]/.test(x.en));
    if (ctx.length) return buildContextQuestion(w, pool, ctx, choices);
  }
  return buildMeaningQuestion(w, pool, choices);
}

export function QuizSession({ ids: initialIds, mode, title, onResult }: { ids: string[]; mode: QuizMode; title: string; onResult: (id: string, correct: boolean) => void }) {
  const { c, dark } = useTheme();
  const reduced = useReducedMotion();
  const settings = useProgress((s) => s.settings);
  const pref = useExamPref();
  const [ids, setIds] = useState(initialIds);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [round, setRound] = useState(0);
  const questions = useRef<Record<string, Question>>({});
  const scroll = useRef<ScrollView>(null);

  const id = ids[index];
  const w = id ? WORD_BY_ID.get(id) : undefined;
  const q = useMemo(() => {
    if (!w) return undefined;
    const k = `${round}:${index}`;
    questions.current[k] ??= makeQuestion(w, mode, settings.quizChoices, pref);
    return questions.current[k];
  }, [w, index, round, mode, settings.quizChoices, pref]);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (w && q?.mode === 'meaning' && settings.autoSpeak) speak(w.word, { voice: settings.ttsVoice, rate: settings.ttsRate }, w.word);
  }, [index, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = useCallback(
    (i: number) => {
      if (!q || !w || picked !== null) return;
      const correct = !!q.options[i]?.correct;
      setPicked(i);
      setResults((r) => ({ ...r, [w.id]: correct }));
      void (correct ? haptic.success() : haptic.error());
      // 기록은 정답 표시 애니메이션이 시작된 뒤에
      afterFrame(() => onResult(w.id, correct));
      setTimeout(() => scroll.current?.scrollToEnd({ animated: !reduced }), 260);
      // 해설을 보는 동안 다음 문제(오답 보기 고르기)를 미리 만들어 둔다 — "다음"을 누를 때 멈칫하지 않게
      const nextWord = WORD_BY_ID.get(ids[index + 1] ?? '');
      if (nextWord) {
        const k = `${round}:${index + 1}`;
        setTimeout(() => {
          questions.current[k] ??= makeQuestion(nextWord, mode, settings.quizChoices, pref);
        }, 600);
      }
    },
    [q, w, picked, onResult, reduced, ids, index, round, mode, settings.quizChoices, pref],
  );

  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  const restart = (list: string[]) => {
    setIds(list);
    setIndex(0);
    setPicked(null);
    setResults({});
    setRound((r) => r + 1);
  };

  const exit = () => {
    if (index === 0 && picked === null) return router.back();
    Alert.alert('퀴즈를 그만할까요?', '지금까지 푼 결과는 저장돼요.', [
      { text: '계속하기', style: 'cancel' },
      { text: '그만하기', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  if (index >= ids.length) return <QuizSummary ids={ids} results={results} title={title} onRestart={restart} />;
  if (!w || !q) return null;

  const answered = picked !== null;
  const correctIndex = q.options.findIndex((o) => o.correct);
  const ok = answered && picked === correctIndex;

  return (
    <ScreenSafeArea style={{ backgroundColor: c.bg }}>
      <View style={styles.bar}>
        <Pressable onPress={exit} hitSlop={10} style={[styles.close, { backgroundColor: c.surface2 }]} accessibilityLabel="닫기">
          <Icon name="xmark" size={14} color={c.text2} />
        </Pressable>
        <ProgressBar value={index + (answered ? 1 : 0)} max={ids.length} style={{ flex: 1 }} />
        <Text style={[type.footnote, { color: c.muted, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' }]}>
          {index + 1}/{ids.length}
        </Text>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.body} key={`${round}:${index}`}>
        {/* 문제 */}
        <Animated.View entering={reduced ? undefined : FadeInRight.duration(260)} style={[styles.prompt, { backgroundColor: c.surface }, elevation(c, dark)]}>
          {q.mode === 'context' && q.context ? (
            <View style={{ gap: 10 }}>
              <Text style={[type.footnote, { color: c.muted, fontWeight: '600' }]}>
                이 문장에서 <Text style={{ color: c.text, fontWeight: '800' }}>{q.context.surface}</Text> 의 뜻은?
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
                <Highlighted text={q.context.en} surface={q.context.surface} style={[type.body, { color: c.text, lineHeight: 26, flex: 1 }]} />
                <SpeakButton text={q.context.en} size={16} speakKey={`q:${q.context.en}`} tint={c.muted} />
              </View>
              {answered && !!q.context.ko && (
                <Animated.Text entering={FadeIn} style={[type.subhead, { color: c.text2, lineHeight: 21 }]}>
                  {q.context.ko.replace(/`/g, '')}
                </Animated.Text>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {w.pos.slice(0, 2).map((p) => (
                  <PosBadge key={p} pos={p} />
                ))}
              </View>
              <Text adjustsFontSizeToFit numberOfLines={1} maxFontSizeMultiplier={1.3} style={[type.cardWord, { color: c.text }]}>
                {w.word}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8 }}>
                {!!w.ipa && <Text style={[type.callout, { color: c.muted }]}>/{w.ipa}/</Text>}
                <SpeakButton text={w.word} size={18} />
              </View>
            </View>
          )}
        </Animated.View>

        {/* 보기 */}
        <View style={{ gap: 10 }}>
          {q.options.map((o, i) => {
            const owner = answered && !o.correct && o.wordId && o.wordId !== w.id ? WORD_BY_ID.get(o.wordId)?.word : undefined;
            const state: OptionState = !answered ? 'idle' : o.correct ? 'right' : i === picked ? 'wrong' : 'dim';
            return <OptionButton key={i} index={i} text={o.text} owner={owner} state={state} revealDelay={o.correct && !ok ? 120 : 0} onPress={() => choose(i)} />;
          })}
        </View>

        {/* 해설 */}
        {answered && (
          <Animated.View entering={reduced ? FadeIn : FadeInDown.springify().damping(15).delay(140)} style={[styles.explain, { backgroundColor: c.surface }, elevation(c, dark)]}>
            <View style={[styles.result, { backgroundColor: ok ? c.successSoft : c.dangerSoft }]}>
              <Icon name={ok ? 'checkmark.circle.fill' : 'xmark.circle.fill'} size={17} color={ok ? c.success : c.danger} />
              <Text style={[type.subhead, { color: ok ? c.success : c.danger, fontWeight: '700' }]}>{ok ? '정답이에요' : '틀렸어요 — 오답노트에 담았어요'}</Text>
            </View>
            <WordBrief w={w} contextLimit={1} highlightSense={q.context?.sense} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="상세" variant="secondary" onPress={() => router.push({ pathname: '/word/[id]', params: { id: w.id } })} />
              <Button title={index + 1 < ids.length ? '다음 문제' : '결과 보기'} icon="arrow.right" variant="primary" style={{ flex: 1 }} onPress={next} />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </ScreenSafeArea>
  );
}

/* ───────────────── 보기 버튼 ───────────────── */
type OptionState = 'idle' | 'right' | 'wrong' | 'dim';

function OptionButton({ index, text, owner, state, revealDelay, onPress }: { index: number; text: string; owner?: string; state: OptionState; revealDelay: number; onPress: () => void }) {
  const { c, dark } = useTheme();
  const reduced = useReducedMotion();
  const fill = useSharedValue(0);
  const shake = useSharedValue(0);
  const pop = useSharedValue(1);
  const press = useSharedValue(1);

  useEffect(() => {
    if (state === 'right') {
      fill.value = withDelay(revealDelay, withTiming(1, { duration: reduced ? 1 : 240 }));
      pop.value = withDelay(revealDelay, withSequence(withTiming(0, { duration: 1 }), withSpring(1.15, motion.bouncy), withSpring(1, motion.snappy)));
    } else if (state === 'wrong') {
      fill.value = withTiming(1, { duration: reduced ? 1 : 240 });
      if (!reduced) shake.value = withSequence(withTiming(-8, { duration: 45 }), withTiming(8, { duration: 60 }), withTiming(-6, { duration: 60 }), withTiming(5, { duration: 55 }), withTiming(0, { duration: 50 }));
    } else fill.value = 0;
  }, [state, revealDelay, reduced, fill, shake, pop]);

  const wrap = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: press.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  const numStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const tone = state === 'right' ? c.success : state === 'wrong' ? c.danger : null;
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(120 + index * 30).springify().damping(16)} style={[wrap, { opacity: state === 'dim' ? 0.5 : 1 }]}>
      <Pressable
        disabled={state !== 'idle'}
        onPress={onPress}
        onPressIn={() => (press.value = withSpring(0.98, motion.snappy))}
        onPressOut={() => (press.value = withSpring(1, motion.snappy))}
        accessibilityRole="button"
        accessibilityLabel={`${index + 1}번 ${text}`}
        style={[styles.option, { backgroundColor: c.surface }, elevation(c, dark)]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: state === 'right' ? c.successSoft : c.dangerSoft, transformOrigin: 'left' }, fillStyle]}
        />
        <Animated.View style={[styles.num, { backgroundColor: tone ?? c.surface2 }, numStyle]}>
          {tone ? (
            <Icon name={state === 'right' ? 'checkmark' : 'xmark'} size={13} color="#FFFFFF" weight="bold" />
          ) : (
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.muted }}>{index + 1}</Text>
          )}
        </Animated.View>
        <Text style={[type.callout, { color: c.text, fontWeight: '600', flex: 1 }]}>{text}</Text>
        {!!owner && <Text style={[type.caption, { color: c.muted }]}>{owner}</Text>}
      </Pressable>
    </Animated.View>
  );
}

/* ───────────────── 요약 ───────────────── */
function QuizSummary({ ids, results, title, onRestart }: { ids: string[]; results: Record<string, boolean>; title: string; onRestart: (ids: string[]) => void }) {
  const { c } = useTheme();
  const wrongIds = ids.filter((x) => results[x] === false);
  const correctN = ids.length - wrongIds.length;
  const pct = ids.length ? correctN / ids.length : 0;
  useEffect(() => {
    void haptic.done();
  }, []);
  return (
    <ScreenSafeArea style={{ backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.summary}>
        <T v="subhead" color="muted">
          {title}
        </T>
        <ProgressRing pct={pct} size={160} stroke={13} duration={900} color={pct >= 0.8 ? c.success : c.primary}>
          <CountUp to={Math.round(pct * 100)} duration={900} suffix="점" style={{ fontSize: 34, fontWeight: '800', color: c.text }} />
        </ProgressRing>
        <T v="title3">
          {ids.length}문제 중 {correctN}개 맞힘
        </T>
        {wrongIds.length > 0 && (
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            <T v="footnote" color="muted" style={{ fontWeight: '700' }}>
              틀린 단어 · 오답노트에 담겼어요
            </T>
            {wrongIds.map((wid, i) => {
              const ww = WORD_BY_ID.get(wid);
              return (
                <Animated.View key={wid} entering={FadeInDown.delay(300 + i * 40)}>
                  <Pressable onPress={() => router.push({ pathname: '/word/[id]', params: { id: wid } })} style={[styles.wrongRow, { backgroundColor: c.surface }]}>
                    <Text style={[type.headline, { color: c.text }]}>{ww?.word}</Text>
                    <Text numberOfLines={1} style={[type.subhead, { color: c.text2, flex: 1, textAlign: 'right' }]}>
                      {ww?.short}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <Animated.View entering={FadeIn.delay(400)} style={{ gap: 10, paddingHorizontal: 20, paddingBottom: 10 }}>
        {wrongIds.length > 0 && <Button title="틀린 것만 다시 풀기" icon="arrow.counterclockwise" variant="primary" big onPress={() => onRestart(wrongIds)} />}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="전체 다시" variant="secondary" style={{ flex: 1 }} onPress={() => onRestart([...ids].sort(() => Math.random() - 0.5))} />
          <Button title="닫기" variant="tinted" style={{ flex: 1 }} onPress={() => router.back()} />
        </View>
      </Animated.View>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, paddingTop: 6, gap: 14, paddingBottom: 40 },
  prompt: { borderRadius: 22, borderCurve: 'continuous', padding: 20 },
  option: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  num: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  explain: { borderRadius: 22, borderCurve: 'continuous', padding: 16, gap: 16 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  summary: { alignItems: 'center', gap: 18, padding: 24, paddingBottom: 40 },
  wrongRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
});

/** 단어 표시 조각 — 발음 버튼, 형광펜 예문, 예문 카드, 뜻 요약 */
import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { Context, Word } from '@shared/schema';
import { contextsOf, sourceLabel } from '@/data/words';
import { speak, useSpeaking } from '@/lib/tts';
import { useProgress } from '@/store/progress';
import { type, useTheme } from '@/theme';
import { Icon, PosBadge, PressableScale, SectionLabel, T } from './ui';

/* ───── 🔊 — 말하는 동안 막대 3개가 출렁인다 ───── */
function WaveBar({ i, color }: { i: number; color: string }) {
  const k = useSharedValue(0.4);
  useEffect(() => {
    k.value = withDelay(i * 110, withRepeat(withSequence(withTiming(1, { duration: 260 }), withTiming(0.4, { duration: 260 })), -1, false));
  }, [i, k]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: k.value }] }));
  return <Animated.View style={[{ width: 3, height: 14, borderRadius: 2, backgroundColor: color }, a]} />;
}

export function SpeakButton({ text, size = 20, speakKey, tint }: { text: string; size?: number; speakKey?: string; tint?: string }) {
  const { c } = useTheme();
  const { ttsVoice, ttsRate } = useProgress((s) => s.settings);
  const key = speakKey ?? text;
  const speaking = useSpeaking((s) => s.key === key);
  const color = tint ?? c.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="발음 듣기"
      hitSlop={10}
      onPress={() => speak(text, { voice: ttsVoice, rate: ttsRate }, key)}
      style={[styles.speak, { width: size + 18, height: size + 18, backgroundColor: speaking ? c.primarySoft : 'transparent' }]}
    >
      {speaking ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2.5 }}>
          {[0, 1, 2].map((i) => (
            <WaveBar key={i} i={i} color={color} />
          ))}
        </View>
      ) : (
        <Icon name="speaker.wave.2.fill" size={size} color={color} />
      )}
    </PressableScale>
  );
}

/* ───── 형광펜 강조 + `코드` 표시 ───── */
function renderCode(text: string, codeStyle: TextStyle, k: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.length > 1 && part.startsWith('`') && part.endsWith('`') ? (
      <Text key={`${k}${i}`} style={codeStyle}>
        {part.slice(1, -1)}
      </Text>
    ) : (
      <Text key={`${k}${i}`}>{part}</Text>
    ),
  );
}

export function Highlighted({ text, surface, style }: { text: string; surface: string; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  const code: TextStyle = { fontFamily: 'Menlo', fontSize: 14, backgroundColor: c.surface3 };
  const i = surface ? text.toLowerCase().indexOf(surface.toLowerCase()) : -1;
  if (i < 0) return <Text style={style}>{renderCode(text, code, 'p')}</Text>;
  return (
    <Text style={style}>
      {renderCode(text.slice(0, i), code, 'a')}
      <Text style={{ backgroundColor: c.marker, color: c.markerText, fontWeight: '700' }}>{text.slice(i, i + surface.length)}</Text>
      {renderCode(text.slice(i + surface.length), code, 'b')}
    </Text>
  );
}

/* ───── 예문 카드 ───── */
export function ContextCard({ c: ctx, showSense = true, index = 0 }: { c: Context; showSense?: boolean; index?: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const isKo = /[가-힣]/.test(ctx.en);
  return (
    <Animated.View entering={reduced ? undefined : FadeIn.delay(index * 80).duration(320)} style={[styles.ctx, { backgroundColor: c.surface2 }]}>
      {showSense && !!ctx.sense && (
        <View style={styles.senseRow}>
          <Text style={[type.footnote, { color: c.primaryText, fontWeight: '700', flexShrink: 1 }]}>{ctx.sense}</Text>
          {!!ctx.pos && <Text style={[type.footnote, { color: c.muted }]}>· {ctx.pos}</Text>}
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
        <Highlighted text={ctx.en} surface={ctx.surface} style={[type.callout, { color: c.text, lineHeight: 23, flex: 1 }]} />
        {!isKo && <SpeakButton text={ctx.en} size={15} speakKey={`ctx:${ctx.en}`} tint={c.muted} />}
      </View>
      {!!ctx.ko && <Text style={[type.subhead, { color: c.text2, lineHeight: 21, marginTop: 6 }]}>{ctx.ko.replace(/`/g, '')}</Text>}
      <Text style={[type.caption, { color: c.muted, marginTop: 8 }]}>{sourceLabel(ctx)}</Text>
    </Animated.View>
  );
}

/* ───── 단어 머리 (상세·카드) ───── */
export function WordHead({ w, big = false }: { w: Word; big?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {!!w.ipa && <Text style={[type.callout, { color: c.muted }]}>/{w.ipa}/</Text>}
        {w.pos.map((p) => (
          <PosBadge key={p} pos={p} />
        ))}
        {!big && <SpeakButton text={w.word} size={18} />}
      </View>
    </View>
  );
}

export function SenseList({ w, highlight }: { w: Word; highlight?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      {w.senses.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Text style={[type.footnote, { color: c.muted, fontWeight: '700', width: 14, textAlign: 'right', marginTop: 2 }]}>{i + 1}</Text>
          <Text style={[type.callout, { color: highlight === s.ko ? c.primaryText : c.text, fontWeight: highlight === s.ko ? '700' : '400', flexShrink: 1 }]}>{s.ko}</Text>
          <PosBadge pos={s.pos} small />
        </View>
      ))}
    </View>
  );
}

/** 뜻 요약 + 문제 속 쓰임 — 플래시카드 뒷면, 퀴즈 해설 */
export function WordBrief({ w, contextLimit = 2, highlightSense }: { w: Word; contextLimit?: number; highlightSense?: string }) {
  const contexts = contextsOf(w, contextLimit);
  return (
    <View style={{ gap: 16 }}>
      <View>
        <T v="title2" color="primaryText" style={{ lineHeight: 29 }}>
          {w.short}
        </T>
        {w.senses.length <= 1 && w.meaning !== w.short && (
          <T v="subhead" color="text2" style={{ marginTop: 4, lineHeight: 21 }}>
            {w.meaning}
          </T>
        )}
      </View>
      {w.senses.length > 1 && <SenseList w={w} highlight={highlightSense} />}
      {contexts.length > 0 && (
        <View>
          <SectionLabel>문제 속 쓰임</SectionLabel>
          <View style={{ gap: 10 }}>
            {contexts.map((ctx, i) => (
              <ContextCard key={i} c={ctx} index={i} showSense={w.contexts.length > 0} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  speak: { alignItems: 'center', justifyContent: 'center', borderRadius: 99 },
  ctx: { borderRadius: 16, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 12 },
  senseRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' },
});

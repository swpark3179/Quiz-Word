/** 모션 조각 — 진척 링, count-up 숫자, 막대그래프, 토스트 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { create } from 'zustand';
import { motion, type, useTheme } from '@/theme';
import { Icon } from './ui';

const ACircle = Animated.createAnimatedComponent(Circle);

/** 진척 링 — stroke 0 → % (기본 800ms) */
export function ProgressRing({
  pct,
  size = 74,
  stroke = 9,
  color,
  duration = 800,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  duration?: number;
  children?: React.ReactNode;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = reduced ? pct : withTiming(Math.max(0, Math.min(1, pct)), { duration, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
  }, [pct, duration, reduced, k]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - k.value) }));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.separator} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${C} ${C}`}
          animatedProps={props}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

/** 0 → N 으로 올라가는 숫자 (ease-out cubic). 값이 바뀌면 0 이 아니라 지금 보이는 값에서 이어서 센다 */
export function CountUp({ to, duration = 600, style, suffix = '' }: { to: number; duration?: number; style?: StyleProp<TextStyle>; suffix?: string }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? to : 0);
  const shown = useRef(n);
  useEffect(() => {
    const from = shown.current;
    if (reduced || from === to) {
      shown.current = to;
      setN(to);
      return;
    }
    let raf = 0;
    const t0 = Date.now();
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      shown.current = v;
      setN(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduced]);
  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {n.toLocaleString()}
      {suffix}
    </Text>
  );
}

/** 아래에서 자라는 막대 하나 (spring, 순서대로 지연) */
export function GrowBar({ height, index, color, dim }: { height: number; index: number; color: string; dim?: boolean }) {
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withDelay(index * 40, withSpring(1, motion.gentle));
  }, [height, index, k]);
  const a = useAnimatedStyle(() => ({ height: Math.max(3, height) * k.value }));
  return <Animated.View style={[{ width: '100%', maxWidth: 26, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: color, opacity: dim ? 0.45 : 1 }, a]} />;
}

/* ───── 토스트 ───── */
interface ToastState {
  msg: string | null;
  id: number;
  show: (msg: string) => void;
}
export const useToast = create<ToastState>((set, get) => ({
  msg: null,
  id: 0,
  show: (msg) => {
    const id = get().id + 1;
    set({ msg, id });
    setTimeout(() => {
      if (get().id === id) set({ msg: null });
    }, 1600);
  },
}));

export function ToastHost() {
  const { msg, id } = useToast();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', paddingTop: insets.top + 8, zIndex: 100 }]}>
      <Animated.View
        key={id}
        entering={FadeInUp.springify().damping(16)}
        exiting={FadeOutUp.duration(180)}
        style={[styles.toast, { backgroundColor: dark ? c.surface3 : '#1C1E2B' }]}
      >
        <Icon name="checkmark.circle.fill" size={17} color={c.success} />
        <Text style={[type.subhead, { color: '#FFFFFF', fontWeight: '600' }]}>{msg}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 99,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
});

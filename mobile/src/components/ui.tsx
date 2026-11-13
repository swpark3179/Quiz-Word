/** 공용 UI 기본 조각 */
import type { SFSymbol } from 'expo-symbols';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STATUS_LABEL, type WordStatus } from '@shared/srs';
import { elevation, motion, posColor, radius, type, useTheme, type Colors, type TypeVariant } from '@/theme';
import { haptic } from '@/theme/haptics';
import { Icon } from './Icon';

/* ───── 텍스트 ───── */
export function T({
  v = 'body',
  color = 'text',
  style,
  ...rest
}: TextProps & { v?: TypeVariant; color?: keyof Colors; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return <Text {...rest} style={[type[v], { color: c[color] }, style]} />;
}

/* ───── 누르면 살짝 작아지는 버튼 (scale 0.97, snappy spring) ───── */
const APressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  hapticOnPress = false,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; hapticOnPress?: boolean; children?: ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        s.value = withSpring(scaleTo, motion.snappy);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, motion.snappy);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOnPress) void haptic.select();
        onPress?.(e);
      }}
      style={[style, a]}
    >
      {children}
    </APressable>
  );
}

/* ───── 아이콘 (iOS: SF Symbols · 안드로이드: Icon.android.tsx) ───── */
export { Icon };

/* ───── 헤더(내비게이션 바) 아이콘 버튼 ───── */
/**
 * iOS 26 은 headerRight 에 넣은 뷰를 유리 동그라미 안의 36pt 높이 칸에 넣고, 폭도 36pt 보다 좁으면 36pt 로 늘린다.
 * 그런데 뷰 안의 내용은 크기가 바뀌어도 원래 자리(왼쪽 위 기준)에 그대로 있다 (react-native-screens 4.16).
 * - 내용이 36pt 보다 작으면(예: 21pt 아이콘만) 늘어난 칸의 왼쪽 위에 붙는다
 * - 36pt 보다 크면(예전 44pt) 넘친 만큼 아래로 내려가 아이콘이 동그라미 아래쪽에 놓인다
 * 그래서 버튼을 그 칸과 똑같은 36pt 정사각형으로 만들고 한가운데에 아이콘을 둔다 — iOS 가 늘리거나 줄일 것이 없다.
 * 안드로이드 헤더에는 이런 칸이 없어 터치 영역으로 넉넉한 44pt 를 쓴다.
 */
export const HEADER_BUTTON_SIZE = Platform.OS === 'ios' ? 36 : 44;

export function HeaderIconButton({
  icon,
  label,
  onPress,
  size = 21,
  children,
}: {
  /** children 을 주지 않으면 이 아이콘을 그린다 */
  icon?: SFSymbol;
  label: string;
  onPress?: () => void;
  size?: number;
  children?: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} scaleTo={0.9} style={styles.headerBtn}>
      {children ?? (icon ? <Icon name={icon} size={size} color={c.primary} /> : null)}
    </PressableScale>
  );
}

/* ───── 카드 ───── */
export function Card({ children, style, level = 1 }: { children: ReactNode; style?: StyleProp<ViewStyle>; level?: 1 | 2 }) {
  const { c, dark } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: radius.card, borderCurve: 'continuous' }, elevation(c, dark, level), style]}>{children}</View>;
}

/* ───── 버튼 ───── */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'tinted';

export function Button({
  title,
  icon,
  variant = 'secondary',
  onPress,
  disabled,
  style,
  big = false,
  right,
}: {
  title: string;
  icon?: SFSymbol;
  variant?: BtnVariant;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
  right?: ReactNode;
}) {
  const { c } = useTheme();
  const bg: Record<BtnVariant, string> = {
    primary: c.primary,
    secondary: c.surface,
    ghost: 'transparent',
    success: c.successSoft,
    danger: c.dangerSoft,
    tinted: c.primarySoft,
  };
  const fg: Record<BtnVariant, string> = {
    primary: c.onPrimary,
    secondary: c.text,
    ghost: c.primary,
    success: c.success,
    danger: c.danger,
    tinted: c.primaryText,
  };
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[
        styles.btn,
        { backgroundColor: bg[variant], height: big ? 56 : 46, borderRadius: big ? 16 : radius.button, opacity: disabled ? 0.4 : 1 },
        variant === 'secondary' && { borderWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={big ? 19 : 17} color={fg[variant]} />}
      <Text style={[type.headline, { color: fg[variant], fontSize: big ? 17 : 16 }]}>{title}</Text>
      {right}
    </PressableScale>
  );
}

/* ───── 배지·칩 ───── */
export function PosBadge({ pos, small = false }: { pos: string; small?: boolean }) {
  const { dark } = useTheme();
  const { bg, fg } = posColor(pos, dark);
  return (
    <View style={{ backgroundColor: bg, borderRadius: 7, paddingHorizontal: small ? 6 : 8, paddingVertical: small ? 1.5 : 3 }}>
      <Text style={{ color: fg, fontSize: small ? 10.5 : 12, fontWeight: '700' }}>{pos}</Text>
    </View>
  );
}

export function StatusDot({ status }: { status: WordStatus }) {
  const { c } = useTheme();
  const color = status === 'mastered' ? c.success : status === 'learning' ? c.warning : c.separator;
  return <View accessibilityLabel={STATUS_LABEL[status]} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

export function StatusBadge({ status }: { status: WordStatus }) {
  const { c } = useTheme();
  const map = {
    new: [c.surface3, c.muted],
    learning: [c.warningSoft, c.warning],
    mastered: [c.successSoft, c.success],
  } as const;
  const [bg, fg] = map[status];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const k = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    k.value = withSpring(active ? 1 : 0, motion.snappy);
  }, [active, k]);
  return (
    <PressableScale
      onPress={onPress}
      hapticOnPress
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, { backgroundColor: active ? c.primarySoft : c.surface, borderColor: active ? c.primary : c.separator }]}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: active ? c.primaryText : c.text2 }}>{label}</Text>
    </PressableScale>
  );
}

/* ───── 세그먼트 ───── */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { c, dark } = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: dark ? c.surface2 : c.surface3 }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!on) void haptic.select();
              onChange(o.value);
            }}
            style={[styles.segItem, on && [{ backgroundColor: dark ? c.surface3 : c.surface }, elevation(c, dark)]]}
          >
            <Text style={{ fontSize: 13.5, fontWeight: on ? '700' : '500', color: on ? c.text : c.text2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ───── 구역 제목 ───── */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <T v="footnote" color="muted" style={{ fontWeight: '700', letterSpacing: 0.3 }}>
        {children}
      </T>
      {right}
    </View>
  );
}

/* ───── 진행 막대 (spring) ───── */
export function ProgressBar({ value, max, style }: { value: number; max: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withSpring(max > 0 ? Math.min(1, value / max) : 0, motion.gentle);
  }, [value, max, k]);
  const a = useAnimatedStyle(() => ({ width: `${k.value * 100}%` }));
  return (
    <View style={[{ height: 6, borderRadius: 3, backgroundColor: c.separator, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height: '100%', borderRadius: 3, backgroundColor: c.primary }, a]} />
    </View>
  );
}

/* ───── 전체 화면 모달의 안전 영역 ───── */
/**
 * 세션(플래시카드·객관식·복습)처럼 fullScreenModal 로 띄우는 화면의 바깥 틀.
 *
 * react-native-safe-area-context 의 <SafeAreaView> 는 네이티브 모달 안에서 루트 SafeAreaProvider 를 찾지 못해
 * 자기 뷰의 여백을 직접 재는데, 모달이 아래에서 올라오는 도중(아직 화면 밖)에 잰 0 이 그대로 굳는다 (New Architecture).
 * 그러면 닫기 버튼이 상태 표시줄(시계·카메라) 자리에 붙어 누를 수 없다.
 * 그래서 루트 Provider 가 아는 기기 화면의 여백을 패딩으로 직접 준다 — fullScreenModal 은 화면 전체를 덮으므로
 * 이 값이 곧 모달의 여백이다 (react-navigation 의 native-stack 도 fullScreenModal 헤더에 같은 값을 쓴다).
 */
export function ScreenSafeArea({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return <View style={[{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }, style]}>{children}</View>;
}

/* ───── 빈 화면 ───── */
export function Empty({ icon, title, desc, action }: { icon: SFSymbol; title: string; desc?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.primarySoft }]}>
        <Icon name={icon} size={24} color={c.primary} />
      </View>
      <T v="headline">{title}</T>
      {desc && (
        <T v="subhead" color="muted" style={{ textAlign: 'center', marginTop: 4 }}>
          {desc}
        </T>
      )}
      {action && <View style={{ marginTop: 18 }}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  headerBtn: { width: HEADER_BUTTON_SIZE, height: HEADER_BUTTON_SIZE, alignItems: 'center', justifyContent: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  seg: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 8 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
});

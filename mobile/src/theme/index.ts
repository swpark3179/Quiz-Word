import { Platform, useColorScheme, type ViewStyle } from 'react-native';
import { Easing, ReduceMotion } from 'react-native-reanimated';
import { palette, type Colors } from './tokens';

export * from './tokens';

export function useTheme(): { c: Colors; dark: boolean } {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { c: dark ? palette.dark : palette.light, dark };
}

/** 카드 그림자 — 라이트는 은은한 그림자, 다크는 1px 테두리 */
export function elevation(c: Colors, dark: boolean, level: 1 | 2 = 1): ViewStyle {
  if (dark) return { borderWidth: 1, borderColor: c.separator };
  return Platform.select({
    ios: {
      shadowColor: '#101828',
      shadowOpacity: level === 1 ? 0.07 : 0.12,
      shadowRadius: level === 1 ? 14 : 24,
      shadowOffset: { width: 0, height: level === 1 ? 6 : 12 },
    },
    default: { elevation: level * 3 },
  }) as ViewStyle;
}

/** 모션 곡선 (설계 문서의 snappy / gentle / standard) */
export const motion = {
  snappy: { damping: 22, stiffness: 320, mass: 1, reduceMotion: ReduceMotion.System },
  gentle: { damping: 18, stiffness: 180, mass: 0.9, reduceMotion: ReduceMotion.System },
  bouncy: { damping: 12, stiffness: 260, mass: 0.8, reduceMotion: ReduceMotion.System },
  standard: { duration: 220, easing: Easing.bezier(0.2, 0.8, 0.2, 1), reduceMotion: ReduceMotion.System },
  flip: { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1), reduceMotion: ReduceMotion.System },
};

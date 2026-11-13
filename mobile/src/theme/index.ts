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

/**
 * 큰 제목 + 반투명 블러 헤더 (iOS). 안드로이드에는 large title·블러가 없고, 투명 헤더를 그대로 두면
 * 화면 내용이 헤더 밑에 깔리므로(내용을 자동으로 밀어 주는 contentInsetAdjustmentBehavior 가 iOS 전용) 배경색을 칠한 보통 헤더를 쓴다.
 */
export function largeHeader(c: Colors, dark: boolean) {
  if (Platform.OS === 'android') return { headerStyle: { backgroundColor: c.bg }, headerTitleStyle: { color: c.text } } as const;
  return {
    headerLargeTitle: true,
    headerTransparent: true,
    headerBlurEffect: dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
  } as const;
}

/**
 * 아래에서 올라오는 시트 (범위 고르기 · 학습장 합치기). iOS 는 formSheet.
 * 안드로이드의 formSheet 는 flex: 1 내용과 안쪽 스크롤이 제대로 놓이지 않아, 아래에서 올라오는 보통 화면으로 띄운다
 * (화면 쪽에서 상태 표시줄만큼 위를 띄운다 — SHEET_IS_SCREEN).
 *
 * iOS formSheet 의 내용 감싸개는 위·좌우에만 붙고 바닥은 비어 있어(react-native-screens 4.16) 높이가 내용을 따라간다.
 * 그러면 화면 루트의 flex: 1 이 시트 높이를 채우지 못하고, 아래 고정 버튼(position: absolute, bottom: 0)이
 * 시트 바닥이 아니라 스크롤 내용 끝에 놓여 시트 밖으로 잘린다 — 감싸개를 바닥에도 붙여(bottom: 0) 지금 시트 높이를 채운다.
 */
export const SHEET_IS_SCREEN = Platform.OS === 'android';

export function sheetOptions(c: Colors, detents: number[]) {
  if (SHEET_IS_SCREEN) return { presentation: 'modal', headerShown: false, contentStyle: { backgroundColor: c.bg } } as const;
  return { presentation: 'formSheet', headerShown: false, sheetAllowedDetents: detents, sheetGrabberVisible: true, sheetCornerRadius: 28, contentStyle: { backgroundColor: c.bg, bottom: 0 } } as const;
}

/** 시트 아래 고정 버튼 줄의 바닥 여백 — 홈 인디케이터(insets.bottom) 위로 한 번 더 띄워 버튼이 시트 바닥·모서리에 붙지 않게 */
export const sheetFooterPad = (bottomInset: number) => bottomInset + 20;

/** 고정폭 글꼴 (코드 표시) — 안드로이드에는 Menlo 가 없다 */
export const MONO_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** 모션 곡선 (설계 문서의 snappy / gentle / standard) */
export const motion = {
  snappy: { damping: 22, stiffness: 320, mass: 1, reduceMotion: ReduceMotion.System },
  gentle: { damping: 18, stiffness: 180, mass: 0.9, reduceMotion: ReduceMotion.System },
  bouncy: { damping: 12, stiffness: 260, mass: 0.8, reduceMotion: ReduceMotion.System },
  standard: { duration: 220, easing: Easing.bezier(0.2, 0.8, 0.2, 1), reduceMotion: ReduceMotion.System },
  flip: { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1), reduceMotion: ReduceMotion.System },
};

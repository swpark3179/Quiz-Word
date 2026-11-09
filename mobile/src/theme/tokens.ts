/** 디자인 토큰 — 웹 단어장의 인디고 브랜드를 iOS 시스템 바탕 위에 얹는다 */
import type { TextStyle } from 'react-native';

export const palette = {
  light: {
    bg: '#F2F3F8',
    surface: '#FFFFFF',
    surface2: '#F6F7FB',
    surface3: '#ECEEF5',
    separator: '#E3E6EF',
    text: '#161A2B',
    text2: '#4A5068',
    muted: '#8A90A6',
    primary: '#4F46E5',
    primary2: '#7C3AED',
    primarySoft: '#EEF0FF',
    primaryText: '#3730A3',
    onPrimary: '#FFFFFF',
    success: '#059669',
    successSoft: '#E3F6EE',
    danger: '#E11D48',
    dangerSoft: '#FDECF0',
    warning: '#B45309',
    warningSoft: '#FDF0DA',
    marker: '#FFEB85',
    markerText: '#3D3000',
    shadow: 'rgba(16,24,40,0.10)',
  },
  dark: {
    bg: '#000000',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    surface3: '#3A3A3C',
    separator: '#2E2F36',
    text: '#ECEEF6',
    text2: '#B4B9CC',
    muted: '#7D8399',
    primary: '#818CF8',
    primary2: '#A78BFA',
    primarySoft: '#1F2245',
    primaryText: '#C7CEFF',
    onPrimary: '#0E1018',
    success: '#34D399',
    successSoft: '#0F2A20',
    danger: '#FB7185',
    dangerSoft: '#34151E',
    warning: '#FBBF24',
    warningSoft: '#2E2410',
    marker: '#5A4A08',
    markerText: '#FFF3B0',
    shadow: 'rgba(0,0,0,0)',
  },
};

export type Colors = typeof palette.light;

/** 품사별 배지 색 (웹과 같은 계열) */
const POS = {
  light: {
    명사: ['#E0F2FE', '#075985'],
    동사: ['#D1FAE5', '#065F46'],
    형용사: ['#FEF3C7', '#92400E'],
    부사: ['#EDE9FE', '#5B21B6'],
    구: ['#CCFBF1', '#115E59'],
    기타: ['#ECEEF5', '#4A5068'],
  },
  dark: {
    명사: ['#0C2A3D', '#7DD3FC'],
    동사: ['#082E22', '#6EE7B7'],
    형용사: ['#33240A', '#FCD34D'],
    부사: ['#241A45', '#C4B5FD'],
    구: ['#06302C', '#5EEAD4'],
    기타: ['#2C2C2E', '#B4B9CC'],
  },
} as const;

export function posColor(pos: string, dark: boolean): { bg: string; fg: string } {
  const table = dark ? POS.dark : POS.light;
  const key = pos in table ? (pos as keyof typeof table) : pos.endsWith('구') ? '구' : '기타';
  const [bg, fg] = table[key];
  return { bg, fg };
}

export const radius = { card: 22, button: 14, field: 12, chip: 999, sm: 9 };

/** 4pt 그리드 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

/** iOS 텍스트 스타일 (시스템 폰트: SF Pro + Apple SD Gothic Neo) */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: -0.4 },
  title1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  title2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
  title3: { fontSize: 20, fontWeight: '600' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  callout: { fontSize: 16, fontWeight: '400' },
  subhead: { fontSize: 15, fontWeight: '400' },
  footnote: { fontSize: 13, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
  cardWord: { fontSize: 48, fontWeight: '800', letterSpacing: -0.8 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

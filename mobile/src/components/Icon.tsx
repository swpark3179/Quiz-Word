/** 아이콘 — iOS 는 SF Symbols. 안드로이드는 Icon.android.tsx (같은 이름을 Material 아이콘으로 바꿔 그린다) */
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useTheme } from '@/theme';

export function Icon({ name, size = 20, color, weight = 'semibold' }: { name: SFSymbol; size?: number; color?: string; weight?: 'regular' | 'medium' | 'semibold' | 'bold' }) {
  const { c } = useTheme();
  return <SymbolView name={name} size={size} tintColor={color ?? c.text} weight={weight} style={{ width: size, height: size }} />;
}

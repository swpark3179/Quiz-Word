/** 탭 안의 스택 — large title + 반투명 헤더 공통 설정 */
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { useTheme } from '@/theme';

export function TabStack({ title, headerRight }: { title: string; headerRight?: () => ReactNode }) {
  const { c, dark } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerTintColor: c.primary,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title, headerRight }} />
    </Stack>
  );
}

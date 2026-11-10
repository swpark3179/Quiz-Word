import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import { ToastHost } from '@/components/motion';
import { prepareAudio } from '@/lib/tts';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';

// 보이지 않는 탭·화면은 다시 그리지 않는다 — 학습 중 판정마다 뒤에 있는 단어장·오답노트 등이 재렌더되던 것을 막는다
enableFreeze(true);

export default function RootLayout() {
  const theme = useProgress((s) => s.settings.theme);
  const { c, dark } = useTheme();

  // 설정의 테마를 앱 전체(내비게이션 바·탭·시트 포함)에 적용
  useEffect(() => {
    // 웹 미리보기에는 setColorScheme 이 없다
    if (typeof Appearance.setColorScheme === 'function') Appearance.setColorScheme(theme === 'system' ? null : theme);
  }, [theme]);

  useEffect(() => {
    void prepareAudio();
  }, []);

  const navTheme = dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: c.primary, background: c.bg, card: c.surface, text: c.text, border: c.separator } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: c.primary, background: c.bg, card: c.surface, text: c.text, border: c.separator } };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerTintColor: c.primary, headerBackTitle: '뒤로', contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="word/[id]"
            options={{ title: '', headerLargeTitle: true, headerTransparent: true, headerBlurEffect: dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight', headerShadowVisible: false }}
          />
          <Stack.Screen name="settings" options={{ title: '설정', headerLargeTitle: true, headerTransparent: true, headerBlurEffect: dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight' }} />
          <Stack.Screen
            name="scope"
            options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.78, 1], sheetGrabberVisible: true, sheetCornerRadius: 28, contentStyle: { backgroundColor: c.bg } }}
          />
          <Stack.Screen name="session/flash" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="session/quiz" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="session/review" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
        </Stack>
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

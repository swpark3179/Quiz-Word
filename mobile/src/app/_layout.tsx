import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import { DialogHost } from '@/components/DialogHost';
import { ToastHost } from '@/components/motion';
import { afterFrame } from '@/lib/afterFrame';
import { exportLexicon } from '@/lib/sharedLexicon';
import { prepareAudio } from '@/lib/tts';
import { useProgress } from '@/store/progress';
import { largeHeader, sheetOptions, useTheme } from '@/theme';

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
    // 문제은행이 읽을 단어 목록 — 첫 화면을 그린 뒤에 (세트가 그대로면 아무것도 안 한다)
    afterFrame(exportLexicon);
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
            options={{ title: '', ...largeHeader(c, dark), headerShadowVisible: false }}
          />
          <Stack.Screen name="settings" options={{ title: '설정', ...largeHeader(c, dark) }} />
          <Stack.Screen name="scope" options={sheetOptions(c, [0.78, 1])} />
          {/* 이름 입력칸이 있어 키보드가 올라오므로 처음부터 크게 띄운다 */}
          <Stack.Screen name="notebook-merge" options={sheetOptions(c, [1])} />
          <Stack.Screen name="session/flash" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="session/quiz" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="session/review" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
        </Stack>
        <ToastHost />
        <DialogHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

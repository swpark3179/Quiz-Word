import { Tabs } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { Icon } from '@/components/ui';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';

/** 탭 이름 · 제목 · 아이콘 (iOS 의 _layout.tsx 와 같은 순서·이름) */
const TABS: { name: string; title: string; icon: SFSymbol; selected: SFSymbol }[] = [
  { name: 'today', title: '오늘', icon: 'house', selected: 'house.fill' },
  { name: 'words', title: '단어장', icon: 'book.closed', selected: 'book.closed.fill' },
  { name: 'study', title: '학습', icon: 'rectangle.stack', selected: 'rectangle.stack.fill' },
  { name: 'notebooks', title: '학습장', icon: 'books.vertical', selected: 'books.vertical.fill' },
  { name: 'wrong', title: '오답노트', icon: 'bookmark', selected: 'bookmark.fill' },
];

/** 안드로이드 탭 — iOS 는 네이티브 탭(_layout.tsx)을 쓰고, 여기서는 SF Symbols 없이 그릴 수 있는 기본 아래 탭을 쓴다 */
export default function TabsLayout() {
  const { c } = useTheme();
  const wrongN = useProgress((s) => Object.keys(s.wrong).length);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.separator },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarBadgeStyle: { backgroundColor: c.danger, color: '#FFFFFF', fontSize: 11 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) => <Icon name={focused ? t.selected : t.icon} size={22} color={color} />,
            tabBarBadge: t.name === 'wrong' && wrongN > 0 ? wrongN : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}

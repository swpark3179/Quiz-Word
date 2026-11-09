import { Badge, Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';

/** 네이티브 탭 (iOS 26 에서는 Liquid Glass 탭 바) */
export default function TabsLayout() {
  const { c } = useTheme();
  const wrongN = useProgress((s) => Object.keys(s.wrong).length);
  return (
    <NativeTabs tintColor={c.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="today">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>오늘</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="words">
        <Icon sf={{ default: 'book.closed', selected: 'book.closed.fill' }} />
        <Label>단어장</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="study">
        <Icon sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }} />
        <Label>학습</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wrong">
        <Icon sf={{ default: 'bookmark', selected: 'bookmark.fill' }} />
        <Label>오답노트</Label>
        {wrongN > 0 && <Badge>{String(wrongN)}</Badge>}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

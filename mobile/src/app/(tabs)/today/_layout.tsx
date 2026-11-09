import { router } from 'expo-router';
import { Icon, PressableScale } from '@/components/ui';
import { TabStack } from '@/components/TabStack';
import { useTheme } from '@/theme';

function SettingsButton() {
  const { c } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel="설정" hitSlop={10} onPress={() => router.push('/settings')}>
      <Icon name="gearshape" size={21} color={c.primary} />
    </PressableScale>
  );
}

export default function TodayLayout() {
  return <TabStack title="오늘" headerRight={() => <SettingsButton />} />;
}

import { router } from 'expo-router';
import { HeaderIconButton } from '@/components/ui';
import { TabStack } from '@/components/TabStack';

function SettingsButton() {
  return <HeaderIconButton icon="gearshape" label="설정" onPress={() => router.push('/settings')} />;
}

export default function TodayLayout() {
  return <TabStack title="오늘" headerRight={() => <SettingsButton />} />;
}

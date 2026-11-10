import { Icon, PressableScale } from '@/components/ui';
import { TabStack } from '@/components/TabStack';
import { promptNewNotebook } from '@/lib/notebookActions';
import { useTheme } from '@/theme';

function AddButton() {
  const { c } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel="새 학습장" hitSlop={10} onPress={promptNewNotebook}>
      <Icon name="plus" size={21} color={c.primary} />
    </PressableScale>
  );
}

export default function Layout() {
  return <TabStack title="학습장" headerRight={() => <AddButton />} />;
}

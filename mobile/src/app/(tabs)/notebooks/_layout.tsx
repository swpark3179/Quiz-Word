import { HeaderIconButton } from '@/components/ui';
import { TabStack } from '@/components/TabStack';
import { promptNewNotebook } from '@/lib/notebookActions';

function AddButton() {
  return <HeaderIconButton icon="plus" label="새 학습장" onPress={promptNewNotebook} />;
}

export default function Layout() {
  return <TabStack title="학습장" headerRight={() => <AddButton />} />;
}

/** 학습장 만들기·이름 바꾸기·삭제 — 목록 화면과 학습장 화면이 함께 쓴다 (iOS 기본 입력창·확인창) */
import { router } from 'expo-router';
import { ActionSheetIOS, Alert } from 'react-native';
import { cleanNotebookName, defaultNotebookName, wrongIdsByCount, wrongNotebookName } from '@shared/notebook';
import { useToast } from '@/components/motion';
import { WORD_BY_ID } from '@/data/words';
import { useProgress } from '@/store/progress';
import { haptic } from '@/theme/haptics';

const openNotebook = (id: string) => router.push({ pathname: '/notebooks/[id]', params: { id } });

const findNotebook = (id: string) => useProgress.getState().notebooks.find((n) => n.id === id);

/** 이름을 받아 빈 학습장을 만들고 연다 */
export function promptNewNotebook() {
  const fallback = defaultNotebookName(useProgress.getState().notebooks);
  Alert.prompt(
    '새 학습장',
    '단어장을 검색해 단어를 담을 수 있어요',
    [
      { text: '취소', style: 'cancel' },
      {
        text: '만들기',
        isPreferred: true,
        onPress: (name?: string) => {
          const id = useProgress.getState().createNotebook(cleanNotebookName(name ?? '', fallback));
          void haptic.success();
          openNotebook(id);
        },
      },
    ],
    'plain-text',
    fallback,
  );
}

/** 지금 오답노트를 통째로 복사해 학습장을 만들고 연다 */
export function notebookFromWrong() {
  const { wrong, createNotebook } = useProgress.getState();
  const ids = wrongIdsByCount(wrong, (id) => WORD_BY_ID.has(id));
  if (!ids.length) return;
  const id = createNotebook(wrongNotebookName(), ids);
  void haptic.success();
  useToast.getState().show(`오답노트 ${ids.length}개로 만들었어요`);
  openNotebook(id);
}

export function promptRenameNotebook(id: string) {
  const nb = findNotebook(id);
  if (!nb) return;
  Alert.prompt(
    '이름 바꾸기',
    undefined,
    [
      { text: '취소', style: 'cancel' },
      {
        text: '바꾸기',
        isPreferred: true,
        onPress: (name?: string) => useProgress.getState().renameNotebook(id, cleanNotebookName(name ?? '', nb.name)),
      },
    ],
    'plain-text',
    nb.name,
  );
}

/** 학습장 삭제는 단어 목록을 통째로 지우므로 한 번 묻는다. beforeDelete: 학습장 화면을 먼저 닫을 때 */
export function confirmDeleteNotebook(id: string, beforeDelete?: () => void) {
  const nb = findNotebook(id);
  if (!nb) return;
  Alert.alert(`'${nb.name}' 학습장을 삭제할까요?`, `단어 ${nb.ids.length}개를 담은 목록이 지워집니다. 단어의 학습 기록은 그대로 남아요.`, [
    { text: '취소', style: 'cancel' },
    {
      text: '삭제',
      style: 'destructive',
      onPress: () => {
        void haptic.warning();
        if (beforeDelete) {
          beforeDelete();
          // 닫히는 화면이 "찾을 수 없어요"로 바뀌지 않게, 닫힌 뒤에 지운다
          setTimeout(() => useProgress.getState().deleteNotebook(id), 450);
        } else {
          useProgress.getState().deleteNotebook(id);
        }
      },
    },
  ]);
}

/** 이름 바꾸기 / 삭제 메뉴 */
export function notebookMenu(id: string, beforeDelete?: () => void) {
  const nb = findNotebook(id);
  if (!nb) return;
  ActionSheetIOS.showActionSheetWithOptions(
    { title: nb.name, options: ['이름 바꾸기', '학습장 삭제', '취소'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
    (i) => {
      if (i === 0) promptRenameNotebook(id);
      else if (i === 1) confirmDeleteNotebook(id, beforeDelete);
    },
  );
}

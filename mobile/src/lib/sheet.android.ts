/** 선택 메뉴 · 이름 입력창 · 확인창 (안드로이드) — 앱 안의 대화상자(DialogHost.android.tsx)로 띄운다. 쓰는 법은 sheet.ts 와 같다 */
import { Alert, type AlertButton } from 'react-native';
import { useDialog } from './dialogStore';
import type { PromptOptions, SheetOptions } from './sheet';

export type { PromptOptions, SheetOptions } from './sheet';

export function showActionSheet(options: SheetOptions, onPick: (index: number) => void) {
  useDialog.getState().show({ kind: 'sheet', ...options, onPick });
}

export function promptText({ cancelText = '취소', ...rest }: PromptOptions) {
  useDialog.getState().show({ kind: 'prompt', cancelText, ...rest });
}

/** 안드로이드 기본 확인창은 버튼을 3개까지만 보여 준다 — 넘으면 앱 대화상자로 */
export function alertButtons(title: string, message: string | undefined, buttons: AlertButton[]) {
  if (buttons.length <= 3) Alert.alert(title, message, buttons);
  else useDialog.getState().show({ kind: 'alert', title, message, buttons });
}

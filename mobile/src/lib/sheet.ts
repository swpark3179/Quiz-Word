/**
 * 선택 메뉴 · 이름 입력창 · 버튼 여러 개짜리 확인창 — iOS 는 시스템 것을 그대로 쓴다.
 * 안드로이드에는 이 셋이 없거나(액션 시트, 입력창) 버튼이 3개까지라, sheet.android.ts 가 앱 안의 대화상자(DialogHost)로 띄운다.
 */
import { ActionSheetIOS, Alert, type AlertButton } from 'react-native';

export interface SheetOptions {
  title?: string;
  message?: string;
  options: string[];
  cancelButtonIndex?: number;
  destructiveButtonIndex?: number;
}

/** 아래에서 올라오는 선택 메뉴. onPick 에는 고른 항목의 번호가 온다 (취소하면 cancelButtonIndex) */
export function showActionSheet(options: SheetOptions, onPick: (index: number) => void) {
  ActionSheetIOS.showActionSheetWithOptions(options, onPick);
}

export interface PromptOptions {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  defaultValue?: string;
  onSubmit: (text: string) => void;
}

/** 한 줄 입력창 */
export function promptText({ title, message, confirmText, cancelText = '취소', defaultValue, onSubmit }: PromptOptions) {
  Alert.prompt(
    title,
    message,
    [
      { text: cancelText, style: 'cancel' },
      { text: confirmText, isPreferred: true, onPress: (text?: string) => onSubmit(text ?? '') },
    ],
    'plain-text',
    defaultValue,
  );
}

/** 버튼이 3개를 넘을 수 있는 확인창 */
export function alertButtons(title: string, message: string | undefined, buttons: AlertButton[]) {
  Alert.alert(title, message, buttons);
}

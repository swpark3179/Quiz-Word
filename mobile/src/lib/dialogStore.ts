/** 안드로이드용 앱 대화상자의 상태 — sheet.android.ts 가 띄우고 DialogHost.android.tsx 가 그린다 (iOS 는 쓰지 않는다) */
import type { AlertButton } from 'react-native';
import { create } from 'zustand';
import type { PromptOptions, SheetOptions } from './sheet';

export type Dialog =
  | ({ kind: 'sheet'; onPick: (index: number) => void } & SheetOptions)
  | ({ kind: 'prompt'; cancelText: string } & Omit<PromptOptions, 'cancelText'>)
  | { kind: 'alert'; title: string; message?: string; buttons: AlertButton[] };

export const useDialog = create<{ current: Dialog | null; show: (d: Dialog) => void; close: () => void }>((set) => ({
  current: null,
  show: (d) => set({ current: d }),
  close: () => set({ current: null }),
}));

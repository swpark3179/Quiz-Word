/**
 * 동기 키-값 저장소 — iOS 는 기기 안 SQLite(expo-sqlite kv-store), 웹 미리보기는 localStorage.
 * (expo-sqlite 의 웹 구현은 SharedArrayBuffer 가 필요해 일반 개발 서버에서는 동작하지 않는다)
 */
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

export const syncStorage: StateStorage =
  Platform.OS === 'web'
    ? {
        getItem: (k) => globalThis.localStorage?.getItem(k) ?? null,
        setItem: (k, v) => globalThis.localStorage?.setItem(k, v),
        removeItem: (k) => globalThis.localStorage?.removeItem(k),
      }
    : {
        getItem: (k) => Storage.getItemSync(k),
        setItem: (k, v) => Storage.setItemSync(k, v),
        removeItem: (k) => {
          Storage.removeItemSync(k);
        },
      };

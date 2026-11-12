/**
 * 안드로이드의 뒤로 가기(버튼·제스처)를 가로챈다 — 세션 화면에서 바로 닫히지 않고 "그만할까요?" 확인을 거치게 한다.
 * iOS 에는 뒤로 가기 버튼이 없어 아무 일도 하지 않는다 (세션 화면은 닫는 제스처도 꺼 둔다).
 */
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

export function useBackClose(onBack: () => void) {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      latest.current();
      return true;
    });
    return () => sub.remove();
  }, []);
}

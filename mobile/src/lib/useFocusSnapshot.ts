/**
 * 화면이 가려져 있는 동안에는 값이 바뀌어도 마지막으로 보던 값을 그대로 돌려준다.
 * 학습 세션(전체 화면)을 띄운 탭은 뒤에 그대로 살아 있어서, 판정할 때마다 진행 기록이 바뀌면
 * 복습 계획·진척을 다시 계산하고 숫자 애니메이션을 다시 돌린다 — 그 일을 세션이 끝나 돌아올 때 한 번만 하게 한다.
 */
import { useIsFocused } from '@react-navigation/native';
import { useRef } from 'react';

export function useFocusSnapshot<T>(value: T): T {
  const focused = useIsFocused();
  const last = useRef(value);
  if (focused) last.current = value;
  return last.current;
}

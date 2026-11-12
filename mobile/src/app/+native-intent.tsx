/**
 * 다른 앱이 연 주소 다듬기 (iOS·Android, 웹에서는 쓰이지 않는다).
 * `quizword://lookup?word=…&x-error=…` (문제은행 등에서 단어 상세 열기) → 단어장 탭 `/words?lookup=…` 으로 보내고,
 * 그 화면이 검색·상세·결과 없음 콜백을 처리한다 (src/app/(tabs)/words/index.tsx).
 * 이 함수는 앱의 React 트리 밖에서 불리므로 무거운 일을 하지 않고 주소만 바꾼다. 여기서 던지면 앱이 죽으므로 모두 잡는다.
 */
import { lookupHref, parseLookupUrl } from '@shared/wordLookup';

let seq = 0;

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  try {
    const req = parseLookupUrl(path);
    if (!req) return path;
    // 같은 단어를 다시 찾아도 단어장 화면이 한 번 더 처리하도록 매번 다른 표시를 붙인다
    return lookupHref(req, `${Date.now().toString(36)}${(seq++).toString(36)}`);
  } catch {
    return initial ? '/' : path;
  }
}

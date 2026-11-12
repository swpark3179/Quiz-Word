/**
 * 단어 목록을 다른 앱(문제은행)과 나누기 — 앱이 켜질 때 한 번, 단어 세트가 바뀌었으면 공유 위치에 lexicon.json 을 쓴다.
 *
 * - iOS: App Group(SHARED_APP_GROUP) 공유 폴더의 quiz-word/lexicon.json — 같은 그룹에 든 문제은행이 읽는다.
 *   그룹 entitlement 가 없는 빌드(Expo Go 등)에서는 폴더가 없어 아무것도 하지 않는다.
 * - Android: 앱 문서 폴더의 shared/lexicon.json — 로컬 모듈 modules/lexicon-provider 의 ContentProvider 가
 *   content://<패키지>.lexicon/lexicon.json 으로 읽기 전용으로 내보낸다.
 * - 웹 미리보기: 하지 않는다.
 * 단어 세트·시험 팩을 바꾸면 앱이 다시 시작되므로, 켤 때 한 번 확인하면 늘 최신이다.
 * 부가 기능이라 모든 오류는 무시한다 (단어장 앱 자체에는 영향이 없다).
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { buildLexicon, LEXICON_FILE, lexiconSig } from '@shared/lexicon';
import { WORD_SET_INFO, WORDS } from '@/data/words';
import { syncStorage } from '@/lib/kv';

/** 문제은행과 함께 쓰는 App Group (app.config.ts 의 ios.entitlements 와 같아야 한다) */
export const SHARED_APP_GROUP = 'group.com.swpark3179.shared';
/** iOS 공유 폴더 안의 하위 폴더 */
const IOS_DIR = 'quiz-word';
/** Android 문서 폴더 안의 하위 폴더 (LexiconProvider.kt 와 같아야 한다) */
const ANDROID_DIR = 'shared';
/** 마지막으로 내보낸 sig — 같으면 다시 쓰지 않는다 */
const SIG_KEY = 'quiz-word:lexicon-sig';

/** 공유 폴더 (없으면 null) */
function sharedDir(): Directory | null {
  if (Platform.OS === 'ios') {
    const group = Paths.appleSharedContainers?.[SHARED_APP_GROUP];
    return group ? new Directory(group, IOS_DIR) : null;
  }
  if (Platform.OS === 'android') return new Directory(Paths.document, ANDROID_DIR);
  return null;
}

export function exportLexicon(): void {
  try {
    const dir = sharedDir();
    if (!dir) return;
    const sig = lexiconSig(WORD_SET_INFO, WORDS.length);
    const target = new File(dir, LEXICON_FILE);
    if (target.exists && syncStorage.getItem(SIG_KEY) === sig) return;
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    // 임시 파일에 쓰고 바꿔치기 — 다른 앱이 반쯤 쓴 파일을 읽지 않게
    const tmp = new File(dir, `${LEXICON_FILE}.tmp`);
    if (tmp.exists) tmp.delete();
    tmp.write(JSON.stringify(buildLexicon(WORDS, sig)));
    if (target.exists) target.delete();
    tmp.move(target);
    void syncStorage.setItem(SIG_KEY, sig);
  } catch (e) {
    if (__DEV__) console.warn('단어 목록 내보내기 실패', e);
  }
}

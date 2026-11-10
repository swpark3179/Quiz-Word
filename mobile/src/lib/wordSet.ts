/**
 * 단어 세트 — 앱에 내장된 단어(앱 기본) 또는 설정에서 불러온 단어 세트 파일.
 * 불러온 파일은 기기 안 문서 폴더(wordset.json)에 두고, 앱이 켜질 때 동기로 읽어 단어 목록을 만든다.
 * 그래서 단어 목록(WORDS 등)은 지금처럼 모듈 상수이고, 세트를 바꾸면 앱을 다시 시작해 적용한다.
 * (OTA 없이 단어를 갱신하는 방법 — 웹 설정의 "단어 세트 파일 내려받기" 또는 npm run data:pack 으로 만든 파일)
 */
import { File, Paths } from 'expo-file-system';
import * as Updates from 'expo-updates';
import { DevSettings, Platform } from 'react-native';
import { BUNDLED_BUILT_AT, loadBundledCorpus, loadBundledSources, loadBundledWords } from '@/generated/wordFiles';
import type { CorpusSentence } from '@shared/corpus';
import type { RawWord } from '@shared/normalize';
import type { SourceInfo } from '@shared/schema';
import { parseWordSet, type WordSetFile } from '@shared/wordset';
import { useProgress } from '@/store/progress';

export interface WordSetInfo {
  /** imported: 불러온 파일 / bundled: 앱에 내장된 단어 */
  origin: 'imported' | 'bundled';
  /** 이 세트를 만든 시각 (ISO) */
  builtAt: string;
  /** 앱에 내장된 단어의 시각 — 불러온 세트보다 새로우면 설정에서 알려 준다 */
  bundledBuiltAt: string;
  /** 불러온 파일을 읽지 못해 앱 기본 단어로 열었을 때의 이유 */
  error?: string;
}

export interface ActiveWordSet {
  words: RawWord[];
  corpus: CorpusSentence[];
  sources: SourceInfo[];
  info: WordSetInfo;
}

const FILE_NAME = 'wordset.json';
const TMP_NAME = 'wordset.tmp.json';

/** 기기 파일을 쓸 수 있는지 (웹 미리보기는 expo-file-system 이 없다) */
export const canImportWordSet = Platform.OS !== 'web';

/** 앱이 켜질 때 한 번 — 불러온 세트가 있으면 그것을, 없거나 읽지 못하면 앱 기본 단어를 쓴다 */
export function loadActiveWordSet(): ActiveWordSet {
  let error: string | undefined;
  if (canImportWordSet) {
    try {
      const file = new File(Paths.document, FILE_NAME);
      if (file.exists) {
        const set = parseWordSet(JSON.parse(file.textSync()));
        return {
          words: set.words,
          corpus: set.corpus,
          sources: set.sources,
          info: { origin: 'imported', builtAt: set.builtAt, bundledBuiltAt: BUNDLED_BUILT_AT },
        };
      }
    } catch (e) {
      error = (e as Error).message || '파일을 읽지 못했어요';
    }
  }
  return {
    words: loadBundledWords(),
    corpus: loadBundledCorpus(),
    sources: loadBundledSources(),
    info: { origin: 'bundled', builtAt: BUNDLED_BUILT_AT, bundledBuiltAt: BUNDLED_BUILT_AT, ...(error ? { error } : {}) },
  };
}

/** 고른 파일을 읽고 검사한다 (아직 바꾸지 않음) */
export async function readWordSetFile(uri: string): Promise<WordSetFile> {
  let data: unknown;
  try {
    data = JSON.parse(await new File(uri).text());
  } catch {
    throw new Error('JSON 파일이 아니거나 손상된 파일이에요.');
  }
  return parseWordSet(data);
}

/** 검사한 세트를 기기에 저장한다 — 임시 파일에 다 쓴 뒤 바꿔 넣어, 중간에 실패해도 이전 세트가 남는다 */
export function installWordSet(set: WordSetFile): void {
  const tmp = new File(Paths.document, TMP_NAME);
  tmp.create({ overwrite: true });
  tmp.write(JSON.stringify(set));
  const target = new File(Paths.document, FILE_NAME);
  if (target.exists) target.delete();
  tmp.move(target);
}

/** 불러온 세트를 지우고 앱 기본 단어로 돌아간다 (다시 시작해야 적용) */
export function removeImportedWordSet(): void {
  const target = new File(Paths.document, FILE_NAME);
  if (target.exists) target.delete();
}

/**
 * 앱을 다시 시작해 새 단어 세트를 적용한다. 다시 시작하지 못하면 false.
 * TestFlight 앱은 expo-updates 로(OTA 를 쓰지 않아도 동작), 개발 중(Expo Go)에는 개발 메뉴의 다시 불러오기로.
 */
export async function restartApp(): Promise<boolean> {
  // 모아 두던 진행 기록 저장을 먼저 끝낸다
  useProgress.flush();
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    // 개발 모드·Expo Go 에서는 expo-updates 가 다시 시작하지 못한다
  }
  if (__DEV__ && typeof DevSettings.reload === 'function') {
    DevSettings.reload();
    return true;
  }
  return false;
}

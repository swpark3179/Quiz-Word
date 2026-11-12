/**
 * 시험 팩 — 시험 하나를 지금 단어 위에 얹는 파일 (*.exampack.json).
 * 불러온 팩은 기기 안 문서 폴더의 exampacks/<시험 id>.json 에 두고, 앱이 켜질 때 기본 단어(내장 또는 불러온 단어 세트) 위에 차례로 얹는다.
 * 그래서 새 빌드로 앱 기본 단어가 바뀌거나 단어 세트를 통째로 바꿔도 추가한 시험은 남고, 시험별로 지울 수 있다.
 * 형식·만드는 법: EXAM_PACK_GUIDE_URL
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { isExamPackFile, parseExamPack, type ExamPackFile } from '@shared/exampack';

/** 시험 팩 안내 첫 화면 (사람이 읽는 쪽) — 에이전트에게 줄 지시문 예시, 파일 목록, 브라우저에서 돌리는 검증기 */
export const EXAM_PACK_SITE_URL = 'https://swpark3179.github.io/Quiz-Word/';
/** 시험 팩 만드는 법 (코딩 에이전트에게 주는 가이드 문서) */
export const EXAM_PACK_GUIDE_URL = `${EXAM_PACK_SITE_URL}exam-pack-guide.md`;

const DIR_NAME = 'exampacks';

/** 기기 파일을 쓸 수 있는지 (웹 미리보기는 expo-file-system 이 없다) */
export const canUseFiles = Platform.OS !== 'web';

const dir = () => new Directory(Paths.document, DIR_NAME);
const fileOf = (examId: string) => new File(Paths.document, DIR_NAME, `${examId}.json`);

/**
 * 저장해 둔 시험 팩을 모두 읽는다 (시험 id 순). 앱이 켜질 때 한 번, 동기로.
 * 불러올 때 이미 검사했으므로 여기서는 시험 팩인지만 가볍게 본다. 읽지 못한 파일은 건너뛰고 이유를 남긴다.
 */
export function loadInstalledPacks(): { packs: ExamPackFile[]; errors: string[] } {
  const packs: ExamPackFile[] = [];
  const errors: string[] = [];
  if (!canUseFiles) return { packs, errors };
  try {
    const d = dir();
    if (!d.exists) return { packs, errors };
    const files = d
      .list()
      .filter((f): f is File => f instanceof File && f.name.endsWith('.json') && !f.name.endsWith('.tmp.json'))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const f of files) {
      try {
        const data: unknown = JSON.parse(f.textSync());
        if (!isExamPackFile(data)) throw new Error('시험 팩 형식이 아니에요');
        packs.push(data);
      } catch (e) {
        errors.push(`${f.name}: ${(e as Error).message || '읽지 못했어요'}`);
      }
    }
  } catch (e) {
    errors.push((e as Error).message || '시험 팩 폴더를 읽지 못했어요');
  }
  return { packs, errors };
}

/** 고른 파일을 읽고 검사한다 (아직 저장하지 않음). 형식이 틀리면 이유를 담아 throw */
export async function readExamPackFile(uri: string): Promise<ExamPackFile> {
  let data: unknown;
  try {
    data = JSON.parse((await new File(uri).text()).replace(/^﻿/, ''));
  } catch {
    throw new Error('JSON 파일이 아니거나 손상된 파일이에요.');
  }
  return parseExamPack(data);
}

/** 검사한 팩을 기기에 저장한다 — 임시 파일에 다 쓴 뒤 바꿔 넣어, 중간에 실패해도 이전 팩이 남는다 */
export function installExamPack(pack: ExamPackFile): void {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  const tmp = new File(Paths.document, DIR_NAME, `${pack.exam.id}.tmp.json`);
  tmp.create({ overwrite: true });
  tmp.write(JSON.stringify(pack));
  const target = fileOf(pack.exam.id);
  if (target.exists) target.delete();
  tmp.move(target);
}

/** 추가한 시험을 지운다 (다시 시작해야 적용). 그 시험의 단어 중 다른 시험·기본 단어에 없는 것도 함께 빠진다 */
export function removeExamPack(examId: string): void {
  const target = fileOf(examId);
  if (target.exists) target.delete();
}

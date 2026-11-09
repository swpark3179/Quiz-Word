import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIsStale, needsInstall, nodeOk } from '../launch.mjs';

/** 파일을 만들고 수정 시각을 정한다 (초 단위) */
function touch(file, seconds) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  fs.utimesSync(file, seconds, seconds);
}

describe('간편 실행 스크립트', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-word-launch-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('Vite 가 요구하는 Node 버전만 통과시킨다', () => {
    expect(nodeOk('18.20.0')).toBe(false);
    expect(nodeOk('20.18.3')).toBe(false);
    expect(nodeOk('20.19.0')).toBe(true);
    expect(nodeOk('21.7.0')).toBe(false);
    expect(nodeOk('22.11.0')).toBe(false);
    expect(nodeOk('22.12.0')).toBe(true);
    expect(nodeOk('24.0.0')).toBe(true);
  });

  it('빌드본이 없으면 빌드가 필요하다', () => {
    touch(path.join(root, 'src', 'main.tsx'), 1000);
    expect(buildIsStale(root)).toBe(true);
  });

  it('빌드한 뒤에 바뀐 파일이 없으면 다시 빌드하지 않는다', () => {
    touch(path.join(root, 'src', 'main.tsx'), 1000);
    touch(path.join(root, 'data', 'words', 'a.json'), 1000);
    touch(path.join(root, 'dist', 'index.html'), 2000);
    expect(buildIsStale(root)).toBe(false);
  });

  it('단어 파일이나 화면 코드를 고치면 다시 빌드한다', () => {
    touch(path.join(root, 'src', 'main.tsx'), 1000);
    touch(path.join(root, 'dist', 'index.html'), 2000);
    touch(path.join(root, 'data', 'words', 'a.json'), 3000);
    expect(buildIsStale(root)).toBe(true);
    touch(path.join(root, 'dist', 'index.html'), 4000);
    expect(buildIsStale(root)).toBe(false);
    touch(path.join(root, 'src', 'pages', 'Home.tsx'), 5000);
    expect(buildIsStale(root)).toBe(true);
  });

  it('테스트 파일만 바뀌었으면 다시 빌드하지 않는다', () => {
    touch(path.join(root, 'dist', 'index.html'), 2000);
    touch(path.join(root, 'src', 'lib', '__tests__', 'core.test.ts'), 3000);
    expect(buildIsStale(root)).toBe(false);
  });

  it('패키지가 없거나 잠금 파일이 설치 이후에 바뀌었으면 설치한다', () => {
    expect(needsInstall(root)).toBe(true);
    touch(path.join(root, 'node_modules', 'vite', 'package.json'), 1000);
    touch(path.join(root, 'node_modules', '.package-lock.json'), 1000);
    touch(path.join(root, 'package-lock.json'), 500);
    expect(needsInstall(root)).toBe(false);
    touch(path.join(root, 'package-lock.json'), 2000);
    expect(needsInstall(root)).toBe(true);
  });
});

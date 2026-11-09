#!/usr/bin/env node
/**
 * 간편 실행 — 준비(패키지 설치·빌드)를 알아서 하고 브라우저로 연다.
 *
 *   node scripts/launch.mjs             빌드본으로 실행 (기본)
 *   node scripts/launch.mjs --dev       개발 서버 — 단어 파일을 고치면 바로 반영
 *   node scripts/launch.mjs --lan       같은 네트워크의 다른 기기(휴대폰 등)에서도 접속
 *   node scripts/launch.mjs --no-open   브라우저를 열지 않음
 *   node scripts/launch.mjs --rebuild   바뀐 게 없어도 다시 빌드
 *   node scripts/launch.mjs --shortcut  바탕화면에 바로가기 만들기 (Windows)
 *
 * 이미 실행 중이면 새로 띄우지 않고 브라우저만 연다.
 * 포트는 vite.config.ts 의 5179 로 고정이다 — 진행 기록(localStorage)이 주소(포트 포함)별로 저장되기 때문.
 */
import { exec, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5179;
const URL_LOCAL = `http://localhost:${PORT}/`;
const FLAGS = ['--dev', '--lan', '--no-open', '--rebuild', '--shortcut', '--help', '-h'];

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const say = (msg = '') => console.log(msg ? `  ${msg}` : '');
const fail = (msg) => {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
};

/** Vite 8 이 요구하는 Node 버전: ^20.19.0 || >=22.12.0 */
export function nodeOk(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  return (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23;
}

/** 폴더 안에서 가장 최근에 바뀐 파일의 시각 (없으면 0) */
export function newestMtime(target) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = 0;
  for (const name of fs.readdirSync(target)) {
    if (name === '__tests__') continue;
    newest = Math.max(newest, newestMtime(path.join(target, name)));
  }
  return newest;
}

/** 화면에 들어가는 파일이 빌드본(dist)보다 새로우면 다시 빌드해야 한다 */
export function buildIsStale(root = ROOT) {
  const built = newestMtime(path.join(root, 'dist', 'index.html'));
  if (!built) return true;
  const inputs = ['src', 'data', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json'];
  return inputs.some((p) => newestMtime(path.join(root, p)) > built);
}

/** 패키지가 없거나 package-lock.json 이 설치 이후에 바뀌었으면 설치가 필요하다 */
export function needsInstall(root = ROOT) {
  if (!fs.existsSync(path.join(root, 'node_modules', 'vite', 'package.json'))) return true;
  const installed = newestMtime(path.join(root, 'node_modules', '.package-lock.json'));
  return installed > 0 && newestMtime(path.join(root, 'package-lock.json')) > installed;
}

/** 5179 포트에 무엇이 떠 있는지: 'free' | 'ours' | 'other' */
async function probePort() {
  try {
    const res = await fetch(URL_LOCAL, { signal: AbortSignal.timeout(1500) });
    const body = await res.text();
    return body.includes('<title>Quiz Word</title>') ? 'ours' : 'other';
  } catch (e) {
    // 응답은 없는데 연결은 된 경우(다른 프로그램)와 아무것도 없는 경우를 가른다
    return e?.name === 'TimeoutError' ? 'other' : 'free';
  }
}

function openBrowser(url) {
  if (has('--no-open')) return;
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {
    /* 브라우저를 못 열어도 주소는 화면에 나와 있다 */
  });
}

function lanUrls() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => `http://${n.address}:${PORT}/`);
}

/** --no-save: package-lock.json 은 건드리지 않는다 (npm 버전에 따라 형식이 바뀌는 것을 막음) */
function install() {
  say('처음 실행이라 필요한 패키지를 설치합니다. 1~2분 걸릴 수 있어요…');
  const r = spawnSync('npm', ['install', '--no-save', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) fail('패키지 설치에 실패했습니다. 인터넷 연결(회사망이면 프록시 설정)을 확인한 뒤 다시 실행해 주세요.');
}

/** 바탕화면 바로가기 — 더블클릭하면 start.cmd 를 최소화된 창으로 실행한다 */
function makeShortcut() {
  if (process.platform !== 'win32') {
    fail('바로가기 만들기는 Windows 전용입니다. macOS·Linux 는 ./start.sh 를 실행하세요.');
  }
  const q = (s) => `'${s.replace(/'/g, "''")}'`;
  const script = [
    `$link = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Quiz Word.lnk'`,
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut($link)`,
    `$s.TargetPath = ${q(path.join(ROOT, 'start.cmd'))}`,
    `$s.WorkingDirectory = ${q(ROOT)}`,
    `$s.WindowStyle = 7`,
    `$s.Description = 'Quiz Word'`,
    `$s.Save()`,
    `Write-Output $link`,
  ].join('; ');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
  if (r.status !== 0) fail(`바로가기를 만들지 못했습니다.\n${r.stderr || r.error?.message || ''}`);
  say(`✓ 바탕화면에 바로가기를 만들었습니다: ${r.stdout.trim()}`);
  say('  더블클릭하면 Quiz Word 가 브라우저로 열립니다. (검은 창은 작업 표시줄에 최소화됩니다)');
}

function printHelp() {
  console.log(`
  Quiz Word 실행

    start.cmd (Windows 더블클릭) · ./start.sh (macOS·Linux) · npm start

  옵션
    --dev        개발 서버로 실행 — 단어 파일(data/words)을 고치면 바로 반영
    --lan        같은 네트워크의 다른 기기에서도 접속 (주소가 화면에 나옵니다)
    --no-open    브라우저를 자동으로 열지 않음
    --rebuild    바뀐 게 없어도 다시 빌드
    --shortcut   바탕화면에 바로가기 만들기 (Windows)
`);
}

async function main() {
  const unknown = args.filter((a) => !FLAGS.includes(a));
  if (unknown.length) fail(`모르는 옵션입니다: ${unknown.join(' ')}  (--help 로 옵션을 볼 수 있어요)`);
  if (has('--help') || has('-h')) return printHelp();
  if (has('--shortcut')) return makeShortcut();

  console.log('\n  Quiz Word — CCAR-F 영어 단어장\n');
  if (!nodeOk()) {
    fail(`Node.js ${process.versions.node} 은 너무 오래됐습니다. https://nodejs.org 에서 LTS 버전(22 이상)을 설치해 주세요.`);
  }
  process.chdir(ROOT);

  const state = await probePort();
  if (state === 'ours') {
    say(`이미 실행 중입니다 → ${URL_LOCAL}`);
    openBrowser(URL_LOCAL);
    return;
  }
  if (state === 'other') {
    fail(
      `${PORT} 포트를 다른 프로그램이 쓰고 있습니다. 그 프로그램을 끈 뒤 다시 실행해 주세요.\n` +
        '    (포트를 바꾸면 주소가 달라져 진행 기록이 보이지 않으므로 포트는 고정입니다)',
    );
  }

  if (needsInstall()) install();
  const vite = await import('vite');
  const host = has('--lan') ? true : undefined;

  let server;
  if (has('--dev')) {
    say('개발 서버로 실행합니다 (단어 파일을 고치면 바로 반영).');
    server = await vite.createServer({ root: ROOT, logLevel: 'warn', server: { host } });
    await server.listen();
  } else {
    if (has('--rebuild') || buildIsStale()) {
      say('화면을 빌드하는 중…');
      await vite.build({ root: ROOT, logLevel: 'warn' });
    }
    server = await vite.preview({ root: ROOT, logLevel: 'warn', preview: { host } });
  }

  say(`✓ 실행 중 → ${URL_LOCAL}`);
  if (has('--lan')) {
    for (const url of lanUrls()) say(`  다른 기기에서: ${url}`);
    say('  (주소가 다르면 진행 기록도 따로 저장됩니다 — 옮길 때는 설정 → 내보내기/가져오기)');
  }
  say('끝내려면 이 창을 닫거나 Ctrl+C 를 누르세요.');
  say();
  openBrowser(URL_LOCAL);

  const stop = () => {
    Promise.resolve(server.close?.() ?? server.httpServer?.close()).finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

// 테스트에서 import 할 때는 실행하지 않는다
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    if (e?.code === 'EADDRINUSE' || /Port \d+ is (already )?in use/i.test(e?.message ?? '')) {
      fail(`${PORT} 포트를 다른 프로그램이 쓰고 있습니다. 그 프로그램을 끈 뒤 다시 실행해 주세요.`);
    }
    fail(`실행하지 못했습니다: ${e?.stack ?? e}`);
  });
}

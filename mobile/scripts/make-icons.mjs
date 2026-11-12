/**
 * 앱 아이콘·스플래시 이미지 만들기 — SVG 를 설치된 Edge 로 렌더링해 PNG 로 저장한다.
 * 실행: npm run icons  (저장소 루트의 playwright-core 를 사용)
 *
 * 디자인: 인디고 → 바이올렛 대각선 그라데이션 위에 흰 "W", 아래에 노란 형광펜 밑줄
 *   icon.png        라이트 (불투명 1024²)
 *   icon-dark.png   다크 (투명 배경 + 밝은 인디고 글리프)
 *   icon-tinted.png 틴트 (투명 배경 + 흰 글리프, iOS 가 색을 입힌다)
 *   splash-icon.png 스플래시 (투명 배경 + 흰 W)
 *   adaptive-icon.png       안드로이드 적응형 아이콘 전경 (투명 배경 + 흰 W, 가운데 안전 영역 안으로 줄임 — 배경색은 app.config.ts)
 *   adaptive-icon-mono.png  안드로이드 13+ 테마 아이콘 (단색 W)
 *
 * 파일 이름을 주면 그것만 만든다: npm run icons -- adaptive-icon.png adaptive-icon-mono.png
 * 다른 브라우저로 만들려면 BROWSER(채널 이름) 또는 BROWSER_PATH(실행 파일 경로)를 준다.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(here, '..', 'assets');
const require = createRequire(path.resolve(here, '..', '..', 'package.json'));
const { chromium } = require('playwright-core');

const W = (stroke, marker = '#FFE066', markerOpacity = 0.95) => `
  <rect x="300" y="742" width="424" height="58" rx="29" fill="${marker}" opacity="${markerOpacity}" transform="rotate(-2 512 771)"/>
  <polyline points="262,318 384,702 512,438 640,702 762,318" fill="none" stroke="${stroke}" stroke-width="100" stroke-linecap="round" stroke-linejoin="round"/>`;

/** 적응형 아이콘은 바깥쪽이 잘리므로(가운데 약 61% 만 항상 보인다) 글리프를 줄여 한가운데에 둔다 */
const inset = (inner, scale = 0.58) => `<g transform="translate(512 512) scale(${scale}) translate(-512 -530)">${inner}</g>`;

const svgs = {
  'icon.png': `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#7C3AED"/></linearGradient>
    <radialGradient id="h" cx="0.25" cy="0.15" r="0.9"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>
    <rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#h)"/>${W('#FFFFFF')}</svg>`,
  'icon-dark.png': `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${W('#A5B4FC', '#FCD34D', 0.9)}</svg>`,
  'icon-tinted.png': `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${W('#FFFFFF', '#FFFFFF', 0.55)}</svg>`,
  'splash-icon.png': `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${W('#FFFFFF')}</svg>`,
  'adaptive-icon.png': `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inset(W('#FFFFFF'))}</svg>`,
  'adaptive-icon-mono.png': `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inset(W('#FFFFFF', '#FFFFFF', 0.55))}</svg>`,
};

const only = process.argv.slice(2);
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : { channel: process.env.BROWSER ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
for (const [name, svg] of Object.entries(svgs)) {
  if (only.length && !only.includes(name)) continue;
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: path.join(assets, name), omitBackground: name !== 'icon.png' });
  console.log('saved', name);
}
await browser.close();

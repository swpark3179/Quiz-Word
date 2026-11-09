/**
 * 화면 점검 — 실행 중인 개발 서버(npm run dev)를 설치된 Edge/Chrome 으로 열어 주요 흐름을 눌러 보고 스크린샷을 남긴다.
 * 실행: npx tsx scripts/smoke.ts [스크린샷 폴더]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';

const BASE = 'http://localhost:5179/#';
const OUT = path.resolve(process.argv[2] ?? 'pipeline/screens');
fs.mkdirSync(OUT, { recursive: true });

const errors: string[] = [];
const results: string[] = [];
const ok = (msg: string) => results.push(`  ✓ ${msg}`);
const fail = (msg: string) => results.push(`  ✗ ${msg}`);

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.BROWSER ?? 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

  // 홈
  await page.goto(`${BASE}/`);
  await page.waitForSelector('text=오늘도 조금씩');
  ok('홈 표시');
  await shot(page, '01-home');

  // 검색 → 상세
  await page.goto(`${BASE}/words`);
  await page.fill('input[placeholder*="escalate"]', 'address');
  await page.waitForTimeout(200);
  await shot(page, '02-search');
  await page.keyboard.press('Enter');
  await page.waitForSelector('h2:has-text("address")');
  const senses = await page.locator('text=문제 속 뜻과 예문').count();
  senses ? ok('address 상세 — 문제 속 뜻') : fail('address 상세에 예문 구역 없음');
  const marks = await page.locator('mark.hl').count();
  marks > 0 ? ok(`예문 강조 ${marks}개`) : fail('예문 강조 없음');
  await shot(page, '03-detail-address');

  // 한글 검색
  await page.goto(`${BASE}/words?q=${encodeURIComponent('해결')}`);
  await page.waitForTimeout(200);
  const krCount = await page.locator('button:has(span.font-semibold)').count();
  krCount > 0 ? ok(`한글 검색 결과 ${krCount}행`) : fail('한글 검색 결과 없음');

  // 플래시카드
  await page.goto(`${BASE}/flash/play?set=all&basic=1&status=any&count=6&order=freq`);
  await page.waitForSelector('text=모른다');
  await shot(page, '04-flash-front');
  const first = (await page.locator('.text-5xl, .text-6xl').first().textContent())?.trim();
  await page.keyboard.press('ArrowLeft'); // 모른다
  await page.waitForSelector('text=모른다고 했어요');
  await shot(page, '05-flash-back');
  await page.keyboard.press('Space');
  let reappeared = false;
  for (let i = 0; i < 12; i++) {
    const cur = await page.locator('.text-5xl, .text-6xl').first().textContent().catch(() => null);
    if (cur?.trim() === first && i > 0) {
      reappeared = true;
      if (await page.locator('text=다시 나온 카드').count()) ok('모른다 카드가 다시 나옴 (표시 포함)');
    }
    if (await page.locator('text=끝까지 봤어요').count()) break;
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(60);
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
  }
  reappeared ? ok(`"${first}" 재등장`) : fail('모른다 카드가 다시 나오지 않음');
  (await page.locator('text=끝까지 봤어요').count()) ? ok('플래시카드 끝 요약') : fail('플래시카드 요약 없음');
  await shot(page, '06-flash-summary');

  // 객관식
  await page.goto(`${BASE}/quiz/play?set=core&basic=0&status=any&count=5&order=freq&mode=meaning`);
  await page.waitForSelector('text=보기 선택');
  await shot(page, '07-quiz');
  for (let i = 0; i < 5; i++) {
    const n = await page.locator('button.rounded-xl.border-2').count();
    if (n < 4) fail(`보기 수 ${n}`);
    await page.keyboard.press('1');
    await page.waitForTimeout(80);
    if (i === 0) await shot(page, '08-quiz-answered');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);
  }
  (await page.locator('text=문제 중').count()) ? ok('객관식 결과 화면') : fail('객관식 결과 없음');
  await shot(page, '09-quiz-result');

  // 문맥 뜻 모드
  await page.goto(`${BASE}/quiz/play?set=core&basic=0&status=any&count=3&order=freq&mode=context`);
  await page.waitForSelector('text=의 뜻은?');
  ok('문맥 뜻 문제');
  await shot(page, '10-quiz-context');

  // 오답노트·복습·설정
  await page.goto(`${BASE}/wrong`);
  await page.waitForTimeout(150);
  await shot(page, '11-wrong');
  await page.goto(`${BASE}/review`);
  await page.waitForSelector('text=앞으로 7일');
  await shot(page, '12-review');
  await page.goto(`${BASE}/settings`);
  await page.waitForSelector('text=진행 기록');
  await shot(page, '13-settings');

  // 새로고침 후 기록 유지
  const stored = await page.evaluate(() => localStorage.getItem('quiz-word:v1'));
  const cards = stored ? Object.keys(JSON.parse(stored).state.cards).length : 0;
  cards > 0 ? ok(`진행 기록 저장됨 (카드 ${cards}개)`) : fail('진행 기록 없음');
  await page.reload();
  const after = await page.evaluate(() => localStorage.getItem('quiz-word:v1'));
  after === stored ? ok('새로고침 후 기록 유지') : fail('새로고침 후 기록이 달라짐');

  // 다크 모드 + 좁은 화면
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.goto(`${BASE}/word/escalate`);
  await page.waitForTimeout(200);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await shot(page, '14-detail-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/flash/play?set=core&status=any&count=3`);
  await page.waitForTimeout(250);
  await shot(page, '15-mobile-flash');

  await browser.close();
  console.log(results.join('\n'));
  if (errors.length) console.log(`\n브라우저 오류 ${errors.length}개:\n${[...new Set(errors)].slice(0, 15).join('\n')}`);
  console.log(`\n스크린샷: ${OUT}`);
  process.exit(results.some((r) => r.includes('✗')) || errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

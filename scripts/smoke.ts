/**
 * 화면 점검 — 실행 중인 앱(npm start 또는 npm run dev)을 설치된 Edge/Chrome 으로 열어 주요 흐름을 눌러 보고 스크린샷을 남긴다.
 * 실행: npm run smoke [-- 스크린샷 폴더]
 *   BROWSER=chrome            Edge 대신 Chrome 사용
 *   BROWSER_PATH=/path/chrome 브라우저 실행 파일을 직접 지정
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

/** 요소가 스크롤하지 않고도 화면 안에 다 보이는지 */
async function inView(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  const view = page.viewportSize();
  return !!box && !!view && box.y >= 0 && box.y + box.height <= view.height;
}

/** 단어장 목록(가상 스크롤 영역) */
const LIST = 'main .overflow-y-auto';

async function main() {
  // BROWSER_PATH 로 실행 파일을 직접 지정할 수 있다 (Edge/Chrome 채널이 없는 환경)
  const browser = await chromium.launch(
    process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH, headless: true }
      : { channel: process.env.BROWSER ?? 'msedge', headless: true },
  );
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
  const krCount = await page.locator(`${LIST} button`).count();
  krCount > 0 ? ok(`한글 검색 결과 ${krCount}행`) : fail('한글 검색 결과 없음');

  // 단축키 도움말 · 화면 이동
  await page.goto(`${BASE}/`);
  await page.waitForSelector('text=오늘도 조금씩');
  await page.keyboard.press('Shift+Slash');
  await page.waitForSelector('dialog[open]');
  (await page.locator('dialog[open] >> text=키보드 단축키').count()) ? ok('? 로 단축키 도움말') : fail('단축키 도움말이 안 열림');
  await shot(page, '03b-shortcuts');
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('w');
  await page.waitForSelector('input[aria-label="단어 검색"]');
  ok('G → W 로 단어장 이동');

  // 빠르게 쳐도 글자가 빠지지 않는지, ↑↓ Enter 로 고르기
  await page.keyboard.type('add');
  await page.waitForTimeout(150);
  const typed = await page.inputValue('input[aria-label="단어 검색"]');
  typed === 'add' ? ok('빠른 입력 유지') : fail(`빠르게 치면 글자가 빠짐: "${typed}"`);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const picked = (await page.locator(`${LIST} button`).nth(2).locator('span.font-semibold').first().textContent())?.trim();
  await page.keyboard.press('Enter');
  await page.waitForSelector('h2');
  const openedWord = (await page.locator('h2').first().textContent())?.trim();
  openedWord === picked ? ok(`↑↓ Enter 로 "${picked}" 열기`) : fail(`고른 단어(${picked})와 열린 단어(${openedWord})가 다름`);

  // 상세에서 이전·다음, 한 번에 목록으로
  const position = () => page.locator('button[aria-label="이전 단어"] + span').textContent();
  const posBefore = (await position())?.trim();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  const posAfter = (await position())?.trim();
  posBefore?.startsWith('3 /') && posAfter?.startsWith('4 /')
    ? ok(`→ 로 다음 단어 (${posBefore} → ${posAfter})`)
    : fail(`이전·다음 이동 실패 (${posBefore} → ${posAfter})`);
  await page.keyboard.press('Backspace');
  await page.waitForSelector('input[aria-label="단어 검색"]');
  page.url().includes('q=add') ? ok('Backspace 한 번에 검색 결과로') : fail(`목록으로 돌아오지 못함: ${page.url()}`);

  // 목록을 내려 보다가 단어를 열고 돌아오면 보던 위치 그대로
  await page.click('aside a[href="#/"]');
  await page.click('aside a[href="#/words"]');
  await page.waitForSelector(`${LIST} button`);
  await page.locator(LIST).evaluate((el) => (el.scrollTop = 6400));
  await page.waitForTimeout(200);
  await page.locator(`${LIST} button`).nth(14).click();
  await page.waitForSelector('text=단어장으로');
  await page.click('text=단어장으로');
  await page.waitForSelector(`${LIST} button`);
  const restored = await page.locator(LIST).evaluate((el) => el.scrollTop);
  Math.abs(restored - 6400) < 5 ? ok('목록 위치 복원') : fail(`목록 위치가 복원되지 않음 (${restored})`);

  // 플래시카드
  await page.goto(`${BASE}/flash`);
  await page.waitForSelector('button:has-text("시작하기")');
  /\d+장 시작하기/.test((await page.locator('button:has-text("시작하기")').textContent()) ?? '') ? ok('시작 버튼에 카드 수 표시') : fail('시작 버튼에 카드 수가 없음');
  await page.goto(`${BASE}/flash/play?set=all&basic=1&status=any&count=6&order=freq`);
  await page.waitForSelector('button:has-text("모른다")');
  await shot(page, '04-flash-front');
  const first = (await page.locator('.text-5xl, .text-6xl').first().textContent())?.trim();
  await page.keyboard.press('ArrowLeft'); // 모른다
  await page.waitForSelector('text=모른다고 했어요');
  await page.waitForTimeout(250);
  (await inView(page, 'button:has-text("다음")')) ? ok('플래시카드 "다음" 버튼이 스크롤 없이 보임') : fail('"다음" 버튼이 화면 밖에 있음');
  await shot(page, '05-flash-back');
  await page.keyboard.press('Space');
  // 답한 뒤 Esc → 한 번 묻고, 계속하기를 누르면 그대로
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog[open]');
  await page.keyboard.press('ArrowRight'); // 창이 떠 있는 동안에는 카드 단축키가 먹지 않아야 한다
  (await page.locator('text=안다고 했어요').count()) ? fail('확인 창이 떠 있는데 카드 단축키가 동작함') : ok('Esc → 그만할지 확인');
  await page.click('dialog[open] >> text=계속하기');
  await page.waitForTimeout(100);
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
    if (i === 0) {
      await page.waitForTimeout(250);
      (await inView(page, 'button:has-text("다음 문제")')) ? ok('객관식 "다음 문제" 버튼이 스크롤 없이 보임') : fail('"다음 문제" 버튼이 화면 밖에 있음');
      await shot(page, '08-quiz-answered');
    }
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

  // 학습장 — 오답노트로 만들기, 새 학습장에 검색해 담기·바로 빼기, 학습 시작·종료
  await page.goto(`${BASE}/notebooks`);
  await page.waitForSelector('button:has-text("새 학습장")');
  const fromWrong = page.locator('button:has-text("오답노트로 만들기")').first();
  if (await fromWrong.isEnabled()) {
    await fromWrong.click();
    await page.waitForSelector('input[aria-label="학습장에 담을 단어 검색"]');
    (await page.locator('button[aria-label$="학습장에서 빼기"]').count()) > 0 ? ok('오답노트로 학습장 만들기') : fail('오답노트로 만든 학습장이 비어 있음');
    await page.click('text=학습장 목록');
  }
  await page.click('button:has-text("새 학습장")');
  await page.waitForSelector('dialog[open] input[aria-label="학습장 이름"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('input[aria-label="학습장에 담을 단어 검색"]');
  /#\/notebooks\/nb-/.test(page.url()) ? ok('새 학습장 만들기') : fail(`새 학습장 주소가 이상함: ${page.url()}`);
  const nbSearch = 'input[aria-label="학습장에 담을 단어 검색"]';
  for (const q of ['address', 'escalate']) {
    await page.fill(nbSearch, q);
    await page.waitForTimeout(80);
    await page.keyboard.press('Enter');
  }
  const inBook = () => page.locator('button[aria-label$="학습장에서 빼기"]').count();
  (await inBook()) === 2 && (await page.inputValue(nbSearch)) === '' ? ok('검색 → Enter 로 학습장에 담기') : fail(`학습장 단어 수 ${await inBook()}`);
  await shot(page, '11a-notebook');
  await page.click('button[aria-label="address 학습장에서 빼기"]');
  (await inBook()) === 1 && !(await page.locator('dialog[open]').count()) ? ok('묻지 않고 바로 빼기') : fail('단어 빼기 실패');
  await page.click('main button:has-text("플래시카드")');
  await page.waitForSelector('button:has-text("모른다")');
  /set=notebook/.test(page.url()) ? ok('학습장 플래시카드 시작') : fail(`학습장 범위가 아님: ${page.url()}`);
  await page.keyboard.press('Escape');
  await page.waitForSelector(nbSearch);
  ok('학습 종료 → 학습장으로 돌아옴');
  await page.click('main button:has-text("객관식")');
  await page.waitForSelector('text=보기 선택');
  ok('학습장 객관식 시작');
  await page.keyboard.press('Escape');
  await page.waitForSelector(nbSearch);

  // 학습장 합치기 — 겹치는 단어는 한 번만, 기존 학습장은 남겨 둔다
  await page.click('text=학습장 목록');
  await page.click('button:has-text("새 학습장")');
  await page.waitForSelector('dialog[open] input[aria-label="학습장 이름"]');
  await page.fill('dialog[open] input[aria-label="학습장 이름"]', '합치기 점검');
  await page.keyboard.press('Enter');
  await page.waitForSelector(nbSearch);
  for (const q of ['escalate', 'robust']) {
    await page.fill(nbSearch, q);
    await page.waitForTimeout(80);
    await page.keyboard.press('Enter');
  }
  await page.click('text=학습장 목록');
  const nbLinks = 'main a[href^="#/notebooks/"]';
  await page.waitForSelector(nbLinks);
  const booksBefore = await page.locator(nbLinks).count();
  await page.click('button:has-text("학습장 합치기")');
  await page.waitForSelector('dialog[open] input[type="checkbox"]');
  // 맨 위 두 학습장 = 방금 만든 '합치기 점검'(escalate, robust) 과 앞의 학습장(escalate)
  const boxes = page.locator('dialog[open] input[type="checkbox"]');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  const preview = await page.locator('dialog[open] [role="status"]').innerText();
  preview.includes('겹치는 단어 1개') ? ok('합치기 미리보기 (겹치는 단어 수)') : fail(`합치기 미리보기가 이상함: ${preview}`);
  await shot(page, '11b-notebook-merge');
  await page.click('dialog[open] button[type="submit"]');
  await page.waitForSelector(nbSearch);
  (await inBook()) === 2 ? ok('학습장 합치기 (겹치는 단어는 한 번만)') : fail(`합친 학습장 단어 수 ${await inBook()}`);
  await page.click('text=학습장 목록');
  await page.waitForSelector(nbLinks);
  (await page.locator(nbLinks).count()) === booksBefore + 1 ? ok('합친 뒤 기존 학습장은 남아 있음') : fail('합친 뒤 학습장 수가 이상함');

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
  (await page.locator('nav.fixed').count()) === 0 ? ok('좁은 화면: 학습 중에는 하단 탭 숨김') : fail('학습 중에 하단 탭이 보임');
  await page.goto(`${BASE}/words`);
  await page.waitForSelector(`${LIST} button`);
  const tabs = await page.locator('nav.fixed').boundingBox();
  const listBox = await page.locator(LIST).boundingBox();
  tabs && listBox && listBox.y + listBox.height <= tabs.y + 1 ? ok('좁은 화면: 하단 탭이 목록을 가리지 않음') : fail('하단 탭이 목록을 가림');
  (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) ? ok('좁은 화면: 가로 넘침 없음') : fail('좁은 화면에서 가로로 넘침');
  await shot(page, '16-mobile-words');
  await page.goto(`${BASE}/notebooks`);
  await page.waitForSelector('button:has-text("새 학습장")');
  await page.locator('main a[href^="#/notebooks/"]').first().click();
  await page.waitForSelector('input[aria-label="학습장에 담을 단어 검색"]');
  (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) ? ok('좁은 화면: 학습장 가로 넘침 없음') : fail('좁은 화면 학습장이 가로로 넘침');
  await shot(page, '17-mobile-notebook');

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

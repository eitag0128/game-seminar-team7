import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// よいやみ 中間発表版（public/yoiyami/index.html）。
// 序章 → チュートリアル → 9回探索 → コラージュ → エンドを、普通の操作で通す。
const URL = '/yoiyami/index.html';
const game = (page: Page) => page.locator('#game');
const px = async (page: Page) => Number(await game(page).getAttribute('data-px'));
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/yoiyami-${name}.png` });

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

/** 会話を、選択肢か別の画面が出るまで読み進める。選択肢は first 番目を選ぶ。 */
async function talk(page: Page, pick = 0): Promise<void> {
  for (let i = 0; i < 80; i++) {
    if ((await game(page).getAttribute('data-screen')) !== 'bench') return;
    const choices = page.locator('#choices .choice');
    if (await choices.count()) { await choices.nth(pick).click(); continue; }
    if ((await page.locator('#tap').innerText()) !== '') await page.keyboard.press('Enter');
    await page.waitForTimeout(70);
  }
}

async function walkTo(page: Page, x: number, run = true): Promise<void> {
  // 場所を移った直後は、位置の表示が次の描画まで古いことがあるので1回待つ
  await page.waitForTimeout(80);
  const from = await px(page);
  if (Math.abs(from - x) < 40) return;
  const key = from < x ? 'ArrowRight' : 'ArrowLeft';
  if (run) await page.keyboard.down('Shift');
  await page.keyboard.down(key);
  await expect.poll(async () => (from < x ? (await px(page)) >= x - 30 : (await px(page)) <= x + 30), { intervals: [30], timeout: 30000 }).toBe(true);
  await page.keyboard.up(key);
  if (run) await page.keyboard.up('Shift');
}

/** 物の所まで歩いて調べ、option 番目を選ぶ。 */
async function inspect(page: Page, x: number, option = 0): Promise<void> {
  await walkTo(page, x);
  await page.keyboard.press('Enter');
  await page.locator('#ask .choice').nth(option).click({ timeout: 15000 });
  await page.waitForTimeout(250);
}

async function skipToTutorial(page: Page): Promise<void> {
  await page.goto(URL);
  await page.getByRole('button', { name: 'はじめから' }).click();
  await page.getByRole('button', { name: '会話を飛ばす' }).click();
  await expect(game(page)).toHaveAttribute('data-screen', 'map');
}

async function finishTutorial(page: Page, kick: boolean): Promise<void> {
  await walkTo(page, 700);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: kick ? '蹴とばす' : 'ゴミ箱に捨てる' }).click();
  if (!kick) {
    await expect(page.locator('#guide')).toBeVisible();
    await walkTo(page, 1500);
    await page.keyboard.press('Enter');
  }
  await expect(game(page)).toHaveAttribute('data-screen', 'bench', { timeout: 10000 });
  await talk(page);
  await expect(game(page)).toHaveAttribute('data-screen', 'map');
  await expect(game(page)).toHaveAttribute('data-explore', '0');
  // 探索の説明（やること・操作）が出るので、読んで閉じる
  await expect(page.getByRole('heading', { name: '夜の街の中を探索しよう' })).toBeVisible();
  await page.getByRole('button', { name: '探索をはじめる' }).click();
  await expect(page.locator('#howto')).toBeHidden();
}

async function placeAll(page: Page, center?: string): Promise<void> {
  await expect(game(page)).toHaveAttribute('data-screen', 'collage');
  if (center) {
    await page.locator('#hand .piece', { hasText: center }).click();
    await page.locator('.slot.center').click();
  }
  for (let i = 0; i < 9; i++) {
    const empty = page.locator('.slot:not(:has(.piece))');
    if (!(await empty.count())) break;
    await page.locator('#hand .piece').first().click();
    await empty.first().click();
  }
  await expect(page.getByRole('button', { name: '少女に渡す' })).toBeEnabled();
}

async function readEnding(page: Page): Promise<void> {
  await expect(game(page)).toHaveAttribute('data-screen', 'end', { timeout: 15000 });
  const back = page.locator('#back');
  for (let i = 0; i < 8 && !(await page.locator('#end .after').isVisible()); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await expect(back).toBeVisible();
}

test('PC: title, intro, tutorial, nine pieces in the residential area and park, collage, END 1', async ({ page }) => {
  test.setTimeout(240000);
  const errors = watchErrors(page);
  await page.goto(URL);
  await expect(page.getByRole('heading', { name: /よいやみ/ })).toBeVisible();
  await expect(page.locator('#version')).toHaveText(/^v\d+\.\d+ .+　更新日 \d{4}-\d{2}-\d{2}$/);
  await shot(page, 'title');
  await page.getByRole('button', { name: 'はじめから' }).click();
  await page.waitForTimeout(2600);
  await expect(page.locator('#log .msg').last()).toHaveText('こんばんは');
  await shot(page, 'bench');
  // 「例えば＿＿＿」の後、街に空き缶が転がってくる場面に切り替わり、ベンチに戻る。
  for (let i = 0; i < 12 && (await game(page).getAttribute('data-screen')) === 'bench'; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
  await expect(game(page)).toHaveAttribute('data-screen', 'map');
  await page.waitForTimeout(1500);
  await shot(page, 'can-rolls');
  await expect(game(page)).toHaveAttribute('data-screen', 'bench', { timeout: 8000 });
  await talk(page);
  await expect(game(page)).toHaveAttribute('data-screen', 'map');
  await shot(page, 'tutorial');
  await finishTutorial(page, false);

  for (const x of [420, 820, 1240, 1680]) await inspect(page, x, 0);
  await shot(page, 'residential');
  await inspect(page, 2140, 1); // 消そうとする → 真面目
  // ネット: 1回直して公園へ行き、戻るとまためくれている。
  await inspect(page, 2580, 0);
  await expect(game(page)).toHaveAttribute('data-explore', '5');
  await walkTo(page, 3340);
  await page.keyboard.press('Enter');
  await expect(game(page)).toHaveAttribute('data-map', 'park');
  await page.waitForTimeout(900);
  await shot(page, 'park');
  await walkTo(page, 100);
  await page.keyboard.press('Enter');
  await expect(game(page)).toHaveAttribute('data-map', 'residential');
  await inspect(page, 2580, 0);
  await expect(page.locator('#bagList')).toContainText('根気強い');
  await walkTo(page, 3340);
  await page.keyboard.press('Enter');
  await inspect(page, 1220, 0);
  await inspect(page, 1600, 0);
  // リフティング: 1回目で外す → インドア
  await walkTo(page, 1960);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'リフティングをする' }).click();
  await shot(page, 'lifting');
  for (let n = 0; n < 12 && (await page.locator('#ask .ball').isVisible()); n++) {
    await expect.poll(async () => page.evaluate(() => { const b = document.querySelector<HTMLElement>('#ask .ball'); return !b || b.offsetParent === null || Math.abs(parseFloat(b.style.left) - 50) < 6; }), { intervals: [8], timeout: 8000 }).toBe(true);
    await page.keyboard.press('Space');
  }
  await expect(game(page)).toHaveAttribute('data-explore', '9');
  await expect(page.locator('#bagList')).toContainText(/アウトドア|インドア/);
  await expect(game(page)).toHaveAttribute('data-screen', 'bench', { timeout: 10000 });
  await page.waitForTimeout(2700);
  await shot(page, 'dawn');
  await talk(page);
  await placeAll(page);
  await shot(page, 'collage');
  await page.getByRole('button', { name: '少女に渡す' }).click();
  await talk(page);
  await readEnding(page);
  await expect(game(page)).toHaveAttribute('data-end', 'E01');
  await shot(page, 'end1');
  await page.locator('#back').click();
  await page.getByRole('button', { name: 'エンド一覧' }).click();
  await expect(page.locator('#bookList')).toContainText('昼の足音');
  await expect(page.locator('#bookList li', { hasText: '？？？' })).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('school corridor: shadows, the door voices, the poster, the library piece in the centre gives END 4', async ({ page }) => {
  test.setTimeout(240000);
  const errors = watchErrors(page);
  await skipToTutorial(page);
  await finishTutorial(page, true);
  for (const x of [420, 820, 1240, 1680, 3000]) await inspect(page, x, 1 % 2 === 1 && x !== 3000 ? 1 : 0);
  await walkTo(page, 3340); await page.keyboard.press('Enter');
  await expect(game(page)).toHaveAttribute('data-map', 'park');
  // シーソー: すぐ降りる → 割り切りがいい
  await walkTo(page, 2360); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '座る' }).click();
  await page.getByRole('button', { name: '降りる' }).click();
  await expect(page.locator('#bagList')).toContainText('割り切りがいい');
  await walkTo(page, 3540); await page.keyboard.press('Enter');
  await expect(game(page)).toHaveAttribute('data-map', 'school');
  // 生徒の影の近くでは画面が揺らぐ
  await walkTo(page, 720);
  await expect(page.locator('#map')).toHaveClass(/uneasy/);
  await shot(page, 'school-shadow');
  // 張り紙を読んだ後、歩いて進む → 素直
  await walkTo(page, 980, false); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '読んだ' }).click();
  await walkTo(page, 1300, false);
  await expect(page.locator('#bagList')).toContainText('素直');
  // 女子トイレの扉: 声が流れた後に選ぶ
  await walkTo(page, 1560); await page.keyboard.press('Enter');
  await expect(page.locator('.voices')).toContainText('1学期から来てない子');
  await shot(page, 'school-door');
  await page.getByRole('button', { name: 'その場を離れる' }).click({ timeout: 15000 });
  await inspect(page, 2100, 0);
  await expect(game(page)).toHaveAttribute('data-explore', '9');
  await expect(game(page)).toHaveAttribute('data-screen', 'bench', { timeout: 10000 });
  await talk(page);
  await placeAll(page, '図書館');
  await shot(page, 'collage-library');
  await page.getByRole('button', { name: '少女に渡す' }).click();
  await talk(page);
  await readEnding(page);
  await expect(game(page)).toHaveAttribute('data-end', 'E04');
  await shot(page, 'end4');
  // 並べ直して、図書館を中央から外すと別のエンドになる
  await page.getByRole('button', { name: '並べ直す' }).click();
  await placeAll(page, '素直');
  await page.getByRole('button', { name: '少女に渡す' }).click();
  await talk(page);
  await readEnding(page);
  await expect(game(page)).not.toHaveAttribute('data-end', 'E04');
  expect(errors).toEqual([]);
});

test('ending rules follow the spec: centre special pieces first, then the weighted score', async ({ page }) => {
  await page.goto(URL);
  const judge = (attrs: string[], centerName = '') => page.evaluate(([list, center]) => {
    const state = (0, eval)('f') as { hand: { id: string; name: string; attr: string }[]; slot: number[] };
    state.hand = (list as string[]).map((attr, i) => ({ id: 'T' + i, name: i === 4 && center ? (center as string) : 'x' + i, attr }));
    state.slot = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    return (0, eval)('judge()') as { id: string; score: number };
  }, [attrs, centerName] as const);
  const all = (attr: string) => Array(9).fill(attr);
  expect(await judge(all('day'))).toEqual({ id: 'E01', score: 15 });
  expect(await judge(all('night'))).toEqual({ id: 'E02', score: -15 });
  expect(await judge(all('lamp'))).toEqual({ id: 'E03', score: 0 });
  // 中央（重み3）だけ昼 → +3 で END1、角（重み1）2つだけ昼 → +2 で END3
  expect(await judge(['lamp', 'lamp', 'lamp', 'lamp', 'day', 'lamp', 'lamp', 'lamp', 'lamp'])).toEqual({ id: 'E01', score: 3 });
  expect(await judge(['day', 'lamp', 'day', 'lamp', 'lamp', 'lamp', 'lamp', 'lamp', 'lamp'])).toEqual({ id: 'E03', score: 2 });
  expect(await judge(['lamp', 'night', 'lamp', 'lamp', 'lamp', 'lamp', 'night', 'lamp', 'lamp'])).toEqual({ id: 'E02', score: -3 });
  for (const [name, id] of [['図書館', 'E04'], ['デジタル', 'E05'], ['フリースクール', 'E06']]) {
    const attrs = all('day'); attrs[4] = 'special';
    expect((await judge(attrs, name)).id).toBe(id);
  }
});

test.describe('phone landscape', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  test('touch: hold ◀ ▶ to walk, tap to inspect, everything stays on screen', async ({ page }) => {
    test.setTimeout(120000);
    const errors = watchErrors(page);
    await page.goto(URL);
    await shot(page, 'phone-title');
    await page.getByRole('button', { name: 'はじめから' }).tap();
    await page.getByRole('button', { name: '会話を飛ばす' }).tap();
    await expect(game(page)).toHaveAttribute('data-input', 'touch');
    const hold = async (id: string, until: () => Promise<boolean>) => {
      const init = { pointerId: 5, pointerType: 'touch', isPrimary: true, bubbles: true };
      await page.locator(id).dispatchEvent('pointerdown', init);
      await expect.poll(until, { intervals: [40], timeout: 30000 }).toBe(true);
      await page.locator(id).dispatchEvent('pointerup', init);
    };
    await hold('#tr', async () => (await px(page)) >= 680);
    await page.getByRole('button', { name: '調べる' }).tap();
    await shot(page, 'phone-ask');
    for (const button of await page.locator('#ask .choice').all()) {
      const box = (await button.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(390);
      expect(box.x).toBeGreaterThanOrEqual(0);
    }
    await page.getByRole('button', { name: '蹴とばす' }).tap();
    await expect(game(page)).toHaveAttribute('data-screen', 'bench', { timeout: 10000 });
    await shot(page, 'phone-bench');
    for (let i = 0; i < 30 && (await game(page).getAttribute('data-screen')) === 'bench'; i++) { await page.locator('#bench').tap({ position: { x: 420, y: 60 } }); await page.waitForTimeout(80); }
    await expect(game(page)).toHaveAttribute('data-screen', 'map');
    await shot(page, 'phone-howto');
    await page.getByRole('button', { name: '探索をはじめる' }).tap();
    await hold('#tr', async () => (await px(page)) >= 400);
    await page.getByRole('button', { name: '調べる' }).tap();
    await page.locator('#ask .choice').first().tap();
    await expect(game(page)).toHaveAttribute('data-explore', '1');
    await shot(page, 'phone-map');
    expect(errors).toEqual([]);
  });
});

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('portrait: title and collage fit the screen', async ({ page }) => {
    await page.goto(URL);
    await shot(page, 'portrait-title');
    await page.evaluate(() => {
      const state = (0, eval)('f') as { hand: unknown[] };
      state.hand = ['誠実', '夢見がち', '律儀', '無邪気', '真面目', '根気強い', '図書館', '凝り性', 'ロマンチスト'].map((name, i) => ({ id: 'T' + i, name, attr: ['day', 'night', 'day', 'lamp', 'day', 'day', 'special', 'night', 'night'][i] }));
      (0, eval)('collage()');
    });
    await expect(game(page)).toHaveAttribute('data-screen', 'collage');
    for (const piece of await page.locator('#hand .piece').all()) {
      const box = (await piece.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(391);
      expect(box.y + box.height).toBeLessThanOrEqual(845);
    }
    await shot(page, 'portrait-collage');
  });
});

test('collage: drag a piece onto a square, drag between squares to swap', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    const state = (0, eval)('f') as { hand: unknown[] };
    state.hand = ['誠実', '夢見がち', '律儀', '無邪気', '真面目', '根気強い', '図書館', '凝り性', 'ロマンチスト'].map((name, i) => ({ id: 'T' + i, name, attr: ['day', 'night', 'day', 'lamp', 'day', 'day', 'special', 'night', 'night'][i] }));
    (0, eval)('collage()');
  });
  const dragTo = async (from: string, to: string) => {
    const a = (await page.locator(from).boundingBox())!, b = (await page.locator(to).boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
  };
  await dragTo('#hand .piece >> text=図書館', '.slot.center');
  await expect(page.locator('.slot.center')).toContainText('図書館');
  await dragTo('#hand .piece >> text=誠実', '.slot[data-slot="0"]');
  await dragTo('.slot[data-slot="0"] .piece', '.slot.center');
  await expect(page.locator('.slot.center')).toContainText('誠実');
  await expect(page.locator('.slot[data-slot="0"]')).toContainText('図書館');
  await shot(page, 'collage-drag');
});

test('dev report: the button opens a form, typing does not move yoiyami, the copied text has the state', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await skipToTutorial(page);
  await page.getByRole('button', { name: '意見・バグ' }).click();
  await expect(page.getByRole('dialog', { name: '意見・バグを書く（開発用）' })).toBeVisible();
  const before = await px(page);
  await page.locator('#reportText').fill('');
  await page.locator('#reportText').pressSequentially('ddd aaa テスト');
  expect(await px(page)).toBe(before);
  await page.getByLabel('こうした方がいい').check();
  await page.getByRole('button', { name: 'コピーする' }).click();
  await expect(page.locator('#reportDone')).toHaveText('コピーしました。Discord に貼ってください。');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('【よいやみ こうした方がいい】');
  expect(text).toContain('ddd aaa テスト');
  expect(text).toMatch(/版: v\d+\.\d+ /);
  expect(text).toContain('画面: 探索（チュートリアル・住宅街');
  await shot(page, 'report');
  await page.getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('#report')).toBeHidden();
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => px(page)).toBeGreaterThan(before + 50);
  await page.keyboard.up('ArrowRight');
});

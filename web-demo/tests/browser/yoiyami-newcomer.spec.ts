import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// 仕様を知らない人の目線で、画面の案内だけを頼りに進めた時の画面を残す（test-results/newcomer-*.png）。
// 歩く方向は、画面に出ている案内の矢印（◀ / ▶）だけで決める。
const URL = '/yoiyami/index.html';
const game = (page: Page) => page.locator('#game');
let n = 0;
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/newcomer-${String(++n).padStart(2, '0')}-${name}.png` });
const canAct = async (page: Page) => (await page.locator('#ta').isVisible()) || /Enter/.test(await page.locator('#hint').innerHTML());

/** 画面下の案内の矢印に従って、何か調べられる所に着くまで歩く。 */
async function followHint(page: Page): Promise<string> {
  for (let i = 0; i < 400; i++) {
    const hint = await page.locator('#hint').innerText();
    if (await canAct(page)) return hint;
    const key = hint.startsWith('◀') ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down('Shift'); await page.keyboard.down(key);
    await page.waitForTimeout(60);
    await page.keyboard.up(key); await page.keyboard.up('Shift');
  }
  throw new Error('案内に従っても何にも着かなかった');
}

test('newcomer: only following the on-screen guidance reaches an ending', async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(URL);
  await shot(page, 'title');
  await page.getByRole('button', { name: 'はじめから' }).click();
  // 会話は、画面の「次へ」の案内に従ってクリックで読む。選択肢は1つ目。
  const talk = async () => {
    for (let i = 0; i < 80 && (await game(page).getAttribute('data-screen')) === 'bench'; i++) {
      const choices = page.locator('#choices .choice');
      if (await choices.count()) { await choices.first().click(); continue; }
      if ((await page.locator('#tap').innerText()).includes('次へ')) await page.locator('#bench').click({ position: { x: 640, y: 120 } });
      await page.waitForTimeout(80);
    }
  };
  await page.waitForTimeout(2400);
  await shot(page, 'bench');
  await talk();
  await expect(game(page)).toHaveAttribute('data-screen', 'map');
  await page.waitForTimeout(2800);
  await talk();
  await shot(page, 'tutorial');
  await followHint(page);
  await shot(page, 'near-can');
  await page.keyboard.press('Enter');
  await page.locator('#ask .choice').first().click(); // ゴミ箱に捨てる
  await shot(page, 'carry');
  for (let i = 0; i < 200 && !(await canAct(page)); i++) {
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(60); await page.keyboard.up('ArrowRight');
  }
  await page.keyboard.press('Enter');
  await expect(game(page)).toHaveAttribute('data-screen', 'bench', { timeout: 10000 });
  await talk();
  await expect(page.locator('#howto')).toBeVisible();
  await shot(page, 'howto');
  await page.keyboard.press('Enter');
  await expect(page.locator('#howto')).toBeHidden();
  await shot(page, 'first-hint');
  // 9回、案内に従って調べる。看板に着いたら次の場所へ。
  let pieces = 0;
  for (let guard = 0; guard < 30 && pieces < 9; guard++) {
    const hint = await followHint(page);
    await page.keyboard.press('Enter');
    if (/へ行く/.test(hint)) { await page.waitForTimeout(700); await shot(page, `moved-${await game(page).getAttribute('data-map')}`); continue; }
    const ask = page.locator('#ask');
    await expect(ask).toBeVisible({ timeout: 12000 });
    const kick = page.getByRole('button', { name: '蹴る' });
    if (await kick.count()) await kick.click();
    else await ask.locator('.choice').first().click();
    await page.waitForTimeout(300);
    if (await ask.isVisible()) await ask.locator('.choice').first().click();
    pieces = Number(await game(page).getAttribute('data-explore'));
    if (pieces === 1 || pieces === 6) await shot(page, `piece-${pieces}`);
  }
  await expect(game(page)).toHaveAttribute('data-explore', '9');
  await expect(game(page)).toHaveAttribute('data-screen', 'bench', { timeout: 10000 });
  await talk();
  await expect(game(page)).toHaveAttribute('data-screen', 'collage');
  await shot(page, 'collage-start');
  for (let i = 0; i < 9; i++) {
    await page.locator('#hand .piece').first().click();
    if (i === 0) await shot(page, 'collage-picked');
    await page.locator('.slot:not(:has(.piece))').first().click();
  }
  await shot(page, 'collage-full');
  await page.getByRole('button', { name: '少女に渡す' }).click();
  await talk();
  await expect(game(page)).toHaveAttribute('data-screen', 'end');
  await page.waitForTimeout(1200);
  await shot(page, 'end-reading');
  // 何もしなくても文が進み、最後にボタンが出る
  await expect(page.locator('#back')).toBeVisible({ timeout: 25000 });
  await shot(page, 'end-done');
  expect(errors).toEqual([]);
});

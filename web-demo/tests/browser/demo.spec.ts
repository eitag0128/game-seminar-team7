import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function walkToMachine(page: Page): Promise<void> {
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.locator('#machine').isEnabled(), { intervals: [50] }).toBe(true);
  await page.keyboard.up('ArrowRight');
  await expect(page.getByRole('button', { name: '自販機を調べる' })).toBeEnabled();
}

test('normal play: loop, inspect mirror, wrong choice, repair, fragment, exit and replay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('#street canvas')).toBeVisible();
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.getByRole('dialog', { name: '遊び方' })).toBeVisible();
  await expect(page.locator('#guide')).toContainText('左側の缶の下のボタン');
  const initialX = await page.locator('#app').getAttribute('data-x');
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#app')).toHaveAttribute('data-x', initialX!);
  await page.screenshot({ path: 'test-results/tutorial.png' });
  await page.getByRole('button', { name: '街を歩く', exact: true }).click();
  await page.screenshot({ path: 'test-results/street-initial.png' });

  // Real keyboard movement crosses a whole street before opening the puzzle.
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#app')).toHaveAttribute('data-loops', '1', { timeout: 25000 });
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#app')).toHaveAttribute('data-fragments', '0');
  await walkToMachine(page);
  await expect(page.locator('#next-action')).toContainText('マウスでクリック');
  const beforeHelpX = await page.locator('#app').getAttribute('data-x');
  await page.getByRole('button', { name: '遊び方', exact: true }).click();
  await expect(page.locator('#guide')).toBeVisible();
  await page.getByRole('button', { name: 'ゲームに戻る' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-x', beforeHelpX!);
  await page.getByRole('button', { name: '自販機を調べる' }).click();
  await expect(page.getByRole('dialog', { name: '自動販売機' })).toBeVisible();
  await expect(page.locator('.puzzle-instruction')).toContainText('左側のボタン');
  const x = await page.locator('#app').getAttribute('data-x');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#app')).toHaveAttribute('data-x', x!);
  await page.keyboard.press('Escape');
  await expect(page.locator('#puzzle')).toBeHidden();
  await page.getByRole('button', { name: '自販機を調べる' }).click();
  await page.getByRole('button', { name: 'ソーダのスイッチ', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'puzzle');
  await expect(page.locator('#app')).toHaveAttribute('data-fragments', '0');
  await page.screenshot({ path: 'test-results/mirror-puzzle.png' });
  await page.getByRole('button', { name: 'ジュースのスイッチ', exact: true }).click();
  await expect(page.locator('#memory')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-repaired', 'true');
  await expect(page.locator('#app')).toHaveAttribute('data-fragments', '1');
  await page.screenshot({ path: 'test-results/memory-fragment.png' });
  await page.getByRole('button', { name: '街へ戻る' }).click();
  await expect(page.locator('#machine')).toBeHidden();
  await expect(page.locator('#next-action')).toContainText('街の右端の先へ');
  await page.screenshot({ path: 'test-results/street-repaired.png' });
  await page.keyboard.down('KeyD');
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'ending', { timeout: 25000 });
  await page.keyboard.up('KeyD');
  await expect(page.locator('#app')).toHaveAttribute('data-loops', '1');
  await expect(page.locator('#app')).toHaveAttribute('data-fragments', '1');
  await page.screenshot({ path: 'test-results/next-area.png' });
  await page.getByRole('button', { name: 'もう一度歩く' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'street');
  await expect(page.locator('#app')).toHaveAttribute('data-repaired', 'false');
  expect(errors).toEqual([]);
});

test('left wrap, A/D controls, focus loss and compact desktop layout', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/');
  const guideBox = await page.locator('#guide').boundingBox();
  expect(guideBox!.height).toBeLessThanOrEqual(600);
  await page.screenshot({ path: 'test-results/compact-tutorial.png' });
  await page.getByRole('button', { name: '街を歩く', exact: true }).click();
  await page.keyboard.down('KeyA');
  await expect(page.locator('#app')).toHaveAttribute('data-loops', '1', { timeout: 20000 });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const x = await page.locator('#app').getAttribute('data-x');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('#app')).toHaveAttribute('data-x', x!);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('ArrowLeft');
  await expect.poll(() => page.locator('#machine').isEnabled(), { intervals: [50] }).toBe(true);
  await page.keyboard.up('ArrowLeft');
  await page.getByRole('button', { name: '自販機を調べる' }).click();
  await expect(page.locator('#puzzle')).toBeVisible();
  const box = await page.locator('#puzzle').boundingBox();
  expect(box!.width).toBeLessThanOrEqual(800);
  expect(box!.height).toBeLessThanOrEqual(600);
  await page.screenshot({ path: 'test-results/compact-puzzle.png' });
  await page.getByRole('button', { name: 'パズルを閉じる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'street');
});

test('present mode: title card, sound, loop echoes, no written answer, time-only hint', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?mode=present');
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'present');
  await expect(page.getByRole('dialog', { name: 'Puzzle' })).toBeVisible();
  await expect(page.locator('#guide')).toBeHidden();
  await page.screenshot({ path: 'test-results/present-title.png' });
  await page.getByRole('button', { name: '歩きはじめる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'on');
  await expect(page.locator('#next-action')).toBeHidden();

  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#app')).toHaveAttribute('data-loops', '1', { timeout: 25000 });
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#thought')).toHaveText('……また、同じ場所。');
  await expect(page.locator('#app')).toHaveAttribute('data-last-sound', 'loop');
  await page.screenshot({ path: 'test-results/present-loop.png' });
  await walkToMachine(page);
  await page.getByRole('button', { name: '自販機を調べる' }).click();
  await expect(page.locator('#puzzle')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-last-sound', 'open');
  await expect(page.locator('.puzzle-instruction')).toBeHidden();
  await expect(page.locator('.puzzle-whisper')).toBeHidden();
  // A wrong switch still does nothing; the hint only arrives with time.
  await page.getByRole('button', { name: 'ソーダのスイッチ', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'puzzle');
  await expect(page.locator('#app')).not.toHaveAttribute('data-hint', /./);
  await expect(page.locator('#app')).toHaveAttribute('data-hint', '1', { timeout: 20000 });
  await expect(page.locator('.reflection .drink[data-odd]')).toHaveAttribute('data-drink', 'juice');
  await page.screenshot({ path: 'test-results/present-hint.png' });
  await expect(page.locator('#puzzle-murmur')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'ジュースのスイッチ', exact: true }).click();
  await expect(page.locator('#memory')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-last-sound', 'chime');
  await expect(page.locator('#memory-text')).not.toContainText('→ / D');
  await page.getByRole('button', { name: '街へ戻る' }).click();
  await expect(page.locator('#thought')).toHaveText('道の先が、ひらけている。');

  await page.getByRole('button', { name: '音 オン' }).click();
  await expect(page.getByRole('button', { name: '音 オフ' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'off');
  expect(errors).toEqual([]);
});

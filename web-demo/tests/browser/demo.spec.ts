import { test, expect } from '@playwright/test';
import { keyboard, playStage, readUntil, walkTo } from './stage.ts';

test('PC: guide, the three puzzles in order, sounds, stage clear and replay', async ({ page }) => {
  test.setTimeout(240000); // 3つの謎を歩いて解き、文も読むので長い
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('#street canvas')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '遊び方' })).toBeVisible();
  await page.screenshot({ path: 'test-results/pc-guide.png' });
  await page.getByRole('button', { name: '音ありではじめる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'on');
  await expect(page.locator('#brain .subtitle')).toHaveText('外に出た時、最初に目に入るのがシャッター街なのは少し安心する。');
  // 文を読む前は、自販機を調べられない。
  await expect(page.getByRole('button', { name: '自販機を調べる' })).toBeHidden();

  const walker = keyboard(page);
  await playStage(page, walker, 'pc');
  expect(await page.locator('#app').getAttribute('data-last-sound')).toBe('warp');
  await page.getByRole('button', { name: 'もう一度遊ぶ' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'intro');
  await expect(page.locator('#brain .grain')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('right edge is closed before the puzzles are solved; sound off works; guide reopens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '音なしではじめる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'off');
  const walker = keyboard(page);
  await readUntil(page, walker, 'machine');
  await walker.walk(1, () => expect(page.locator('#thought')).toHaveText('まだ先には進めない気がする。', { timeout: 20000 }));
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'street');
  await page.getByRole('button', { name: '遊び方', exact: true }).click();
  await expect(page.getByRole('button', { name: '音なしではじめる' })).toBeHidden();
  await page.getByRole('button', { name: 'ゲームに戻る' }).click();
  await walkTo(page, walker, 'machine');
  await page.getByRole('button', { name: '自販機を調べる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'choose');
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'off');
});

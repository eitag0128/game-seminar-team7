import { test, expect } from '@playwright/test';
import { keyboard, openTitle, playStage, playStory, readUntil, walkTo } from './stage.ts';

test('PC: title, guide, the three puzzles, the story to the park ending, and replay', async ({ page }) => {
  test.setTimeout(300000); // 3つの謎を歩いて解き、文も読むので長い
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('#street canvas')).toBeAttached();
  await page.screenshot({ path: 'test-results/pc-title.png' });
  await openTitle(page);
  await page.screenshot({ path: 'test-results/pc-guide.png' });
  await page.getByRole('button', { name: '音ありではじめる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'on');
  // 最初の文は頭の中で読む。
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'head');
  await expect(page.locator('#brain .subtitle')).toHaveText('外に出た時、最初に目に入るのがシャッター街なのは少し安心する。');
  // 文を読む前は、自販機を調べられない。
  await expect(page.getByRole('button', { name: '自販機を調べる' })).toBeHidden();

  const walker = keyboard(page);
  await playStage(page, walker, 'pc');
  await playStory(page, walker, true, 'pc');
  expect(await page.locator('#app').getAttribute('data-last-sound')).toBe('warp');
  await page.getByRole('button', { name: 'もう一度遊ぶ' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'intro');
  await expect(page.locator('#scene')).toBeHidden();
  await expect(page.locator('#brain .grain')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the street loops before the puzzles are solved; sound off works; guide reopens', async ({ page }) => {
  await page.goto('/');
  await openTitle(page);
  await page.getByRole('button', { name: '音なしではじめる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'off');
  const walker = keyboard(page);
  await readUntil(page, walker, 'machine');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'street');
  // 自分で頭の中を見て、戻れる。
  await page.getByRole('button', { name: '頭の中を見る' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'head');
  await page.getByRole('button', { name: '街に戻る' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'street');
  await walker.walk(1, () => expect(page.locator('#app')).toHaveAttribute('data-loops', '1', { timeout: 20000 }));
  await expect(page.locator('#thought')).toHaveText('あれ、さっきの場所に戻ってる。');
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'street');
  await page.screenshot({ path: 'test-results/pc-looped.png' });
  await page.getByRole('button', { name: '遊び方', exact: true }).click();
  await expect(page.getByRole('button', { name: '音なしではじめる' })).toBeHidden();
  await page.getByRole('button', { name: 'ゲームに戻る' }).click();
  await walkTo(page, walker, 'machine');
  await page.getByRole('button', { name: '自販機を調べる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'choose');
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'off');
});

import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// `npm run play` が作る、ダブルクリックで開く1ファイル版をサーバーなし（file://）で確かめる。
const playFile = join(import.meta.dirname, '..', '..', '..', 'play', 'Puzzle.html');

test.skip(!existsSync(playFile), 'npm run play で生成してから実行する');

test('double-click file: opens with the guide and plays without a server', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pathToFileURL(playFile).href);
  await expect(page.locator('#street canvas')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '遊び方' })).toBeVisible();
  await page.getByRole('button', { name: '音ありではじめる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'on');
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.locator('#machine').isEnabled(), { intervals: [50] }).toBe(true);
  await page.keyboard.up('ArrowRight');
  await page.getByRole('button', { name: '自販機を調べる' }).click();
  await page.getByRole('button', { name: 'ジュースのスイッチ', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-fragments', '1');
  expect(errors).toEqual([]);
});

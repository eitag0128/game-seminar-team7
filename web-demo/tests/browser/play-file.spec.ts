import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { keyboard, openTitle, readUntil, walkTo } from './stage.ts';

// `npm run play` が作る、ダブルクリックで開く1ファイル版をサーバーなし（file://）で確かめる。
const playFile = join(import.meta.dirname, '..', '..', '..', 'play', 'Puzzle.html');

test.skip(!existsSync(playFile), 'npm run play で生成してから実行する');

test('double-click file: opens with the guide and plays without a server', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pathToFileURL(playFile).href);
  await expect(page.locator('#street canvas')).toBeAttached();
  await openTitle(page);
  await page.getByRole('button', { name: '音ありではじめる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-sound', 'on');
  await readUntil(page, keyboard(page), 'machine');
  await walkTo(page, keyboard(page), 'machine');
  await page.getByRole('button', { name: '自販機を調べる' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'choose');
  expect(errors).toEqual([]);
});

// よいやみのダブルクリック版（play/Yoiyami.html）。絵と音を埋め込んであるので、サーバーなしで開ける。
const yoiyamiFile = join(import.meta.dirname, '..', '..', '..', 'play', 'Yoiyami.html');
test('double-click file: yoiyami opens, the character art is embedded, the tutorial starts', async ({ page }) => {
  test.skip(!existsSync(yoiyamiFile), 'npm run play で生成してから実行する');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pathToFileURL(yoiyamiFile).href);
  await page.getByRole('button', { name: 'はじめから' }).click();
  await page.getByRole('button', { name: '会話を飛ばす' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-screen', 'map');
  await expect.poll(() => page.locator('#player').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(64); // ドット絵（64×64）
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => Number(await page.locator('#game').getAttribute('data-px'))).toBeGreaterThan(400);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

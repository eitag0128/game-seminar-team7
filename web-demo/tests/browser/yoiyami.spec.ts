import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// よいやみ α版（public/yoiyami/index.html）を、序章 → チュートリアル → 9回探索 → コラージュ → エンドまで通す。
const file = pathToFileURL(join(import.meta.dirname, '..', '..', 'public', 'yoiyami', 'index.html')).href;

test('yoiyami: intro, tutorial, nine pieces, collage and an ending', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(file);
  await page.getByRole('button', { name: 'はじめる' }).click();
  const bench = page.locator('#bench');
  const choices = page.locator('#choices button');
  // 会話を、選択肢かマップが出るまでクリックで進める。
  async function talk(): Promise<void> {
    for (let i = 0; i < 40; i++) {
      if (await page.locator('#map').isVisible() || await page.locator('#collage').isVisible() || await page.locator('#end').isVisible()) return;
      if (await choices.count()) { await choices.first().click(); continue; }
      await bench.click({ position: { x: 20, y: 20 } });
      await page.waitForTimeout(60);
    }
  }
  await page.waitForTimeout(1800);
  await talk();
  // チュートリアル: 空き缶を蹴とばす。
  const walkTo = async (x: number) => {
    for (let i = 0; i < 200; i++) {
      const px = await page.evaluate(() => Number(document.querySelector<HTMLElement>('#player')?.style.left.replace('px', '') ?? 0));
      if (Math.abs(px - x) < 30) break;
      const key = px < x ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(key); await page.waitForTimeout(60); await page.keyboard.up(key);
    }
  };
  await walkTo(700);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '蹴とばす' }).click();
  await page.waitForTimeout(3200);
  await talk();
  await expect(page.locator('#map')).toBeVisible();
  // 住宅街の5つ（2択の物）を順に調べる。
  for (const x of [300, 620, 940, 1260, 1580]) {
    await walkTo(x);
    await page.keyboard.press('Enter');
    await page.locator('#mapChoices button').first().click();
    await page.waitForTimeout(300);
  }
  await walkTo(2200); await page.keyboard.press('Enter'); await page.locator('#mapChoices button').first().click();
  // 公園へ
  await walkTo(2480); await page.keyboard.press('Enter');
  await expect(page.locator('#place')).toHaveText('公園');
  for (const x of [300, 580, 860]) {
    await walkTo(x);
    await page.keyboard.press('Enter');
    await page.locator('#mapChoices button').first().click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: 'test-results/yoiyami-map.png' });
  await page.waitForTimeout(2600);
  await talk();
  await expect(page.locator('#collage')).toBeVisible();
  for (let i = 0; i < 9; i++) {
    await page.locator('#hand [data-hand]').first().click();
    await page.locator('.slot:not(:has(.piece))').first().click();
  }
  await page.screenshot({ path: 'test-results/yoiyami-collage.png' });
  await page.getByRole('button', { name: '少女に渡す' }).click();
  await talk();
  await expect(page.locator('#end h2')).not.toBeEmpty();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/yoiyami-end.png' });
  expect(errors).toEqual([]);
});

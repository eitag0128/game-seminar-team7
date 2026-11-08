import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openTitle, playStage, playStory, readUntil, touch } from './stage.ts';

// スマホ（タッチ・指で長押し）で最後まで遊べることを、横向きと縦向きで確かめる。
async function inside(page: Page, locator: Locator, area?: Locator): Promise<void> {
  const box = (await locator.boundingBox())!;
  const frame = area ? (await area.boundingBox())! : { x: 0, y: 0, ...page.viewportSize()! };
  expect(box.x).toBeGreaterThanOrEqual(frame.x - 1);
  expect(box.y).toBeGreaterThanOrEqual(frame.y - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
}

test.describe('phone landscape', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('touch only: walk with ◀ ▶, tap objects, drag the wire, go home ending', async ({ page }) => {
    test.setTimeout(300000); // 3つの謎を歩いて解き、文も読むので長い
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-input', 'touch');
    await openTitle(page, touch(page));
    await expect(page.getByText('画面の下の ◀ ▶ を押している間、左右に歩きます。')).toBeVisible();
    await page.getByRole('button', { name: '音なしではじめる' }).tap();
    await expect(page.locator('#next-action')).toContainText('タップ');
    await playStage(page, touch(page), 'phone');
    await playStory(page, touch(page), false, 'phone');
    expect(errors).toEqual([]);
  });
});

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('portrait: head and street each fill the screen, everything fits', async ({ page }) => {
    await page.goto('/');
    await openTitle(page, touch(page));
    expect((await page.locator('#guide').boundingBox())!.width).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: '音なしではじめる' }).tap();
    await inside(page, page.locator('#brain .subtitle'));
    await inside(page, page.getByRole('button', { name: '遊び方' }));
    await page.screenshot({ path: 'test-results/phone-portrait-head.png' });
    await readUntil(page, touch(page), 'machine');
    await inside(page, page.getByRole('button', { name: '右へ歩く' }));
    await inside(page, page.getByRole('button', { name: '頭の中を見る' }));
    await inside(page, page.locator('#next-action'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/phone-portrait-street.png' });
  });
});

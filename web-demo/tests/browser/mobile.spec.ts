import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { playStage, touch } from './stage.ts';

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

  test('touch only: walk with ◀ ▶, tap objects, drag the wire, clear the stage', async ({ page }) => {
    test.setTimeout(240000); // 3つの謎を歩いて解き、文も読むので長い
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-input', 'touch');
    await expect(page.getByText('左の画面の下にある ◀ ▶ を押している間、左右に歩きます。')).toBeVisible();
    await page.getByRole('button', { name: '音なしではじめる' }).tap();
    const reality = page.locator('#reality');
    await inside(page, page.getByRole('button', { name: '右へ歩く' }), reality);
    await inside(page, page.getByRole('button', { name: '左へ歩く' }), reality);
    await expect(page.locator('#next-action')).toContainText('タップ');
    await playStage(page, touch(page), 'phone');
    expect(errors).toEqual([]);
  });
});

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('portrait: street on top, head below, everything fits', async ({ page }) => {
    await page.goto('/');
    expect((await page.locator('#guide').boundingBox())!.width).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: '音なしではじめる' }).tap();
    const reality = (await page.locator('#reality').boundingBox())!;
    const brain = (await page.locator('#brain').boundingBox())!;
    expect(brain.y).toBeGreaterThanOrEqual(reality.y + reality.height - 2);
    await inside(page, page.getByRole('button', { name: '右へ歩く' }), page.locator('#reality'));
    await inside(page, page.getByRole('button', { name: '遊び方' }), page.locator('#reality'));
    await inside(page, page.locator('#brain .subtitle'), page.locator('#brain'));
    await page.screenshot({ path: 'test-results/phone-portrait.png' });
  });
});

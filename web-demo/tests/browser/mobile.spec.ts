import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// スマホ（タッチ・指で長押し）で最後まで遊べることを、横向きと縦向きで確かめる。
async function hold(button: Locator, until: () => Promise<unknown>): Promise<void> {
  await button.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true });
  await until();
  await button.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true });
}

async function inViewport(page: Page, locator: Locator): Promise<void> {
  const box = (await locator.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

test.describe('phone landscape', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('touch: guide for touch, walk with ◀ ▶, tap machine, solve, reach the end', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-input', 'touch');
    await expect(page.getByText('画面下の ◀ ▶ を押している間、左右に歩きます。')).toBeVisible();
    await expect(page.locator('#guide kbd').first()).toBeHidden();
    await page.screenshot({ path: 'test-results/phone-guide.png' });
    await page.getByRole('button', { name: '音なしではじめる' }).tap();
    // 終了画面では ◀ ▶ が消えるので、役割名ではなく id で押し続ける。
    const right = page.locator('#touch-right');
    await expect(right).toBeVisible();
    await inViewport(page, right);
    await inViewport(page, page.getByRole('button', { name: '左へ歩く' }));
    await expect(page.locator('#next-action')).toContainText('◀ ▶ で歩けます');
    await page.screenshot({ path: 'test-results/phone-street.png' });

    await hold(right, () => expect.poll(() => page.locator('#machine').isEnabled(), { intervals: [50] }).toBe(true));
    await expect(page.locator('#next-action')).toContainText('タップすると調べられます');
    await page.getByRole('button', { name: '自販機を調べる' }).tap();
    await expect(page.locator('#puzzle')).toBeVisible();
    expect(await page.locator('.puzzle-whisper').innerText()).not.toContain('Esc');
    await page.screenshot({ path: 'test-results/phone-puzzle.png' });
    await page.getByRole('button', { name: 'ソーダのスイッチ', exact: true }).tap();
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'puzzle');
    await page.getByRole('button', { name: 'ジュースのスイッチ', exact: true }).tap();
    await expect(page.locator('#memory')).toBeVisible();
    expect(await page.locator('#memory-text').innerText()).toContain('▶ で右端まで');
    await page.getByRole('button', { name: '街へ戻る' }).tap();
    await hold(right, () => expect(page.locator('#app')).toHaveAttribute('data-phase', 'ending', { timeout: 25000 }));
    await expect(page.getByRole('dialog', { name: 'デモはここまで' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('portrait: dialogs fit the width and the street shows enough of the road', async ({ page }) => {
    await page.goto('/');
    const guideBox = (await page.locator('#guide').boundingBox())!;
    expect(guideBox.width).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: '音なしではじめる' }).tap();
    await inViewport(page, page.getByRole('button', { name: '右へ歩く' }));
    await inViewport(page, page.getByRole('button', { name: '遊び方' }));
    await page.screenshot({ path: 'test-results/phone-portrait-street.png' });
    await hold(page.getByRole('button', { name: '右へ歩く' }), () => expect.poll(() => page.locator('#machine').isEnabled(), { intervals: [50] }).toBe(true));
    await page.getByRole('button', { name: '自販機を調べる' }).tap();
    const puzzleBox = (await page.locator('#puzzle').boundingBox())!;
    expect(puzzleBox.width).toBeLessThanOrEqual(390);
    await inViewport(page, page.getByRole('button', { name: 'ジュースのスイッチ', exact: true }));
    await page.screenshot({ path: 'test-results/phone-portrait-puzzle.png' });
  });
});

import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** ブラウザ試験の共通手順。ステージ1を最初から最後まで、普通の操作で進める。 */
export const OBJECT_X = { machine: -10, pole: 1, manhole: 10 } as const;
type ObjectId = keyof typeof OBJECT_X;

export interface Walker {
  /** direction 方向へ歩き続け、until が満たされたら止まる。 */
  walk(direction: 1 | -1, until: () => Promise<unknown>): Promise<void>;
  /** ボタンを押す（PC はクリック、スマホはタップ）。 */
  press(target: Locator): Promise<void>;
}

export const keyboard = (page: Page): Walker => ({
  async walk(direction, until) {
    const key = direction > 0 ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    try { await until(); } finally { await page.keyboard.up(key); }
  },
  press: (target) => target.click(),
});

export const touch = (page: Page): Walker => ({
  async walk(direction, until) {
    const button = page.locator(direction > 0 ? '#touch-right' : '#touch-left');
    const init = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true };
    await button.dispatchEvent('pointerdown', init);
    try { await until(); } finally { await button.dispatchEvent('pointerup', init); }
  },
  press: (target) => target.tap(),
});

/** タイトルの「はじめる」を押して、遊び方を出す。 */
export async function openTitle(page: Page, walker?: Walker): Promise<void> {
  await expect(page.getByRole('region', { name: 'タイトル' })).toBeVisible();
  const start = page.getByRole('button', { name: 'はじめる', exact: true });
  if (walker) await walker.press(start); else await start.click();
  await expect(page.getByRole('dialog', { name: '遊び方' })).toBeVisible();
}

export async function step(page: Page): Promise<string | null> {
  return page.locator('#app').getAttribute('data-step');
}

/** 頭の中の文を、次の段階に進むまでクリック/タップで読み進める。 */
export async function readUntil(page: Page, walker: Walker, next: string): Promise<void> {
  const subtitle = page.locator('#brain .subtitle');
  for (let i = 0; i < 12 && (await step(page)) !== next; i++) {
    await walker.press(subtitle);
    await page.waitForTimeout(80);
  }
  await expect(page.locator('#app')).toHaveAttribute('data-step', next);
}

export async function walkTo(page: Page, walker: Walker, id: ObjectId): Promise<void> {
  const x = Number(await page.locator('#app').getAttribute('data-x'));
  const target = page.locator(`#inspect-${id}`);
  await walker.walk(x < OBJECT_X[id] ? 1 : -1, () => expect.poll(() => target.isEnabled(), { intervals: [50], timeout: 20000 }).toBe(true));
}

export async function dragWireIntoWater(page: Page): Promise<void> {
  const end = (await page.locator('#brain .wire-end').boundingBox())!;
  const pool = (await page.locator('#brain .pool').boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2);
  await page.mouse.down();
  await page.mouse.move(pool.x + pool.width / 2, pool.y + pool.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** 3つの謎を順に解いて、右端の先（ステージクリア）まで進む。shots を渡すと途中の画面を保存する。 */
export async function playStage(page: Page, walker: Walker, shots = ''): Promise<void> {
  const shot = async (name: string) => { if (shots) await page.screenshot({ path: `test-results/${shots}-${name}.png` }); };
  await shot('intro');
  await readUntil(page, walker, 'machine');
  await walkTo(page, walker, 'machine');
  await walker.press(page.getByRole('button', { name: '自販機を調べる' }));
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'choose');
  const can = page.getByRole('button', { name: '頭の中の缶' });
  for (let i = 0; i < 4; i++) await walker.press(can);
  await expect(page.locator('#app')).toHaveAttribute('data-grains', '4');
  await page.waitForTimeout(600);
  await shot('grains');
  // 頭の中から街に戻って、自販機で飲み物を選ぶ。
  await walker.press(page.getByRole('button', { name: '街に戻る' }));
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'street');

  await walker.press(page.getByRole('button', { name: '自販機を調べる' }));
  await expect(page.locator('#vending')).toBeVisible();
  await walker.press(page.getByRole('button', { name: 'コーラ' }));
  await expect(page.locator('#vending-comment')).toHaveText('それは好きじゃない。');
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'choose');
  await shot('vending');
  await walker.press(page.getByRole('button', { name: 'コーンスープ' }));
  await expect(page.locator('#vending')).toBeHidden();
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'pour');

  await walker.press(can);
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'drained');
  await page.waitForTimeout(2200);
  await shot('drained');
  await readUntil(page, walker, 'manhole');
  await walkTo(page, walker, 'manhole');
  await walker.press(page.getByRole('button', { name: 'マンホールを調べる' }));
  await expect(page.locator('#slide')).toBeVisible();
  await shot('slide');
  for (const index of [1, 4, 5, 8]) await walker.press(page.locator(`#slide-board [data-index="${index}"]`));
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'flooded');
  await page.waitForTimeout(3000);
  await shot('flooded');

  await readUntil(page, walker, 'pole');
  await walkTo(page, walker, 'pole');
  await walker.press(page.getByRole('button', { name: '電柱を調べる' }));
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'wire');
  await page.waitForTimeout(1200);
  await shot('wire');
  await dragWireIntoWater(page);
  await expect(page.locator('#app')).toHaveAttribute('data-step', 'shocked');
  await page.waitForTimeout(1300);
  await shot('shocked');
  await readUntil(page, walker, 'exit');
  await walker.walk(1, () => expect(page.locator('#app')).toHaveAttribute('data-phase', 'ending', { timeout: 30000 }));
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'event');
  await shot('event');
}

/** 話の文をクリック/タップで読み進め、done が見えるまで待つ。 */
async function readSceneUntil(page: Page, walker: Walker, done: Locator): Promise<void> {
  const line = page.locator('#scene .subtitle');
  for (let i = 0; i < 30 && !(await done.isVisible()); i++) {
    if (await line.isVisible()) await walker.press(line);
    await page.waitForTimeout(250);
  }
  await expect(done).toBeVisible();
}

/** ステージ1の後の話（仮）。follow なら友達を追いかけて公園へ、そうでなければ帰る。 */
export async function playStory(page: Page, walker: Walker, follow: boolean, shots = ''): Promise<void> {
  const shot = async (name: string) => { if (shots) await page.screenshot({ path: `test-results/${shots}-${name}.png` }); };
  const cat = page.getByRole('button', { name: '猫', exact: true });
  await readSceneUntil(page, walker, cat);
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'alley');
  await shot('alley');
  for (let i = 0; i < 3; i++) {
    await walker.press(cat);
    await page.waitForTimeout(600);
  }
  const choice = page.getByRole('button', { name: follow ? '追いかける' : '何も見なかったことにして帰る' });
  await readSceneUntil(page, walker, choice);
  await shot('choice');
  await walker.press(choice);
  if (follow) {
    const board = page.locator('#scene .slide-board');
    await readSceneUntil(page, walker, board);
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'park');
    await shot('park');
    for (const index of [1, 4, 5, 8]) await walker.press(board.locator(`[data-index="${index}"]`));
  }
  const ending = page.getByRole('dialog', { name: follow ? 'エンディング1 仲直り' : 'エンディング2 何も変わらない' });
  await readSceneUntil(page, walker, ending);
  await expect(page.locator('#app')).toHaveAttribute('data-ending', follow ? 'friend' : 'home');
  await shot('ending');
}

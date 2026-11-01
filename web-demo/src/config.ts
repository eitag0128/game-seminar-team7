/** PROTOTYPE: ステージ1（プランナー案 2026-10-31）の仮設定。位置・速さ・飲み物は差し替え前提。 */
export const DEMO = {
  // 現実の街は x = -18〜18。謎を3つ解くまでは右端で止まり、解いた後は右端の先へ出られる。
  streetLength: 36,
  startX: -15,
  walkSpeed: 4.6,
  interactionDistance: 2.7,
  nextAreaDistance: 6,
  viewHeight: 13,
  // 縦長のスマホ画面でも、街を最低この幅だけ横に見せる（足りない分は上下に広げる）。
  minViewWidth: 12,
  rainCount: 220,
  // 少女の立ち絵の高さ（傘の先から靴まで）。自販機は約2.95。
  girlHeight: 2.9,
  // 現実で調べる物の位置（x）。左から 自販機 → 電柱 → マンホール。
  objects: { machine: -10, pole: 1, manhole: 10 },
  // 頭の中の文を1行ずつ出す間隔。文をクリック/タップすると次へ進む。
  narrationSeconds: 3.2,
} as const;

export const DRINKS = [
  { id: 'cola', name: 'コーラ', color: '#b94e4a' },
  { id: 'tea', name: 'お茶', color: '#c6b877' },
  { id: 'coffee', name: 'コーヒー', color: '#8a6a52' },
  { id: 'orange', name: 'オレンジ', color: '#e39a3b' },
  { id: 'soda', name: 'ソーダ', color: '#72b9cf' },
  { id: 'corn', name: 'コーンスープ', color: '#f0d264' },
] as const;

export type DrinkId = (typeof DRINKS)[number]['id'];
export type ObjectId = keyof typeof DEMO.objects;

/** 頭の中の缶から飛ぶ黄色い粒（コーン）から連想して選ぶ飲み物。 */
export const ANSWER_DRINK: DrinkId = 'corn';

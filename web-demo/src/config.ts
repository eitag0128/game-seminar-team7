/** PROTOTYPE: PM回答の未決定部分。正式ルール・サンプル画像の再現ではない。 */
export const DEMO = {
  streetLength: 36,
  startX: -6,
  machineX: 1.6,
  walkSpeed: 4.6,
  interactionDistance: 2.7,
  nextAreaDistance: 6,
  viewHeight: 13,
  // 縦長のスマホ画面でも、街を最低この幅だけ横に見せる（足りない分は上下に広げる）。
  minViewWidth: 12,
  rainCount: 220,
  // 少女の立ち絵の高さ（傘の先から靴まで）。自販機は約2.95。
  girlHeight: 2.9,
  drinks: [
    { id: 'soda', name: 'ソーダ', color: '#72b9cf', reflectionColor: '#72b9cf' },
    { id: 'tea', name: 'お茶', color: '#c6b877', reflectionColor: '#c6b877' },
    { id: 'juice', name: 'ジュース', color: '#d5949d', reflectionColor: '#8caacc' },
    { id: 'coffee', name: 'コーヒー', color: '#a896bf', reflectionColor: '#a896bf' },
  ],
} as const;

export type DrinkId = (typeof DEMO.drinks)[number]['id'];

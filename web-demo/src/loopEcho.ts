/** PROTOTYPE: ループに気づくための街の小さな変化。正式な演出仕様ではない。 */
export const SIGNS = ['喫茶  月灯', 'あおい商店', '古書  雨音', 'ひかり写真館', '夜 凪 商 店 街'] as const;

// ループするたびに、看板の文字が [看板, 文字位置] の順で1文字ずつ消える。
const FADE_ORDER = [[1, 2], [2, 4], [3, 4], [0, 4], [4, 2], [1, 4], [3, 1], [2, 1]] as const;

/** 同じ黒猫が、自販機を見つめて座り始めるループ回数。 */
export const CAT_FROM_LOOP = 2;

const WHISPERS = [
  '……また、同じ場所。',
  'さっきも、ここを通った気がする。',
  '看板の文字が、ひとつ足りない。',
  'この街は、何かが欠けている。',
];

export function fadedSigns(loops: number): string[] {
  const signs = SIGNS.map((sign) => [...sign]);
  for (const [sign, char] of FADE_ORDER.slice(0, Math.max(0, loops))) signs[sign][char] = '　';
  return signs.map((chars) => chars.join(''));
}

export function loopWhisper(loops: number): string {
  return WHISPERS[Math.min(Math.max(loops, 1), WHISPERS.length) - 1];
}

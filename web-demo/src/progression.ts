import { ANSWER_DRINK, DEMO } from './config.ts';
import type { DrinkId, ObjectId } from './config.ts';

/**
 * ステージ1の進行（プランナー案 2026-10-31）。
 * intro: 頭の中の文 → machine: 自販機を調べる → choose: 頭の中の缶から粒、自販機でコーンスープを選ぶ
 * → pour: 頭の中の缶をクリック → drained: 中身が全部流れる → manhole: マンホールのパズル
 * → flooded: 水がたまり魚が出る → pole: 電柱を調べる → wire: 電線の先を水へ → shocked: 魚が感電
 * → exit: 右端から先へ。
 */
export type Step = 'intro' | 'machine' | 'choose' | 'pour' | 'drained' | 'manhole' | 'flooded' | 'pole' | 'wire' | 'shocked' | 'exit';
/** street: 街を歩ける / vending・slide: 拡大画面 / beyond: 右端の先 / ending: ステージクリア */
export type Phase = 'street' | 'vending' | 'slide' | 'beyond' | 'ending';

export interface GameState {
  x: number;
  facing: number;
  moving: boolean;
  step: Step;
  phase: Phase;
  /** 頭の中の缶から出した黄色い粒の数（ヒント。進行には必要ない）。 */
  grains: number;
  /** 謎を解く前に右端に着いた（main.ts が一言出すのに使う）。 */
  blocked: boolean;
}

export function createGame(): GameState {
  return { x: DEMO.startX, facing: 1, moving: false, step: 'intro', phase: 'street', grains: 0, blocked: false };
}

/** 今の段階で、現実の街で調べられる物。 */
export function activeObject(state: GameState): ObjectId | null {
  switch (state.step) {
    case 'machine': case 'choose': return 'machine';
    case 'manhole': return 'manhole';
    case 'pole': return 'pole';
    default: return null;
  }
}

export function nearObject(state: GameState, id: ObjectId): boolean {
  return Math.abs(state.x - DEMO.objects[id]) <= DEMO.interactionDistance;
}

export function canInspect(state: GameState, id: ObjectId): boolean {
  return state.phase === 'street' && activeObject(state) === id && nearObject(state, id);
}

export function inspect(state: GameState, id: ObjectId): GameState {
  if (!canInspect(state, id)) return state;
  const still = { ...state, moving: false };
  if (id === 'machine') return state.step === 'machine' ? { ...still, step: 'choose' } : { ...still, phase: 'vending' };
  if (id === 'manhole') return { ...still, phase: 'slide' };
  return { ...still, step: 'wire' };
}

export function closeDialog(state: GameState): GameState {
  return state.phase === 'vending' || state.phase === 'slide' ? { ...state, phase: 'street' } : state;
}

/** 違う飲み物は何も変わらない（一言だけ main.ts が出す）。 */
export function chooseDrink(state: GameState, id: DrinkId): GameState {
  if (state.phase !== 'vending') return state;
  return id === ANSWER_DRINK ? { ...state, phase: 'street', step: 'pour' } : state;
}

/** 頭の中の缶。choose では粒が1つ増え、pour では中身が注がれる。 */
export function clickCan(state: GameState): GameState {
  if (state.step === 'choose') return { ...state, grains: state.grains + 1 };
  if (state.step === 'pour') return { ...state, step: 'drained' };
  return state;
}

export function solveManhole(state: GameState): GameState {
  return state.phase === 'slide' && state.step === 'manhole' ? { ...state, phase: 'street', step: 'flooded' } : state;
}

export function dropWire(state: GameState, inWater: boolean): GameState {
  return state.step === 'wire' && inWater ? { ...state, step: 'shocked' } : state;
}

/** 頭の中の文を読み終えた時に次の段階へ進む。 */
export function narrationDone(state: GameState, step: Step): GameState {
  if (state.step !== step) return state;
  const next: Partial<Record<Step, Step>> = { intro: 'machine', drained: 'manhole', flooded: 'pole', shocked: 'exit' };
  const to = next[step];
  return to ? { ...state, step: to } : state;
}

export function move(state: GameState, direction: number, seconds: number): GameState {
  if (state.phase !== 'street' && state.phase !== 'beyond') return state;
  const input = Math.sign(direction);
  const next = { ...state, moving: input !== 0, facing: input || state.facing, blocked: false };
  next.x += input * DEMO.walkSpeed * Math.max(0, Math.min(seconds, 0.05));
  const edge = DEMO.streetLength / 2;
  next.x = Math.max(-edge, next.x);
  if (state.step === 'exit') {
    next.phase = next.x > edge ? 'beyond' : 'street';
    if (next.x >= edge + DEMO.nextAreaDistance) {
      next.phase = 'ending';
      next.moving = false;
    }
  } else if (next.x > edge) {
    next.x = edge;
    next.blocked = input > 0;
  }
  return next;
}

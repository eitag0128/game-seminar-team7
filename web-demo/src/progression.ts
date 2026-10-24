import { DEMO } from './config.ts';
import type { DrinkId } from './config.ts';

export type Phase = 'street' | 'puzzle' | 'memory' | 'beyond' | 'ending';
export interface GameState {
  x: number;
  facing: number;
  moving: boolean;
  loops: number;
  repaired: boolean;
  fragments: number;
  phase: Phase;
}

export function createGame(): GameState {
  return { x: DEMO.startX, facing: 1, moving: false, loops: 0, repaired: false, fragments: 0, phase: 'street' };
}

export function nearMachine(state: GameState): boolean {
  // Distance on the circular street also works when either object is near a seam.
  const distance = Math.abs(state.x - DEMO.machineX);
  return Math.min(distance, DEMO.streetLength - distance) <= DEMO.interactionDistance;
}

export function move(state: GameState, direction: number, seconds: number): GameState {
  if (state.phase !== 'street' && state.phase !== 'beyond') return state;
  const input = Math.sign(direction);
  const next = { ...state, moving: input !== 0, facing: input || state.facing };
  next.x += input * DEMO.walkSpeed * Math.max(0, Math.min(seconds, 0.05));
  const edge = DEMO.streetLength / 2;
  if (state.repaired) {
    // PROTOTYPE: the open route is the right-hand end. Left end becomes a boundary.
    next.x = Math.max(-edge, next.x);
    next.phase = next.x > edge ? 'beyond' : 'street';
    if (next.x >= edge + DEMO.nextAreaDistance) {
      next.phase = 'ending';
      next.moving = false;
    }
  } else if (next.x > edge) {
    next.x -= DEMO.streetLength;
    next.loops++;
  } else if (next.x < -edge) {
    next.x += DEMO.streetLength;
    next.loops++;
  }
  return next;
}

export function openPuzzle(state: GameState): GameState {
  return state.phase === 'street' && !state.repaired && nearMachine(state)
    ? { ...state, phase: 'puzzle', moving: false }
    : state;
}

export function closePuzzle(state: GameState): GameState {
  return state.phase === 'puzzle' ? { ...state, phase: 'street' } : state;
}

export function chooseDrink(state: GameState, id: DrinkId): GameState {
  const drink = DEMO.drinks.find((item) => item.id === id);
  // PM: an incorrect choice produces no response. Repair, item and unlock are atomic.
  return state.phase === 'puzzle' && drink && String(drink.color) !== String(drink.reflectionColor)
    ? { ...state, repaired: true, fragments: 1, phase: 'memory', moving: false }
    : state;
}

export function continueWalking(state: GameState): GameState {
  return state.phase === 'memory' ? { ...state, phase: 'street' } : state;
}

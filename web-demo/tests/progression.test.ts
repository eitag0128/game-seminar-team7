import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO } from '../src/config.ts';
import {
  canInspect, chooseDrink, clickCan, closeDialog, createGame, dropWire, inspect, move, narrationDone, solveManhole,
} from '../src/progression.ts';
import type { GameState } from '../src/progression.ts';
import { START, SOLVED, isSolved, movable, slideTile } from '../src/slide.ts';

const at = (state: GameState, id: keyof typeof DEMO.objects): GameState => ({ ...state, x: DEMO.objects[id] });

test('the whole stage runs in the planner order', () => {
  let state = createGame();
  assert.equal(state.step, 'intro');
  assert.equal(canInspect(at(state, 'machine'), 'machine'), false, 'nothing to inspect while the intro is read');
  state = narrationDone(state, 'intro');
  assert.equal(state.step, 'machine');

  state = inspect(at(state, 'machine'), 'machine');
  assert.equal(state.step, 'choose');
  state = clickCan(clickCan(state));
  assert.equal(state.grains, 2);
  state = inspect(state, 'machine');
  assert.equal(state.phase, 'vending');
  assert.deepEqual(chooseDrink(state, 'cola'), state, 'a wrong drink changes nothing');
  state = chooseDrink(state, 'corn');
  assert.deepEqual([state.step, state.phase], ['pour', 'street']);

  state = clickCan(state);
  assert.equal(state.step, 'drained');
  assert.equal(canInspect(at(state, 'manhole'), 'manhole'), false, 'manhole waits for the narration');
  state = narrationDone(state, 'drained');
  state = inspect(at(state, 'manhole'), 'manhole');
  assert.equal(state.phase, 'slide');
  state = solveManhole(state);
  assert.deepEqual([state.step, state.phase], ['flooded', 'street']);

  state = narrationDone(state, 'flooded');
  state = inspect(at(state, 'pole'), 'pole');
  assert.equal(state.step, 'wire');
  assert.equal(dropWire(state, false).step, 'wire', 'dropping outside the water does nothing');
  state = dropWire(state, true);
  assert.equal(state.step, 'shocked');
  state = narrationDone(state, 'shocked');
  assert.equal(state.step, 'exit');
});

test('objects only react in their own step and when the girl is near', () => {
  const state = { ...createGame(), step: 'manhole' as const };
  assert.equal(canInspect(at(state, 'machine'), 'machine'), false);
  assert.equal(canInspect({ ...state, x: DEMO.objects.manhole + DEMO.interactionDistance + 0.1 }, 'manhole'), false);
  assert.equal(canInspect(at(state, 'manhole'), 'manhole'), true);
  const opened = inspect(at(state, 'manhole'), 'manhole');
  assert.deepEqual(move(opened, 1, 0.05), opened, 'no walking while the puzzle is open');
  assert.equal(closeDialog(opened).phase, 'street');
});

test('stale narration callbacks do not skip steps', () => {
  const state = { ...createGame(), step: 'choose' as const };
  assert.deepEqual(narrationDone(state, 'intro'), state);
});

test('the right edge blocks until the stage is solved, then leads on to the end', () => {
  const edge = DEMO.streetLength / 2;
  let state = move({ ...createGame(), x: edge - 0.01 }, 1, 0.05);
  assert.equal(state.x, edge);
  assert.equal(state.blocked, true);
  assert.equal(state.phase, 'street');
  state = { ...state, step: 'exit' };
  for (let i = 0; i < 40; i++) state = move(state, 1, 0.05);
  assert.equal(state.phase, 'ending');
  assert.equal(move({ ...createGame(), x: -edge }, -1, 0.05).x, -edge, 'the left edge is a wall');
});

test('long frame gaps are clamped', () => {
  const initial = createGame();
  assert.ok(move(initial, 1, 600).x - initial.x <= DEMO.walkSpeed * 0.05 + 1e-8);
});

test('manhole slide puzzle: starts off by a few moves and solves by sliding into the gap', () => {
  assert.equal(isSolved(START), false);
  assert.equal(isSolved(SOLVED), true);
  assert.deepEqual(slideTile(START, 8), START, 'a tile not next to the gap does not move');
  assert.equal(movable(START, 1), true);
  const solved = [1, 4, 5, 8].reduce((board, index) => slideTile(board, index), START);
  assert.equal(isSolved(solved), true);
});

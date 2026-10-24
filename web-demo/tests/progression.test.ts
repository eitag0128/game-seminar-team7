import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO } from '../src/config.ts';
import { chooseDrink, closePuzzle, continueWalking, createGame, move, openPuzzle } from '../src/progression.ts';

const atMachine = () => ({ ...createGame(), x: DEMO.machineX });

test('the unsolved street wraps in both directions without acquiring a fragment', () => {
  for (const direction of [-1, 1]) {
    const start = { ...createGame(), x: direction * (DEMO.streetLength / 2 - 0.01) };
    const state = move(start, direction, 0.05);
    assert.equal(state.loops, 1);
    assert.equal(Math.sign(state.x), -direction);
    assert.equal(state.fragments, 0);
    assert.equal(state.repaired, false);
  }
});

test('opening requires proximity and blocks walking; closing preserves position', () => {
  assert.equal(openPuzzle(createGame()).phase, 'street');
  const puzzle = openPuzzle(atMachine());
  assert.equal(puzzle.phase, 'puzzle');
  assert.deepEqual(move(puzzle, 1, 0.05), puzzle);
  const closed = closePuzzle(puzzle);
  assert.equal(closed.phase, 'street');
  assert.equal(closed.x, DEMO.machineX);
  assert.equal(closed.fragments, 0);
});

test('a wrong switch has no effect; correct choice repairs and unlocks atomically', () => {
  const puzzle = openPuzzle(atMachine());
  for (const drink of DEMO.drinks) {
    const selected = chooseDrink(puzzle, drink.id);
    if (String(drink.color) === String(drink.reflectionColor)) assert.deepEqual(selected, puzzle);
    else {
      assert.equal(selected.phase, 'memory');
      assert.equal(selected.repaired, true);
      assert.equal(selected.fragments, 1);
      assert.deepEqual(chooseDrink(selected, drink.id), selected);
    }
  }
});

test('repair persists, puzzle cannot reopen, and right exit reaches the next area', () => {
  let state = continueWalking(chooseDrink(openPuzzle(atMachine()), 'juice'));
  assert.equal(openPuzzle(state).phase, 'street');
  state = { ...state, x: DEMO.streetLength / 2 - 0.01 };
  state = move(state, 1, 0.05);
  assert.equal(state.phase, 'beyond');
  assert.equal(state.loops, 0);
  assert.equal(state.fragments, 1);
  assert.equal(state.repaired, true);
  for (let i = 0; i < 40; i++) state = move(state, 1, 0.05);
  assert.equal(state.phase, 'ending');
  assert.equal(state.fragments, 1);
});

test('long frame gaps are clamped and fresh play resets all temporary progress', () => {
  const initial = createGame();
  const moved = move(initial, 1, 600);
  assert.ok(moved.x - initial.x <= DEMO.walkSpeed * 0.05 + 1e-8);
  assert.deepEqual(move(initial, 1, -1), { ...initial, moving: true });
  const reset = createGame();
  assert.equal(reset.repaired, false);
  assert.equal(reset.fragments, 0);
  assert.equal(reset.loops, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGNS, fadedSigns, loopWhisper } from '../src/loopEcho.ts';

test('signs are intact before the first loop and lose one more character per loop', () => {
  assert.deepEqual(fadedSigns(0), [...SIGNS]);
  let previous = fadedSigns(0);
  for (let loops = 1; loops <= 8; loops++) {
    const current = fadedSigns(loops);
    const changed = current.flatMap((sign, index) => [...sign].filter((char, at) => char !== [...previous[index]][at]));
    assert.deepEqual(changed, ['　'], `loop ${loops} removes exactly one character`);
    current.forEach((sign, index) => assert.equal([...sign].length, [...SIGNS[index]].length));
    previous = current;
  }
  assert.deepEqual(fadedSigns(30), fadedSigns(8));
});

test('loop whispers progress and then settle on the missing-piece hint', () => {
  assert.equal(loopWhisper(1), '……また、同じ場所。');
  assert.notEqual(loopWhisper(2), loopWhisper(1));
  assert.equal(loopWhisper(10), 'この街は、何かが欠けている。');
});

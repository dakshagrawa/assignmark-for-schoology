import test from 'node:test';
import assert from 'node:assert/strict';
import { createResetOperation } from '../src/reset-action.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('scoped reset ignores rapid reactivation and reports the actual cleared snapshot', async () => {
  let clearCalls = 0;
  let finishClear;
  const pending = [];
  const successes = [];
  const reset = createResetOperation({
    getExpectedStates: () => ({ alpha: 100, beta: 200 }),
    confirmAction: () => true,
    clear: () => {
      clearCalls += 1;
      return new Promise((resolve) => { finishClear = () => resolve({ states: { alpha: 100 }, versions: { alpha: 1 }, aliases: {} }); });
    },
    onPendingChange: (value) => pending.push(value),
    onSuccess: (snapshot, count) => successes.push({ snapshot, count })
  });

  void reset();
  void reset();
  assert.equal(clearCalls, 1);
  assert.deepEqual(pending, [true]);

  finishClear();
  await tick();

  assert.deepEqual(successes, [{
    snapshot: { states: { alpha: 100 }, versions: { alpha: 1 }, aliases: {} },
    count: 1
  }]);
  assert.deepEqual(pending, [true, false]);
});

test('scoped reset reports a conflict when no requested state was actually cleared', async () => {
  let zeroResults = 0;
  const reset = createResetOperation({
    getExpectedStates: () => ({ alpha: 100 }),
    confirmAction: () => true,
    clear: async () => ({ states: {}, versions: {}, aliases: {} }),
    onZeroResult: () => { zeroResults += 1; }
  });

  await reset();
  assert.equal(zeroResults, 1);
});

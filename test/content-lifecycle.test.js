import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentLifecycle } from '../src/content-lifecycle.js';

test('teardown completes every cleanup when an extension API cleanup throws', () => {
  const calls = [];
  const observer = { disconnect: () => calls.push('observer') };
  const lifecycle = createContentLifecycle({
    clearInterval: (id) => calls.push(`timer:${id}`),
    removeStorageListener: () => { calls.push('storage'); throw new Error('Extension context invalidated.'); },
    removeVisibilityListener: () => calls.push('visibility'),
    removeFocusListener: () => calls.push('focus')
  });

  lifecycle.trackTimer(17);
  lifecycle.trackObserver(observer);
  lifecycle.queueScan();
  lifecycle.stop();

  assert.deepEqual(calls, ['timer:17', 'observer', 'storage', 'visibility', 'focus']);
  assert.deepEqual(lifecycle.inspect(), {
    invalidated: true,
    hasTimer: false,
    hasObserver: false,
    scanQueued: false
  });
});

test('queueScan admits only one pending scan until it is consumed', () => {
  const lifecycle = createContentLifecycle({ clearInterval: () => {} });
  assert.equal(lifecycle.queueScan(), true);
  assert.equal(lifecycle.queueScan(), false);
  assert.equal(lifecycle.takeQueuedScan(), true);
  assert.equal(lifecycle.takeQueuedScan(), false);
  assert.equal(lifecycle.queueScan(), true);
});

test('teardown is idempotent and invalidated lifecycle cannot queue or install work', () => {
  const calls = [];
  const lifecycle = createContentLifecycle({
    clearInterval: (id) => calls.push(`timer:${id}`),
    removeStorageListener: () => calls.push('storage'),
    removeVisibilityListener: () => calls.push('visibility'),
    removeFocusListener: () => calls.push('focus')
  });

  lifecycle.stop();
  lifecycle.stop();
  assert.equal(lifecycle.queueScan(), false);
  assert.equal(lifecycle.trackTimer(23), false);
  assert.equal(lifecycle.trackObserver({ disconnect: () => calls.push('late-observer') }), false);
  assert.deepEqual(calls, ['storage', 'visibility', 'focus', 'timer:23', 'late-observer']);
});

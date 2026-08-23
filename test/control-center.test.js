import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VALID_FILTERS,
  isVisible,
  normalizeFilter,
  summarizeRenderedItems
} from '../src/control-center.js';

test('control center exposes the supported filters', () => {
  assert.deepEqual([...VALID_FILTERS], ['all', 'pending', 'done']);
});

test('control center normalizes invalid filters to all', () => {
  assert.equal(normalizeFilter('pending'), 'pending');
  assert.equal(normalizeFilter('surprise'), 'all');
  assert.equal(normalizeFilter(null), 'all');
});

test('control center summarizes unique rendered IDs', () => {
  const summary = summarizeRenderedItems([
    { id: 'a', checked: true },
    { id: 'a', checked: true },
    { id: 'b', checked: false },
    { id: '', checked: true },
    null
  ]);

  assert.deepEqual(summary, { total: 2, completed: 1, pending: 1 });
});

test('control center treats an ID as completed if any rendered instance is checked', () => {
  const summary = summarizeRenderedItems([
    { id: 'a', checked: false },
    { id: 'a', checked: true }
  ]);

  assert.deepEqual(summary, { total: 1, completed: 1, pending: 0 });
});

test('control center filters checked and pending items', () => {
  assert.equal(isVisible(true, 'all'), true);
  assert.equal(isVisible(false, 'all'), true);
  assert.equal(isVisible(true, 'pending'), false);
  assert.equal(isVisible(false, 'pending'), true);
  assert.equal(isVisible(true, 'done'), true);
  assert.equal(isVisible(false, 'done'), false);
  assert.equal(isVisible(true, 'invalid'), true);
});

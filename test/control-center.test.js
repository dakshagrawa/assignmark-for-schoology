import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  VALID_FILTERS,
  appearanceForItem,
  isVisible,
  normalizeFilter,
  summarizeRenderedItems,
  createControlCenter
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

test('filter is the sole visibility authority while dim stays independent', () => {
  assert.deepEqual(
    appearanceForItem(true, { filter: 'all', hide: true, dim: true }),
    { visible: true, dimmed: true }
  );
  assert.deepEqual(
    appearanceForItem(true, { filter: 'pending', hide: false, dim: false }),
    { visible: false, dimmed: false }
  );
  assert.deepEqual(
    appearanceForItem(false, { filter: 'done', hide: false, dim: true }),
    { visible: false, dimmed: false }
  );
});

test('control center DOM component renders progress and filters', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const callbacks = {
    onFilterChange: () => {},
    onDimChange: () => {},
    onClearView: () => {},
    onClearAll: () => {}
  };
  const controlCenter = createControlCenter(dom.window.document, callbacks);
  const element = controlCenter.element;

  assert.ok(element.querySelector('[data-role="progress"]'));
  assert.ok(element.querySelector('[data-role="filters"]'));
  assert.ok(element.querySelector('[data-filter="all"]'));
  assert.ok(element.querySelector('[data-filter="pending"]'));
  assert.ok(element.querySelector('[data-filter="done"]'));
  assert.ok(element.querySelector('[data-role="clear-view"]'));
  assert.ok(element.querySelector('[data-role="clear-all"]'));
  assert.ok(element.querySelector('[data-role="dim"]'));
  // undo button exists but is hidden initially
  assert.ok(element.querySelector('[data-role="undo"]'));
});

test('control center DOM component updates filter pressed state on render', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: () => {},
    onDimChange: () => {},
    onClearView: () => {},
    onClearAll: () => {}
  });

  controlCenter.render({ filter: 'pending', dim: false, total: 3, completed: 1 });

  const buttons = controlCenter.element.querySelectorAll('[data-filter]');
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  assert.equal(buttons[2].getAttribute('aria-pressed'), 'false');
  assert.equal(controlCenter.element.querySelector('[data-role="dim"]').getAttribute('aria-pressed'), 'false');
});

test('control center DOM component shows Undo after clear action', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: () => {},
    onDimChange: () => {},
    onClearView: () => {},
    onClearAll: () => {}
  });

  // undo button exists initially but is hidden
  const undoBtn = controlCenter.element.querySelector('[data-role="undo"]');
  assert.ok(undoBtn);
  assert.ok(undoBtn.hidden);

  controlCenter.showUndo(true);
  assert.ok(!undoBtn.hidden);

  controlCenter.showUndo(false);
  assert.ok(undoBtn.hidden);
});

test('control center DOM component prevents duplicate elements on repeated render', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: () => {},
    onDimChange: () => {},
    onClearView: () => {},
    onClearAll: () => {}
  });

  controlCenter.render({ filter: 'all', total: 1, completed: 0 });
  controlCenter.render({ filter: 'all', total: 1, completed: 0 });

  assert.equal(controlCenter.element.querySelectorAll('[data-role="progress"]').length, 1);
  assert.equal(controlCenter.element.querySelectorAll('[data-filter]').length, 3);
});

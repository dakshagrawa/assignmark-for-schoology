import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  VALID_FILTERS,
  appearanceForItem,
  isVisible,
  normalizeFilter,
  summarizeRenderedItems,
  createControlCenter,
  isDarkColor
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

test('control center DOM component renders progress and focused calendar actions', () => {
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
  assert.ok(element.querySelector('[data-role="hide-done"]'));
  assert.ok(element.querySelector('[data-role="clear-view"]'));
  assert.ok(element.querySelector('[data-role="dim"]'));
  // undo button exists but is hidden initially
  assert.ok(element.querySelector('[data-role="undo"]'));
});

test('calendar rail detects dark Schoology surfaces from their computed color', () => {
  assert.equal(isDarkColor('rgb(48, 51, 57)'), true);
  assert.equal(isDarkColor('rgba(39, 39, 41, 0.9)'), true);
  assert.equal(isDarkColor('rgb(245, 245, 247)'), false);
  assert.equal(isDarkColor('transparent'), false);
});

test('calendar rail restores the focused v2.0-style three-control format', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const controlCenter = createControlCenter(dom.window.document, {});
  const element = controlCenter.element;

  assert.equal(element.getAttribute('role'), 'toolbar');
  assert.equal(element.querySelectorAll('.sc-cc-primary').length, 3);
  assert.ok(element.querySelector('[data-role="hide-done"]'));
  assert.ok(element.querySelector('[data-role="dim"]'));
  assert.ok(element.querySelector('[data-role="clear-view"]'));
  assert.equal(element.querySelector('[data-role="hide-done"] span').textContent, 'Hide done');
  assert.equal(element.querySelector('[data-role="dim"] span').textContent, 'Fade done');
  assert.equal(element.querySelector('[data-role="clear-view"] span').textContent, 'Reset view');
  assert.equal(element.querySelector('[data-role="clear-all"]'), null);
  assert.equal(element.querySelector('[data-role="filters"]'), null);
  assert.equal(element.querySelector('.sc-cc-toggle'), null);
});

test('control center DOM component renders compact progress with a full accessible description', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const controlCenter = createControlCenter(dom.window.document, {});

  controlCenter.render({ filter: 'all', dim: false, total: 23, completed: 0 });

  const progress = controlCenter.element.querySelector('[data-role="progress"]');
  assert.equal(progress.textContent, '0/23');
  assert.equal(progress.getAttribute('aria-label'), '0 of 23 current-view items completed');
  assert.equal(progress.title, '0 of 23 current-view items completed');
});

test('control center DOM component maps pending filter to the Hide done control', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: () => {},
    onDimChange: () => {},
    onClearView: () => {},
    onClearAll: () => {}
  });

  controlCenter.render({ filter: 'pending', dim: false, total: 3, completed: 1 });

  const hideDone = controlCenter.element.querySelector('[data-role="hide-done"]');
  assert.equal(hideDone.getAttribute('aria-pressed'), 'true');
  assert.equal(hideDone.querySelector('span').textContent, 'Hide done');
  assert.equal(controlCenter.element.querySelector('[data-role="dim"]').getAttribute('aria-pressed'), 'false');
});

test('calendar rail derives readable foreground tokens for extreme custom accents', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const controlCenter = createControlCenter(dom.window.document, {});

  controlCenter.render({ filter: 'all', dim: true, total: 1, completed: 1, accentColor: '#ffffff' });

  assert.equal(controlCenter.element.style.getPropertyValue('--sc-assignmark-accent-foreground'), '#000000');
});

test('current-view reset stays disabled while a reset is pending', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const controlCenter = createControlCenter(dom.window.document, {});
  const resetView = controlCenter.element.querySelector('[data-role="clear-view"]');

  controlCenter.render({ filter: 'all', dim: true, total: 3, completed: 2, resetPending: true });

  assert.equal(resetView.disabled, true);
  assert.equal(resetView.getAttribute('aria-busy'), 'true');
});

test('current-view reset explains its scope and disables itself when there is nothing to reset', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const controlCenter = createControlCenter(dom.window.document, {});
  const resetView = controlCenter.element.querySelector('[data-role="clear-view"]');

  controlCenter.render({ filter: 'all', dim: true, total: 23, completed: 0 });
  assert.equal(resetView.disabled, true);
  assert.equal(resetView.textContent.trim(), 'Reset view');
  assert.equal(resetView.title, 'No completed items in this calendar view.');

  controlCenter.render({ filter: 'all', dim: true, total: 23, completed: 2 });
  assert.equal(resetView.disabled, false);
  assert.equal(resetView.title, 'Remove checkmarks only from completed items visible in this calendar view.');
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
  assert.equal(controlCenter.element.querySelectorAll('.sc-cc-primary').length, 3);
});

test('control center applies visibility, percentage scale, and move overlay settings', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const calls = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onLockPosition: () => calls.push('lock'),
    onPositionChange: (position) => calls.push(position)
  });
  controlCenter.render({ filter: 'all', total: 3, completed: 1, controlScale: 120, showHideDone: false, showFadeDone: true, showResetView: true, moveMode: true });
  assert.equal(controlCenter.element.querySelector('[data-role="hide-done"]').hidden, true);
  assert.equal(controlCenter.element.querySelector('.sc-cc-move-overlay').hidden, false);
  assert.equal(controlCenter.element.style.getPropertyValue('--sc-control-scale'), '1.2');
  controlCenter.element.querySelector('.sc-cc-lock').click();
  assert.deepEqual(calls, ['lock']);
});

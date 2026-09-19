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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

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
  assert.equal(element.querySelector('[data-role="hide-done"] span').textContent, 'Hide');
  assert.equal(element.querySelector('[data-role="dim"] span').textContent, 'Dim');
  assert.equal(element.querySelector('[data-role="clear-view"] span').textContent, 'Clear');
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
  assert.equal(hideDone.querySelector('span').textContent, 'Show');
  assert.equal(controlCenter.element.querySelector('[data-role="dim"]').getAttribute('aria-pressed'), 'false');
});

test('rail actions are isolated from Schoology page event handlers', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const filters = [];
  let pageClicks = 0;
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: (filter) => filters.push(filter)
  });
  dom.window.document.body.appendChild(controlCenter.element);
  dom.window.document.addEventListener('click', () => { pageClicks += 1; });
  controlCenter.render({ filter: 'all', dim: false, total: 3, completed: 1 });

  controlCenter.element.querySelector('[data-role="hide-done"]').click();

  assert.deepEqual(filters, ['pending']);
  assert.equal(pageClicks, 0);
});

test('successful latest saves confirm their targets when persistence does not render', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const filterSave = deferred();
  const dimSave = deferred();
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: () => filterSave.promise,
    onDimChange: () => dimSave.promise
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', dim: true, total: 3, completed: 1 });

  controlCenter.element.querySelector('[data-role="hide-done"]').click();
  filterSave.resolve();
  await flushPromises();
  const hideDone = controlCenter.element.querySelector('[data-role="hide-done"]');
  assert.equal(hideDone.querySelector('span').textContent, 'Show');
  assert.equal(hideDone.getAttribute('aria-pressed'), 'true');

  controlCenter.element.querySelector('[data-role="dim"]').click();
  dimSave.resolve();
  await flushPromises();
  const fadeDone = controlCenter.element.querySelector('[data-role="dim"]');
  assert.equal(fadeDone.getAttribute('aria-pressed'), 'false');
  assert.equal(fadeDone.title, 'Make completed items lighter and strike them through. Checkmarks stay saved.');
});

test('a stale render does not replace the pending Hide state', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const save = deferred();
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: () => save.promise
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', dim: false, total: 3, completed: 1 });
  const hideDone = controlCenter.element.querySelector('[data-role="hide-done"]');

  hideDone.click();
  controlCenter.render({ filter: 'all', dim: false, total: 3, completed: 1 });

  assert.equal(hideDone.querySelector('span').textContent, 'Show');
  assert.equal(hideDone.getAttribute('aria-pressed'), 'true');
  assert.equal(hideDone.getAttribute('aria-label'), 'Show completed calendar items');

  save.resolve();
  await flushPromises();
});

test('a late first filter response cannot revert the latest pending target', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const saves = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: (filter) => {
      const save = deferred();
      saves.push({ filter, save });
      return save.promise;
    }
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', dim: false, total: 3, completed: 1 });
  const hideDone = controlCenter.element.querySelector('[data-role="hide-done"]');

  hideDone.click();
  hideDone.click();
  assert.deepEqual(saves.map(({ filter }) => filter), ['pending', 'all']);
  assert.equal(hideDone.querySelector('span').textContent, 'Hide');

  saves[1].save.resolve();
  await flushPromises();
  assert.equal(hideDone.querySelector('span').textContent, 'Hide');
  assert.equal(hideDone.getAttribute('aria-pressed'), 'false');

  saves[0].save.resolve();
  await flushPromises();
  assert.equal(hideDone.querySelector('span').textContent, 'Hide');
  assert.equal(hideDone.getAttribute('aria-pressed'), 'false');
});

test('rejected latest filter and fade saves roll back labels and accessibility state', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const filterSave = deferred();
  const dimSave = deferred();
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: () => filterSave.promise,
    onDimChange: () => dimSave.promise
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', dim: true, total: 3, completed: 1 });

  const hideDone = controlCenter.element.querySelector('[data-role="hide-done"]');
  hideDone.click();
  assert.equal(hideDone.querySelector('span').textContent, 'Show');
  filterSave.reject(new Error('filter failed'));
  await flushPromises();
  assert.equal(hideDone.querySelector('span').textContent, 'Hide');
  assert.equal(hideDone.getAttribute('aria-pressed'), 'false');
  assert.equal(hideDone.getAttribute('aria-label'), 'Hide completed calendar items');

  const fadeDone = controlCenter.element.querySelector('[data-role="dim"]');
  fadeDone.click();
  assert.equal(fadeDone.getAttribute('aria-pressed'), 'false');
  dimSave.reject(new Error('fade failed'));
  await flushPromises();
  assert.equal(fadeDone.getAttribute('aria-pressed'), 'true');
  assert.equal(fadeDone.getAttribute('aria-label'), 'Stop fading completed items');
  assert.equal(fadeDone.title, 'Completed items are faded and struck through. Click to show them normally.');
});

test('rapid fade presses persist explicit intended values', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const saves = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onDimChange: (dim) => {
      const save = deferred();
      saves.push({ dim, save });
      return save.promise;
    }
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', dim: true, total: 3, completed: 1 });
  const fadeDone = controlCenter.element.querySelector('[data-role="dim"]');

  fadeDone.click();
  fadeDone.click();
  assert.deepEqual(saves.map(({ dim }) => dim), [false, true]);
  saves[0].save.resolve();
  await flushPromises();
  assert.equal(fadeDone.getAttribute('aria-pressed'), 'true');
  saves[1].save.resolve();
  await flushPromises();
  assert.equal(fadeDone.getAttribute('aria-pressed'), 'true');
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
  assert.equal(resetView.textContent.trim(), 'Clear');
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

test('move mode keeps the v2 primary actions usable while exposing drag controls', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const calls = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onFilterChange: () => calls.push('filter'),
    onDimChange: () => calls.push('dim'),
    onClearView: () => calls.push('clear')
  });
  controlCenter.render({ filter: 'all', total: 3, completed: 1, moveMode: true });
  for (const role of ['hide-done', 'dim', 'clear-view']) {
    const button = controlCenter.element.querySelector(`[data-role="${role}"]`);
    button.click();
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-disabled'), 'false');
  }
  assert.deepEqual(calls, ['filter', 'dim', 'clear']);
  assert.equal(controlCenter.element.querySelector('.sc-cc-move-overlay').hidden, false);
});

test('move mode never starts a drag from a primary rail button', () => {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  const positions = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onPositionChange: (position) => positions.push(position)
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', total: 3, completed: 1, moveMode: true });
  const pointer = (type, x, y) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 9, clientX: x, clientY: y });
    return event;
  };
  const hide = controlCenter.element.querySelector('[data-role="hide-done"]');
  hide.dispatchEvent(pointer('pointerdown', 100, 100));
  controlCenter.element.dispatchEvent(pointer('pointermove', 76, 84));
  controlCenter.element.dispatchEvent(pointer('pointerup', 76, 84));
  assert.deepEqual(positions, []);
});

test('move mode waits for deliberate movement before it persists a drag', () => {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  const positions = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onPositionChange: (position) => positions.push(position)
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', total: 3, completed: 1, moveMode: true });
  const pointer = (type, x, y) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 8, clientX: x, clientY: y });
    return event;
  };
  controlCenter.element.dispatchEvent(pointer('pointerdown', 100, 100));
  controlCenter.element.dispatchEvent(pointer('pointermove', 104, 103));
  controlCenter.element.dispatchEvent(pointer('pointerup', 104, 103));
  assert.deepEqual(positions, []);
});

test('move mode starts a drag only from its dedicated drag handle', () => {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  const positions = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onPositionChange: (position) => positions.push(position)
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', total: 3, completed: 1, moveMode: true });

  const pointer = (type, x, y) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 7, clientX: x, clientY: y });
    return event;
  };
  controlCenter.element.dispatchEvent(pointer('pointerdown', 100, 100));
  controlCenter.element.dispatchEvent(pointer('pointermove', 76, 84));
  controlCenter.element.dispatchEvent(pointer('pointerup', 76, 84));
  assert.deepEqual(positions, []);

  const handle = controlCenter.element.querySelector('.sc-cc-move-handle');
  handle.dispatchEvent(pointer('pointerdown', 100, 100));
  handle.dispatchEvent(pointer('pointermove', 76, 84));
  handle.dispatchEvent(pointer('pointerup', 76, 84));
  assert.deepEqual(positions, [{ right: 36, bottom: 86 }]);
});

test('dedicated move handle does not persist sub-threshold movement', () => {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  const positions = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onPositionChange: (position) => positions.push(position)
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', total: 3, completed: 1, moveMode: true });
  const handle = controlCenter.element.querySelector('.sc-cc-move-handle');
  const initialPosition = [
    controlCenter.element.style.getPropertyValue('--sc-control-right'),
    controlCenter.element.style.getPropertyValue('--sc-control-bottom')
  ];
  const pointer = (type, x, y) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 13, clientX: x, clientY: y });
    return event;
  };

  handle.dispatchEvent(pointer('pointerdown', 100, 100));
  controlCenter.element.dispatchEvent(pointer('pointermove', 104, 103));
  controlCenter.element.dispatchEvent(pointer('pointerup', 104, 103));

  assert.deepEqual(positions, []);
  assert.deepEqual([
    controlCenter.element.style.getPropertyValue('--sc-control-right'),
    controlCenter.element.style.getPropertyValue('--sc-control-bottom')
  ], initialPosition);
});

test('fade, clear, undo, and summary pointer activity never persists a drag', () => {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  const positions = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onPositionChange: (position) => positions.push(position)
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.render({ filter: 'all', total: 3, completed: 1, moveMode: true });
  controlCenter.showUndo(true);
  const pointer = (type, pointerId, x, y) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId, clientX: x, clientY: y });
    return event;
  };

  for (const [index, [, target]] of [
    ['dim', controlCenter.element.querySelector('[data-role="dim"]')],
    ['clear', controlCenter.element.querySelector('[data-role="clear-view"]')],
    ['undo', controlCenter.element.querySelector('[data-role="undo"]')],
    ['summary', controlCenter.element.querySelector('[data-role="progress"]')]
  ].entries()) {
    const pointerId = index + 20;
    target.dispatchEvent(pointer('pointerdown', pointerId, 100, 100));
    controlCenter.element.dispatchEvent(pointer('pointermove', pointerId, 70, 70));
    controlCenter.element.dispatchEvent(pointer('pointerup', pointerId, 70, 70));
  }

  assert.deepEqual(positions, []);
});

test('a background render preserves the live drag position until pointerup', () => {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  const positions = [];
  const controlCenter = createControlCenter(dom.window.document, {
    onPositionChange: (position) => positions.push(position)
  });
  dom.window.document.body.appendChild(controlCenter.element);
  controlCenter.element.getBoundingClientRect = () => ({ width: 0, height: 0 });
  controlCenter.render({ filter: 'all', total: 3, completed: 1, moveMode: true, controlPosition: { right: 40, bottom: 90 } });
  const handle = controlCenter.element.querySelector('.sc-cc-move-handle');
  const pointer = (type, x, y) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 12, clientX: x, clientY: y });
    return event;
  };

  handle.dispatchEvent(pointer('pointerdown', 100, 100));
  handle.dispatchEvent(pointer('pointermove', 76, 84));
  assert.equal(controlCenter.element.style.getPropertyValue('--sc-control-right'), '64px');
  assert.equal(controlCenter.element.style.getPropertyValue('--sc-control-bottom'), '106px');

  controlCenter.render({ filter: 'all', total: 3, completed: 1, moveMode: true, controlPosition: { right: 3, bottom: 4 } });
  assert.equal(controlCenter.element.style.getPropertyValue('--sc-control-right'), '64px');
  assert.equal(controlCenter.element.style.getPropertyValue('--sc-control-bottom'), '106px');

  handle.dispatchEvent(pointer('pointerup', 76, 84));
  assert.deepEqual(positions, [{ right: 64, bottom: 106 }]);
});

test('rail dock presets place controls at predictable viewport corners', () => {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  Object.defineProperty(dom.window, 'innerWidth', { value: 1000, configurable: true });
  Object.defineProperty(dom.window, 'innerHeight', { value: 800, configurable: true });
  const controlCenter = createControlCenter(dom.window.document, {});
  controlCenter.element.getBoundingClientRect = () => ({ width: 52, height: 220 });
  dom.window.document.body.appendChild(controlCenter.element);

  controlCenter.render({ filter: 'all', total: 1, completed: 0, controlDock: 'top-left' });
  assert.equal(controlCenter.element.style.getPropertyValue('--sc-control-right'), '936px');
  assert.equal(controlCenter.element.style.getPropertyValue('--sc-control-bottom'), '568px');

  controlCenter.render({ filter: 'all', total: 1, completed: 0, controlDock: 'bottom-right' });
  assert.equal(controlCenter.element.style.getPropertyValue('--sc-control-right'), '12px');
  assert.equal(controlCenter.element.style.getPropertyValue('--sc-control-bottom'), '12px');
});

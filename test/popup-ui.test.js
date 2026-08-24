import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createSettingsPopup } from '../src/popup-ui.js';

function setup() {
  const dom = new JSDOM('<!doctype html><body><main id="app"></main></body>');
  const calls = [];
  const popup = createSettingsPopup(dom.window.document, {
    onFilterChange: (filter) => calls.push(['filter', filter]),
    onDimChange: (enabled) => calls.push(['dim', enabled]),
    onAccentChange: (color) => calls.push(['accent', color]),
    onResetAll: () => calls.push(['reset-all']),
    onUndo: () => calls.push(['undo'])
  });
  dom.window.document.querySelector('#app').appendChild(popup.element);
  return { dom, popup, calls };
}

test('settings popup clearly separates view, appearance, and data controls', () => {
  const { popup } = setup();
  assert.ok(popup.element.querySelector('[data-section="view"]'));
  assert.ok(popup.element.querySelector('[data-section="appearance"]'));
  assert.ok(popup.element.querySelector('[data-section="data"]'));
  assert.equal(popup.element.querySelectorAll('[data-filter]').length, 3);
  assert.ok(popup.element.querySelector('[data-role="fade-completed"]'));
  assert.ok(popup.element.querySelector('[data-role="accent-color"]'));
  assert.ok(popup.element.querySelector('[data-role="reset-all"]'));
});

test('settings popup derives readable foreground tokens for extreme custom accents', () => {
  const { popup } = setup();
  popup.render({
    settings: { filter: 'all', dim: true, accentColor: '#ffffff' },
    checkedCount: 1
  });

  assert.equal(popup.element.style.getPropertyValue('--accent-foreground'), '#111111');
});

test('settings popup explains global reset and disables it when nothing is saved', () => {
  const { popup } = setup();
  const reset = popup.element.querySelector('[data-role="reset-all"]');
  const explanation = popup.element.querySelector('[data-role="reset-all-explanation"]');

  popup.render({ settings: { filter: 'all', dim: true, accentColor: '#0078d4' }, checkedCount: 0 });
  assert.equal(reset.disabled, true);
  assert.equal(explanation.textContent, 'No saved checkoffs to reset.');

  popup.render({ settings: { filter: 'all', dim: true, accentColor: '#0078d4' }, checkedCount: 3 });
  assert.equal(reset.disabled, false);
  assert.equal(explanation.textContent, 'Removes 3 saved checkoffs from every calendar date.');
});

test('settings popup forwards explicit filter, fade, and accent changes', () => {
  const { dom, popup, calls } = setup();
  popup.render({ settings: { filter: 'pending', dim: true, accentColor: '#0078d4' }, checkedCount: 2 });

  assert.equal(popup.element.querySelector('[data-filter="pending"]').getAttribute('aria-pressed'), 'true');
  popup.element.querySelector('[data-filter="done"]').click();
  popup.element.querySelector('[data-role="fade-completed"]').click();
  const color = popup.element.querySelector('[data-role="accent-color"]');
  color.value = '#ff2d55';
  color.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  assert.deepEqual(calls, [
    ['filter', 'done'],
    ['dim', false],
    ['accent', '#ff2d55']
  ]);
});

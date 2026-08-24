import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initSettingsPopup } from '../src/popup-controller.js';

function snapshot(states = {}) {
  return {
    version: 4,
    states,
    stateVersions: {},
    settings: { hide: false, dim: true, filter: 'all', accentColor: '#0078d4' },
    idMap: {},
    legacyMigrated: true
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('popup view choices persist through the serialized storage client', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="app"></main></body>');
  let current = snapshot({ alpha: 100 });
  const patches = [];
  const sendMessage = async (message) => {
    if (message.operation === 'initialize') return { ok: true, snapshot: current };
    if (message.operation === 'updateSettings') {
      patches.push(message.patch);
      current = { ...current, settings: { ...current.settings, ...message.patch } };
      return { ok: true, snapshot: current };
    }
    throw new Error(`Unexpected operation: ${message.operation}`);
  };

  const controller = await initSettingsPopup(dom.window.document, { sendMessage });
  controller.popup.element.querySelector('[data-filter="done"]').click();
  await tick();

  assert.deepEqual(patches, [{ filter: 'done' }]);
  assert.equal(controller.popup.element.querySelector('[data-filter="done"]').getAttribute('aria-pressed'), 'true');
  assert.equal(controller.popup.element.querySelector('[data-role="status"]').textContent, 'Showing completed items.');
});

test('popup Fade completed switch persists an explicit display preference', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="app"></main></body>');
  let current = snapshot({ alpha: 100 });
  const patches = [];
  const sendMessage = async (message) => {
    if (message.operation === 'initialize') return { ok: true, snapshot: current };
    if (message.operation === 'updateSettings') {
      patches.push(message.patch);
      current = { ...current, settings: { ...current.settings, ...message.patch } };
      return { ok: true, snapshot: current };
    }
    throw new Error(`Unexpected operation: ${message.operation}`);
  };

  const controller = await initSettingsPopup(dom.window.document, { sendMessage });
  controller.popup.element.querySelector('[data-role="fade-completed"]').click();
  await tick();

  assert.deepEqual(patches, [{ dim: false }]);
  assert.equal(controller.popup.element.querySelector('[data-role="fade-completed"]').getAttribute('aria-checked'), 'false');
  assert.equal(controller.popup.element.querySelector('[data-role="status"]').textContent, 'Completed items now stay at full brightness.');
});

test('popup accent color persists only a validated local hex color', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="app"></main></body>');
  let current = snapshot({ alpha: 100 });
  const patches = [];
  const sendMessage = async (message) => {
    if (message.operation === 'initialize') return { ok: true, snapshot: current };
    if (message.operation === 'updateSettings') {
      patches.push(message.patch);
      current = { ...current, settings: { ...current.settings, ...message.patch } };
      return { ok: true, snapshot: current };
    }
    throw new Error(`Unexpected operation: ${message.operation}`);
  };

  const controller = await initSettingsPopup(dom.window.document, { sendMessage });
  const color = controller.popup.element.querySelector('[data-role="accent-color"]');
  color.value = '#FF2D55';
  color.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await tick();

  assert.deepEqual(patches, [{ accentColor: '#ff2d55' }]);
  assert.equal(controller.popup.element.querySelector('[data-role="status"]').textContent, 'Accent color updated.');
});

test('popup reflects storage changes made by the active Schoology tab', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="app"></main></body>');
  let listener;
  const sendMessage = async (message) => {
    if (message.operation === 'initialize') return { ok: true, snapshot: snapshot({ alpha: 100 }) };
    throw new Error(`Unexpected operation: ${message.operation}`);
  };

  const controller = await initSettingsPopup(dom.window.document, {
    sendMessage,
    subscribeStorage: (callback) => { listener = callback; }
  });
  const changed = snapshot({ alpha: 100, beta: 200, gamma: 300 });
  changed.settings = { ...changed.settings, filter: 'pending', accentColor: '#5856d6' };
  listener(changed);

  assert.equal(controller.popup.element.querySelector('[data-filter="pending"]').getAttribute('aria-pressed'), 'true');
  assert.equal(controller.popup.element.querySelector('[data-role="accent-color"]').value, '#5856d6');
  assert.equal(controller.popup.element.querySelector('[data-role="reset-all-explanation"]').textContent, 'Removes 3 saved checkoffs from every calendar date.');
});

test('popup global reset ignores rapid reactivation and reports the actual removed count', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="app"></main></body>');
  let current = snapshot({ alpha: 100, beta: 200 });
  let clearCalls = 0;
  let finishClear;
  const sendMessage = async (message) => {
    if (message.operation === 'initialize') return { ok: true, snapshot: current };
    if (message.operation === 'clearAllStates') {
      clearCalls += 1;
      return new Promise((resolve) => { finishClear = () => {
        current = snapshot({ beta: 300 });
        resolve({
          ok: true,
          snapshot: current,
          result: { states: { alpha: 100 }, versions: { alpha: 1 }, aliases: {} }
        });
      }; });
    }
    throw new Error(`Unexpected operation: ${message.operation}`);
  };

  const controller = await initSettingsPopup(dom.window.document, {
    sendMessage,
    confirmAction: () => true
  });
  const reset = controller.popup.element.querySelector('[data-role="reset-all"]');
  reset.click();
  reset.click();

  assert.equal(clearCalls, 1);
  assert.equal(reset.disabled, true);
  finishClear();
  await tick();

  assert.equal(controller.popup.element.querySelector('[data-role="status"]').textContent, 'Reset 1 checkoff from every calendar date.');
  assert.equal(controller.popup.element.querySelector('[data-role="undo"]').hidden, false);
});

test('popup global reset confirms exact all-date scope, reports success, and offers Undo', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="app"></main></body>');
  let current = snapshot({ alpha: 100, beta: 200 });
  let clearPayload;
  let restored;
  const confirmations = [];

  const sendMessage = async (message) => {
    if (message.operation === 'initialize') return { ok: true, snapshot: current };
    if (message.operation === 'clearAllStates') {
      clearPayload = message.expectedStates;
      current = snapshot({});
      return {
        ok: true,
        snapshot: current,
        result: { states: message.expectedStates, versions: { alpha: 1, beta: 1 }, aliases: {} }
      };
    }
    if (message.operation === 'restoreStates') {
      restored = message.snapshot;
      current = snapshot({ alpha: 100, beta: 200 });
      return { ok: true, snapshot: current };
    }
    throw new Error(`Unexpected operation: ${message.operation}`);
  };

  const controller = await initSettingsPopup(dom.window.document, {
    sendMessage,
    confirmAction: (message) => { confirmations.push(message); return true; }
  });

  controller.popup.element.querySelector('[data-role="reset-all"]').click();
  await tick();

  assert.deepEqual(clearPayload, { alpha: 100, beta: 200 });
  assert.deepEqual(confirmations, ['Reset all 2 saved checkoffs across every calendar date?']);
  assert.equal(controller.popup.element.querySelector('[data-role="status"]').textContent, 'Reset 2 checkoffs from every calendar date.');
  assert.equal(controller.popup.element.querySelector('[data-role="undo"]').hidden, false);

  controller.popup.element.querySelector('[data-role="undo"]').click();
  await tick();
  assert.deepEqual(restored.states, { alpha: 100, beta: 200 });
  assert.equal(controller.popup.element.querySelector('[data-role="status"]').textContent, 'Restored 2 checkoffs.');
});

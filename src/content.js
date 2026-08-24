import { DATA_KEY, buildIdCandidates } from './core.js';
import { StorageClient } from './storage-client.js';
import { CalendarAdapter, RenderedItemRegistry } from './calendar-adapter.js';
import { appearanceForItem, createControlCenter, summarizeRenderedItems } from './control-center.js';

const POLL_MS = 3000;
const LEGACY_KEYS = {
  states: 'sc_cal_checkbox_states_calendar_only',
  settings: 'sc_cal_checkbox_settings_calendar_only',
  idMap: 'sc_cal_idmap_calendar_only_v2'
};
const store = new StorageClient((message) => chrome.runtime.sendMessage(message));
const adapter = new CalendarAdapter(document);
const registry = new RenderedItemRegistry();
let controlCenter = null;
let undoSnapshot = null;
let scanQueued = false;
let scanRunning = false;

function reportError(error, context) {
  console.error(`[Assignmark] ${context}`, error);
  let notice = document.querySelector('.sc-cal-error');
  if (!notice) {
    notice = document.createElement('div');
    notice.className = 'sc-cal-error';
    notice.setAttribute('role', 'status');
    document.body?.appendChild(notice);
  }
  if (!notice) return;
  notice.textContent = 'Assignmark could not save a change. Reload Schoology and try again.';
  clearTimeout(Number(notice.dataset.timer));
  notice.dataset.timer = String(setTimeout(() => notice.remove(), 8000));
}

function readLegacyData() {
  const parse = (key) => {
    try { return JSON.parse(window.localStorage.getItem(key) || '{}'); }
    catch { return {}; }
  };
  return {
    states: parse(LEGACY_KEYS.states),
    settings: parse(LEGACY_KEYS.settings),
    idMap: parse(LEGACY_KEYS.idMap)
  };
}

function applyState(id, checked) {
  const appearance = appearanceForItem(checked, store.getSettings());
  for (const element of registry.occurrences(id)) {
    element.classList.toggle('sc-checked-dim', appearance.dimmed);
    element.classList.toggle('sc-filtered-out', !appearance.visible);
    const checkbox = element.querySelector('.sc-cal-left-checkbox');
    if (checkbox instanceof HTMLInputElement) checkbox.checked = checked;
  }
}

function render() {
  for (const id of registry.currentScopeIds()) applyState(id, store.isChecked(id));
  registry.replace(registry.currentScopeIds().flatMap((id) =>
    registry.occurrences(id).map((node) => ({ id, node, checked: store.isChecked(id) }))
  ));
  const summary = summarizeRenderedItems(registry.items());
  controlCenter?.render({ ...summary, ...store.getSettings() });
  controlCenter?.showUndo(Boolean(undoSnapshot && Object.keys(undoSnapshot.states || {}).length));
}

function addCheckbox(node, resolution) {
  node.dataset.scId = resolution.id;
  node.dataset.scSource = 'calendar';
  let checkbox = node.querySelector('.sc-cal-left-checkbox');
  if (!(checkbox instanceof HTMLInputElement)) {
    const wrapper = document.createElement('span');
    wrapper.className = 'sc-cal-left-wrapper';
    wrapper.dataset.scLeft = '1';
    checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'sc-cal-left-checkbox';
    checkbox.title = 'Mark done (calendar-only)';
    checkbox.setAttribute('aria-label', 'Mark this calendar item done');
    const block = (event) => event.stopPropagation();
    for (const name of ['pointerdown', 'touchstart', 'mousedown']) checkbox.addEventListener(name, block, { passive: true });
    checkbox.addEventListener('click', block, true);
    checkbox.addEventListener('change', async () => {
      const id = node.dataset.scId;
      const requested = checkbox.checked;
      checkbox.disabled = true;
      try {
        await store.setChecked(id, requested);
        render();
      } catch (error) {
        checkbox.checked = !requested;
        reportError(error, 'Saving checkbox state failed.');
      } finally {
        checkbox.disabled = false;
      }
    });
    wrapper.appendChild(checkbox);
    const title = node.querySelector('.fc-event-title, .fc-title, .event-title, a') || node.firstChild;
    if (title?.parentElement) title.parentElement.insertBefore(wrapper, title);
    else node.insertBefore(wrapper, node.firstChild);
  }
  checkbox.dataset.scId = resolution.id;
  checkbox.checked = resolution.checked;
}

function ensureControlCenter() {
  if (!adapter.isPresent()) {
    controlCenter?.destroy();
    controlCenter = null;
    return;
  }
  if (controlCenter && !controlCenter.element.isConnected) {
    controlCenter.destroy();
    controlCenter = null;
  }
  if (controlCenter) return;
  controlCenter = createControlCenter(document, {
    onFilterChange: async (filter) => {
      try { await store.updateSettings({ filter }); render(); }
      catch (error) { reportError(error, 'Saving filter failed.'); }
    },
    onDimChange: async () => {
      try { await store.updateSettings({ dim: !store.getSettings().dim }); render(); }
      catch (error) { reportError(error, 'Saving Dim setting failed.'); }
    },
    onClearView: async () => {
      const expectedStates = store.checkedSnapshot(registry.completedScopeIds());
      const count = Object.keys(expectedStates).length;
      if (count === 0 || !window.confirm(`Clear ${count} completed item${count === 1 ? '' : 's'} in the current view?`)) return;
      try { undoSnapshot = await store.clearCompleted(expectedStates); render(); }
      catch (error) { reportError(error, 'Clearing current-view checkoffs failed.'); }
    },
    onClearAll: async () => {
      const expectedStates = store.checkedSnapshot();
      const count = Object.keys(expectedStates).length;
      if (count === 0 || !window.confirm(`Clear all ${count} saved checkoff${count === 1 ? '' : 's'}?`)) return;
      try { undoSnapshot = await store.clearAllStates(expectedStates); render(); }
      catch (error) { reportError(error, 'Clearing all checkoffs failed.'); }
    },
    onUndo: async () => {
      if (!undoSnapshot) return;
      const snapshot = undoSnapshot;
      try { await store.restoreStates(snapshot); undoSnapshot = null; render(); }
      catch (error) { reportError(error, 'Restoring cleared checkoffs failed.'); }
    }
  });
  document.body.appendChild(controlCenter.element);
}

async function scan() {
  if (scanRunning) { scanQueued = true; return; }
  scanRunning = true;
  try {
    ensureControlCenter();
    const nodes = adapter.discover();
    const resolutions = await store.resolveMany(nodes.map((node) => buildIdCandidates(node, location.origin)));
    const entries = [];
    nodes.forEach((node, index) => {
      const resolution = resolutions[index];
      if (!resolution) return;
      addCheckbox(node, resolution);
      entries.push({ id: resolution.id, node, checked: store.isChecked(resolution.id) });
    });
    registry.replace(entries);
    render();
  } catch (error) {
    reportError(error, 'Scanning calendar items failed.');
  } finally {
    scanRunning = false;
    if (scanQueued) { scanQueued = false; queueMicrotask(scan); }
  }
}

function scheduleScan() {
  if (scanQueued) return;
  scanQueued = true;
  queueMicrotask(() => { scanQueued = false; void scan(); });
}

async function init() {
  try { await store.initialize(readLegacyData()); }
  catch (error) { reportError(error, 'Extension storage initialization failed.'); return; }
  await scan();
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0)) scheduleScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[DATA_KEY]) scheduleScan();
  });
  setInterval(scheduleScan, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleScan(); });
  window.addEventListener('focus', scheduleScan);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void init(), { once: true });
else void init();

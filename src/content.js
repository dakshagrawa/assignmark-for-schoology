import { ExtensionStore, buildIdCandidates } from './core.js';

const POLL_MS = 3000;
const CALENDAR_SELECTORS = ['.fc-event', '.fc-daygrid-event', '.fc-list-item', '.fc-event-inner', '.fc-event-main-frame'];
const store = new ExtensionStore(chrome.storage.local, window.localStorage);
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
  if (notice) {
    notice.textContent = 'Assignmark could not save a change. Reload Schoology and try again.';
    clearTimeout(Number(notice.dataset.timer));
    notice.dataset.timer = String(setTimeout(() => notice.remove(), 8000));
  }
}

function calendarRoot(node) {
  return node.closest?.('.fc-event, .fc-daygrid-event, .fc-list-item') || node;
}

function calendarNodes() {
  const nodes = new Set();
  for (const selector of CALENDAR_SELECTORS) {
    for (const match of document.querySelectorAll(selector)) nodes.add(calendarRoot(match));
  }
  return [...nodes].filter((node) => node instanceof HTMLElement);
}

function escapeSelector(value) {
  return globalThis.CSS?.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

function applyState(id, checked) {
  const settings = store.getSettings();
  const selector = `[data-sc-id="${escapeSelector(id)}"][data-sc-source="calendar"]`;
  for (const element of document.querySelectorAll(selector)) {
    element.classList.toggle('sc-checked-dim', checked && settings.dim);
    element.classList.toggle('sc-hidden-checked', checked && settings.hide);
    const checkbox = element.querySelector('.sc-cal-left-checkbox');
    if (checkbox instanceof HTMLInputElement) checkbox.checked = checked;
  }
}

function applyAllStates() {
  for (const element of document.querySelectorAll('[data-sc-source="calendar"]')) {
    applyState(element.dataset.scId, store.isChecked(element.dataset.scId));
  }
}

async function injectCheckbox(node) {
  if (node.querySelector(':scope > .sc-cal-left-wrapper, .sc-cal-left-wrapper') || node.dataset.scInjecting === '1') return;
  node.dataset.scInjecting = '1';
  try {
    const resolution = await store.resolve(buildIdCandidates(node, location.origin));
    node.dataset.scId = resolution.id;
    node.dataset.scSource = 'calendar';

    const wrapper = document.createElement('span');
    wrapper.className = 'sc-cal-left-wrapper';
    wrapper.dataset.scLeft = '1';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'sc-cal-left-checkbox';
    checkbox.dataset.scId = resolution.id;
    checkbox.title = 'Mark done (calendar-only)';
    checkbox.setAttribute('aria-label', 'Mark this calendar item done');
    checkbox.checked = resolution.checked;

    const block = (event) => event.stopPropagation();
    for (const eventName of ['pointerdown', 'touchstart', 'mousedown']) {
      checkbox.addEventListener(eventName, block, { passive: true });
    }
    checkbox.addEventListener('click', block, true);
    checkbox.addEventListener('change', async () => {
      const requested = checkbox.checked;
      checkbox.disabled = true;
      try {
        await store.setChecked(resolution.id, requested);
        applyState(resolution.id, requested);
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
    applyState(resolution.id, resolution.checked);
  } catch (error) {
    reportError(error, 'Injecting a checkbox failed.');
  } finally {
    delete node.dataset.scInjecting;
  }
}

function hasCalendar() {
  return Boolean(document.querySelector('.fc, .fc-daygrid, .fc-day-grid, .fc-view') || location.pathname.includes('/calendar'));
}

const ICONS = {
  eyeOpen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-7 0-11 6.5-11 7s4 7 11 7 11-6.5 11-7-4-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>',
  eyeClosed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.1 2.1.69 3.51l3.34 3.34C2.73 8.89 1.73 10.88 1 12c1.73 4.89 6 8 11 8 2.11 0 4.07-.52 5.8-1.44l3.4 3.4 1.41-1.41L2.1 2.1zM12 7a5 5 0 0 1 5 5c0 .73-.13 1.43-.36 2.06L9.06 6.36C10.2 6.13 11.09 6 12 6v1z"/></svg>',
  dim: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2a7 7 0 0 0 0 14v2a9 9 0 0 1 0-18zm-1 4v8a4 4 0 0 0 0-8z"/></svg>',
  clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>'
};

function toolbarButton(id, icon, label, pressed = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sc-icon-btn';
  button.id = id;
  button.setAttribute('aria-pressed', String(pressed));
  button.innerHTML = `${icon}<span class="sc-label">${label}</span>`;
  return button;
}

function ensureToolbar() {
  if (!hasCalendar() || document.querySelector('.sc-cal-toolbar')) return;
  const settings = store.getSettings();
  const toolbar = document.createElement('div');
  toolbar.className = 'sc-cal-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Calendar completion settings');

  const hide = toolbarButton('sc-hide', settings.hide ? ICONS.eyeClosed : ICONS.eyeOpen, 'Hide', settings.hide);
  const dim = toolbarButton('sc-dim', ICONS.dim, 'Dim', settings.dim);
  const clear = toolbarButton('sc-clear', ICONS.clear, 'Clear');
  toolbar.append(hide, dim, clear);
  document.body.appendChild(toolbar);

  hide.addEventListener('click', async () => {
    try {
      const next = !store.getSettings().hide;
      await store.updateSettings({ hide: next });
      hide.setAttribute('aria-pressed', String(next));
      hide.innerHTML = `${next ? ICONS.eyeClosed : ICONS.eyeOpen}<span class="sc-label">Hide</span>`;
      applyAllStates();
    } catch (error) { reportError(error, 'Saving Hide setting failed.'); }
  });

  dim.addEventListener('click', async () => {
    try {
      const next = !store.getSettings().dim;
      await store.updateSettings({ dim: next });
      dim.setAttribute('aria-pressed', String(next));
      applyAllStates();
    } catch (error) { reportError(error, 'Saving Dim setting failed.'); }
  });

  clear.addEventListener('click', async () => {
    if (!window.confirm('Clear all saved calendar checkbox states?')) return;
    try {
      await store.clearStates();
      applyAllStates();
    } catch (error) { reportError(error, 'Clearing checkbox states failed.'); }
  });
}

async function scan() {
  if (scanRunning) { scanQueued = true; return; }
  scanRunning = true;
  try {
    ensureToolbar();
    await Promise.all(calendarNodes().map(injectCheckbox));
    applyAllStates();
  } finally {
    scanRunning = false;
    if (scanQueued) {
      scanQueued = false;
      queueMicrotask(scan);
    }
  }
}

function scheduleScan() {
  if (scanQueued) return;
  scanQueued = true;
  queueMicrotask(() => {
    scanQueued = false;
    void scan();
  });
}

async function init() {
  try {
    await store.initialize();
  } catch (error) {
    reportError(error, 'Extension storage initialization failed.');
    return;
  }
  await scan();
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0)) scheduleScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(scheduleScan, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleScan(); });
  window.addEventListener('focus', scheduleScan);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void init(), { once: true });
else void init();

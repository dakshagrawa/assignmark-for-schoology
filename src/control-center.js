import { FILTER_MODES, accentForeground } from './core.js';

export const VALID_FILTERS = FILTER_MODES;

export function normalizeFilter(value) {
  return VALID_FILTERS.includes(value) ? value : 'all';
}

export function summarizeRenderedItems(items) {
  const byId = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item.id !== 'string' || !item.id) continue;
    byId.set(item.id, Boolean(item.checked) || Boolean(byId.get(item.id)));
  }

  const completed = [...byId.values()].filter(Boolean).length;
  return {
    total: byId.size,
    completed,
    pending: byId.size - completed
  };
}

export function isVisible(checked, filter) {
  switch (normalizeFilter(filter)) {
    case 'pending':
      return !checked;
    case 'done':
      return Boolean(checked);
    default:
      return true;
  }
}

export function appearanceForItem(checked, settings = {}) {
  return {
    visible: isVisible(checked, settings.filter),
    dimmed: Boolean(checked && settings.dim)
  };
}

export function isDarkColor(value) {
  const match = String(value || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
  if (!match || Number(match[4] ?? 1) === 0) return false;
  const channels = match.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance < 0.35;
}

function pageUsesDarkSurface(doc) {
  const view = doc.defaultView;
  if (!view?.getComputedStyle) return false;
  for (const element of [doc.body, doc.documentElement]) {
    if (element && isDarkColor(view.getComputedStyle(element).backgroundColor)) return true;
  }
  return false;
}

const ICONS = Object.freeze({
  eyeOpen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.75"/></svg>',
  eyeClosed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A11.8 11.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15.7 15.7 0 0 1-2.4 3.1M6.3 6.3C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.6-.3 3.7-.7M9.9 9.9A3 3 0 0 0 14.1 14"/></svg>',
  fade: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="sc-icon-fill" d="M12 3a9 9 0 0 0 0 18V3Z"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M4.7 15a8 8 0 1 0 .2-6.3L4 10"/><path d="m9.5 12 1.7 1.7 3.6-4"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8 4 12l5 4v-3h5a5 5 0 0 1 5 5v1M4 12h10"/></svg>'
});

function makeButton(doc, { id, icon, label, role, pressed = null, primary = false }) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.id = id;
  button.className = primary ? 'sc-icon-btn sc-cc-primary' : 'sc-icon-btn';
  button.setAttribute('data-role', role);
  if (pressed !== null) button.setAttribute('aria-pressed', String(Boolean(pressed)));
  button.innerHTML = `${icon}<span class="sc-label">${label}</span>`;
  return button;
}

function setButtonContent(button, icon, label) {
  button.innerHTML = `${icon}<span class="sc-label">${label}</span>`;
}

export function createControlCenter(doc, callbacks = {}) {
  const container = doc.createElement('div');
  container.className = 'sc-cc';
  container.setAttribute('role', 'toolbar');
  container.setAttribute('aria-label', 'Assignmark calendar controls');

  const summary = doc.createElement('div');
  summary.className = 'sc-cc-summary';
  summary.setAttribute('data-role', 'progress');
  summary.setAttribute('aria-live', 'polite');
  summary.setAttribute('aria-label', '0 of 0 current-view items completed');
  summary.title = '0 of 0 current-view items completed';
  summary.textContent = '0/0';

  const hideDone = makeButton(doc, {
    id: 'sc-cc-hide-done',
    icon: ICONS.eyeOpen,
    label: 'Hide done',
    role: 'hide-done',
    pressed: false,
    primary: true
  });
  const fadeDone = makeButton(doc, {
    id: 'sc-cc-dim',
    icon: ICONS.fade,
    label: 'Fade done',
    role: 'dim',
    pressed: true,
    primary: true
  });
  const resetView = makeButton(doc, {
    id: 'sc-cc-clear-view',
    icon: ICONS.reset,
    label: 'Reset view',
    role: 'clear-view',
    primary: true
  });
  const undo = makeButton(doc, {
    id: 'sc-cc-undo',
    icon: ICONS.undo,
    label: 'Undo reset',
    role: 'undo'
  });
  undo.hidden = true;

  hideDone.title = 'Hide completed items from this calendar view.';
  fadeDone.title = 'Make completed items lighter and strike them through. Checkmarks stay saved.';
  resetView.title = 'No completed items in this calendar view.';
  resetView.disabled = true;

  container.append(summary, hideDone, fadeDone, resetView, undo);

  let currentFilter = 'all';

  hideDone.addEventListener('click', () => {
    const nextFilter = currentFilter === 'pending' ? 'all' : currentFilter === 'done' ? 'all' : 'pending';
    void callbacks.onFilterChange?.(nextFilter);
  });
  fadeDone.addEventListener('click', () => callbacks.onDimChange?.());
  resetView.addEventListener('click', () => callbacks.onClearView?.());
  undo.addEventListener('click', () => callbacks.onUndo?.());

  function showUndo(show) {
    undo.hidden = !show;
  }

  function render({ filter, dim, total, completed, accentColor, resetPending = false }) {
    currentFilter = normalizeFilter(filter);
    const pendingOnly = currentFilter === 'pending';
    const doneOnly = currentFilter === 'done';

    hideDone.setAttribute('aria-pressed', String(pendingOnly));
    if (doneOnly) {
      setButtonContent(hideDone, ICONS.eyeOpen, 'Show all');
      hideDone.title = 'Showing only completed items. Click to show every item.';
      hideDone.setAttribute('aria-label', 'Show all calendar items');
    } else {
      setButtonContent(hideDone, pendingOnly ? ICONS.eyeClosed : ICONS.eyeOpen, 'Hide done');
      hideDone.title = pendingOnly
        ? 'Completed items are hidden. Click to show them again.'
        : 'Hide completed items from this calendar view.';
      hideDone.setAttribute('aria-label', pendingOnly ? 'Show completed calendar items' : 'Hide completed calendar items');
    }

    fadeDone.setAttribute('aria-pressed', String(Boolean(dim)));
    fadeDone.title = dim
      ? 'Completed items are faded and struck through. Click to show them normally.'
      : 'Make completed items lighter and strike them through. Checkmarks stay saved.';
    fadeDone.setAttribute('aria-label', dim ? 'Stop fading completed items' : 'Fade completed items');

    const progressLabel = `${completed} of ${total} current-view items completed`;
    summary.textContent = `${completed}/${total}`;
    summary.setAttribute('aria-label', progressLabel);
    summary.title = progressLabel;

    resetView.disabled = resetPending || completed === 0;
    resetView.setAttribute('aria-busy', String(Boolean(resetPending)));
    resetView.title = completed === 0
      ? 'No completed items in this calendar view.'
      : 'Remove checkmarks only from completed items visible in this calendar view.';
    resetView.setAttribute('aria-label', completed === 0
      ? 'Reset current view unavailable because no visible items are completed'
      : `Reset ${completed} completed item${completed === 1 ? '' : 's'} in this calendar view`);

    if (typeof accentColor === 'string') {
      container.style.setProperty('--sc-assignmark-accent', accentColor);
      container.style.setProperty('--sc-assignmark-accent-foreground', accentForeground(accentColor));
    }
    const darkSurface = pageUsesDarkSurface(doc);
    container.classList.toggle('sc-cc-dark', darkSurface);
    container.classList.toggle('sc-cc-light', !darkSurface);
  }

  return {
    element: container,
    render,
    showUndo,
    destroy() {
      container.remove();
    }
  };
}

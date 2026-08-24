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
  const moveOverlay = doc.createElement('div');
  moveOverlay.className = 'sc-cc-move-overlay';
  moveOverlay.hidden = true;
  moveOverlay.innerHTML = '<button type="button" class="sc-cc-move-handle" aria-label="Drag Assignmark controls">Move controls</button><button type="button" class="sc-cc-lock">Lock position</button>';
  const moveHandle = moveOverlay.querySelector('.sc-cc-move-handle');
  const lockPosition = moveOverlay.querySelector('.sc-cc-lock');

  hideDone.title = 'Hide completed items from this calendar view.';
  fadeDone.title = 'Make completed items lighter and strike them through. Checkmarks stay saved.';
  resetView.title = 'No completed items in this calendar view.';
  resetView.disabled = true;

  container.append(summary, hideDone, fadeDone, resetView, undo, moveOverlay);

  let currentFilter = 'all';
  let showResetView = true;
  let moveMode = false;
  let position = { right: 12, bottom: 70 };
  let dragStart = null;

  hideDone.addEventListener('click', () => {
    const nextFilter = currentFilter === 'pending' ? 'all' : currentFilter === 'done' ? 'all' : 'pending';
    void callbacks.onFilterChange?.(nextFilter);
  });
  fadeDone.addEventListener('click', () => callbacks.onDimChange?.());
  resetView.addEventListener('click', () => callbacks.onClearView?.());
  undo.addEventListener('click', () => callbacks.onUndo?.());
  lockPosition.addEventListener('click', () => callbacks.onLockPosition?.());
  const applyPosition = () => {
    const rect = container.getBoundingClientRect();
    position.right = Math.max(8, Math.min(position.right, Math.max(8, doc.defaultView.innerWidth - rect.width - 8)));
    position.bottom = Math.max(8, Math.min(position.bottom, Math.max(8, doc.defaultView.innerHeight - rect.height - 8)));
    container.style.setProperty('--sc-control-right', `${position.right}px`);
    container.style.setProperty('--sc-control-bottom', `${position.bottom}px`);
  };
  moveHandle.addEventListener('pointerdown', (event) => {
    if (!moveMode) return;
    event.preventDefault();
    moveHandle.setPointerCapture?.(event.pointerId);
    dragStart = { id: event.pointerId, x: event.clientX, y: event.clientY, right: position.right, bottom: position.bottom };
  });
  moveHandle.addEventListener('pointermove', (event) => {
    if (!dragStart || dragStart.id !== event.pointerId) return;
    position.right = dragStart.right - (event.clientX - dragStart.x);
    position.bottom = dragStart.bottom - (event.clientY - dragStart.y);
    applyPosition();
  });
  const finishDrag = (event) => {
    if (!dragStart || dragStart.id !== event.pointerId) return;
    dragStart = null;
    callbacks.onPositionChange?.({ ...position });
  };
  moveHandle.addEventListener('pointerup', finishDrag);
  moveHandle.addEventListener('pointercancel', finishDrag);
  moveHandle.addEventListener('keydown', (event) => {
    if (!moveMode) return;
    const delta = event.shiftKey ? 32 : 8;
    if (event.key === 'ArrowLeft') position.right += delta;
    else if (event.key === 'ArrowRight') position.right -= delta;
    else if (event.key === 'ArrowUp') position.bottom -= delta;
    else if (event.key === 'ArrowDown') position.bottom += delta;
    else return;
    event.preventDefault();
    applyPosition();
    callbacks.onPositionChange?.({ ...position });
  });

  function showUndo(show) {
    undo.hidden = !show || !showResetView;
  }

  function render({ filter, dim, total, completed, accentColor, controlScale = 100, showHideDone = true, showFadeDone = true, showResetView: nextShowResetView = true, moveMode: nextMoveMode = false, controlPosition = {}, resetPending = false }) {
    currentFilter = normalizeFilter(filter);
    showResetView = nextShowResetView !== false;
    moveMode = nextMoveMode === true;
    position = {
      right: Number.isFinite(Number(controlPosition.right)) ? Math.max(0, Number(controlPosition.right)) : position.right,
      bottom: Number.isFinite(Number(controlPosition.bottom)) ? Math.max(0, Number(controlPosition.bottom)) : position.bottom
    };
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
    hideDone.hidden = showHideDone === false;
    fadeDone.hidden = showFadeDone === false;
    resetView.hidden = !showResetView;
    undo.hidden = undo.hidden || !showResetView;
    const normalizedScale = Math.min(120, Math.max(80, Number(controlScale) || 100));
    container.style.setProperty('--sc-control-scale', String(normalizedScale / 100));
    moveOverlay.hidden = !moveMode;
    container.classList.toggle('sc-cc-moving', moveMode);
    applyPosition();

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

import { FILTER_MODES } from './core.js';

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

function makeButton(doc, id, iconSVG, label, pressed = false, dataFilter = null) {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.id = id;
  btn.setAttribute('aria-pressed', String(pressed));
  if (dataFilter) btn.setAttribute('data-filter', dataFilter);
  btn.innerHTML = `${iconSVG}<span>${label}</span>`;
  return btn;
}

export function createControlCenter(doc, callbacks) {
  const ICONS = {
    filterAll: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v18H3zM5 5h14v14H5z"/></svg>',
    filterPending: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>',
    filterDone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
    expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6 6-6-6 1.41-1.41z"/></svg>'
  };

  const container = doc.createElement('div');
  container.className = 'sc-cc';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Assignmark controls');

  const summary = doc.createElement('div');
  summary.className = 'sc-cc-summary';
  summary.setAttribute('data-role', 'progress');
  summary.setAttribute('aria-live', 'polite');
  summary.textContent = '0 of 0 shown items completed';
  container.appendChild(summary);

  const filters = doc.createElement('div');
  filters.className = 'sc-cc-filters';
  filters.setAttribute('data-role', 'filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Show items');

  const btnAll = makeButton(doc, 'sc-cc-all', ICONS.filterAll, 'All', true, 'all');
  const btnPending = makeButton(doc, 'sc-cc-pending', ICONS.filterPending, 'Pending', false, 'pending');
  const btnDone = makeButton(doc, 'sc-cc-done', ICONS.filterDone, 'Done', false, 'done');
  filters.append(btnAll, btnPending, btnDone);
  container.appendChild(filters);

  const actions = doc.createElement('div');
  actions.className = 'sc-cc-actions';
  const btnClearView = makeButton(doc, 'sc-cc-clear-view', ICONS.clear, 'Clear view');
  btnClearView.setAttribute('data-role', 'clear-view');
  const btnClearAll = makeButton(doc, 'sc-cc-clear-all', ICONS.clear, 'Clear all');
  btnClearAll.setAttribute('data-role', 'clear-all');
  const btnUndo = makeButton(doc, 'sc-cc-undo', ICONS.undo, 'Undo');
  btnUndo.hidden = true;
  btnUndo.setAttribute('data-role', 'undo');
  actions.append(btnClearView, btnClearAll, btnUndo);
  container.appendChild(actions);

  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sc-cc-toggle';
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-label', 'Collapse controls');
  toggle.innerHTML = ICONS.collapse;
  container.appendChild(toggle);

  let currentFilter = 'all';

  btnAll.addEventListener('click', () => {
    if (currentFilter === 'all') return;
    currentFilter = 'all';
    callbacks.onFilterChange?.('all');
  });

  btnPending.addEventListener('click', () => {
    if (currentFilter === 'pending') return;
    currentFilter = 'pending';
    callbacks.onFilterChange?.('pending');
  });

  btnDone.addEventListener('click', () => {
    if (currentFilter === 'done') return;
    currentFilter = 'done';
    callbacks.onFilterChange?.('done');
  });

  btnClearView.addEventListener('click', () => callbacks.onClearView?.());
  btnClearAll.addEventListener('click', () => callbacks.onClearAll?.());
  btnUndo.addEventListener('click', () => callbacks.onUndo?.());

  let expanded = true;
  toggle.addEventListener('click', () => {
    expanded = !expanded;
    container.classList.toggle('sc-cc-collapsed', !expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.innerHTML = expanded ? ICONS.collapse : ICONS.expand;
    toggle.setAttribute('aria-label', expanded ? 'Collapse controls' : 'Expand controls');
  });

  function setFilterPressed(filter) {
    currentFilter = normalizeFilter(filter);
    btnAll.setAttribute('aria-pressed', currentFilter === 'all' ? 'true' : 'false');
    btnPending.setAttribute('aria-pressed', currentFilter === 'pending' ? 'true' : 'false');
    btnDone.setAttribute('aria-pressed', currentFilter === 'done' ? 'true' : 'false');
  }

  function showUndo(show) {
    btnUndo.hidden = !show;
  }

  function render({ filter, total, completed }) {
    setFilterPressed(filter);
    summary.textContent = `${completed} of ${total} shown items completed`;
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
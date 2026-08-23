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

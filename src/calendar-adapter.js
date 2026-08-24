const CALENDAR_SELECTORS = [
  '.fc-event',
  '.fc-daygrid-event',
  '.fc-list-item',
  '.fc-event-inner',
  '.fc-event-main-frame'
];

function logicalRoot(node) {
  return node.closest?.('.fc-event, .fc-daygrid-event, .fc-list-item') || node;
}

export class CalendarAdapter {
  constructor(document) {
    if (!document?.querySelectorAll) throw new TypeError('A document is required.');
    this.document = document;
  }

  isPresent() {
    return Boolean(
      this.document.querySelector('.fc, .fc-daygrid, .fc-day-grid, .fc-view') ||
      this.document.location?.pathname?.includes('/calendar')
    );
  }

  discover() {
    const roots = new Set();
    for (const selector of CALENDAR_SELECTORS) {
      for (const match of this.document.querySelectorAll(selector)) roots.add(logicalRoot(match));
    }
    return [...roots].filter((node) => node?.nodeType === 1);
  }
}

export class RenderedItemRegistry {
  constructor() {
    this.byId = new Map();
  }

  replace(entries) {
    this.byId.clear();
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || !entry.node) continue;
      const record = this.byId.get(entry.id) || { checked: false, nodes: [] };
      record.checked = record.checked || Boolean(entry.checked);
      record.nodes.push(entry.node);
      this.byId.set(entry.id, record);
    }
  }

  prune() {
    for (const [id, record] of this.byId) {
      record.nodes = record.nodes.filter((node) => node.isConnected);
      if (record.nodes.length === 0) this.byId.delete(id);
    }
  }

  currentScopeIds() {
    return [...this.byId.keys()];
  }

  completedScopeIds() {
    return [...this.byId].filter(([, record]) => record.checked).map(([id]) => id);
  }

  occurrences(id) {
    return [...(this.byId.get(id)?.nodes || [])];
  }

  items() {
    return [...this.byId].map(([id, record]) => ({ id, checked: record.checked }));
  }
}

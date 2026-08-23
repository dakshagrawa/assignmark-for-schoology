export const DATA_KEY = 'scCalendarData';
export const DATA_VERSION = 3;
export const FILTER_MODES = Object.freeze(['all', 'pending', 'done']);
export const DEFAULT_SETTINGS = Object.freeze({ hide: false, dim: true, filter: 'all' });

const LEGACY_KEYS = Object.freeze({
  states: 'sc_cal_checkbox_states_calendar_only',
  settings: 'sc_cal_checkbox_settings_calendar_only',
  idMap: 'sc_cal_idmap_calendar_only_v2'
});

export function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function shortHash(value) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0;
  }
  return hash.toString(36);
}

export function elementPathFingerprint(element, depth = 6) {
  if (!element?.tagName) return '';
  const parts = [];
  let current = element;
  for (let level = 0; level < depth && current; level += 1, current = current.parentElement) {
    let position = 1;
    let sibling = current;
    while (sibling.previousElementSibling) {
      sibling = sibling.previousElementSibling;
      position += 1;
    }
    parts.push(`${current.tagName.toLowerCase()}:nth(${position})`);
  }
  return parts.join('>');
}

export function normalizeHref(href, origin = globalThis.location?.origin ?? 'https://fuhsd.schoology.com') {
  try {
    const url = new URL(href, origin);
    url.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid']) {
      url.searchParams.delete(key);
    }
    const query = [...url.searchParams].sort(([a], [b]) => a.localeCompare(b));
    url.search = '';
    for (const [key, value] of query) url.searchParams.append(key, value);
    return `${url.pathname}${url.search}`;
  } catch {
    return String(href ?? '');
  }
}

function findCanonical(node, origin) {
  // Never search above the current event root: doing so can borrow an ID from a
  // sibling event when FullCalendar rerenders several items under one container.
  const eventRoot = node.closest?.('.fc-event, .fc-daygrid-event, .fc-list-item') || node;
  let anchor = eventRoot.tagName === 'A' ? eventRoot : null;
  if (!anchor) {
    anchor = eventRoot.querySelector?.('a[href*="/assignment/"], a[href*="/event/"], a[href*="/events/"]') ?? null;
  }

  if (anchor?.href) {
    const path = normalizeHref(anchor.href, origin).split('?')[0];
    const match = path.match(/\/(assignment|event|events)\/(\d+)(?:\/|$)/);
    if (match) return { canonical: `href::${path}`, legacyIds: [] };
  }

  for (const attribute of ['data-assignment-id', 'data-event-id', 'data-event-instance', 'data-id']) {
    const owner = eventRoot.getAttribute?.(attribute)
      ? eventRoot
      : eventRoot.querySelector?.(`[${attribute}]`);
    const value = owner?.getAttribute(attribute);
    if (value) {
      return {
        canonical: `eid::${attribute}::${value}`,
        legacyIds: [`eid::${value}`]
      };
    }
  }
  return { canonical: null, legacyIds: [] };
}

function nearestContext(node) {
  const contextAttributes = ['data-date', 'data-start', 'data-end', 'aria-label', 'title'];
  const values = [];
  let current = node;
  for (let depth = 0; depth < 6 && current; depth += 1, current = current.parentElement) {
    for (const attribute of contextAttributes) {
      const value = current.getAttribute?.(attribute);
      if (value) values.push(`${attribute}:${normalize(value)}`);
    }
  }
  return values.join('|');
}

function matchingOccurrence(node, title, time) {
  const root = node.closest?.('.fc-event, .fc-daygrid-event, .fc-list-item') || node;
  let occurrence = 1;
  let sibling = root.previousElementSibling;
  while (sibling) {
    if (sibling.matches?.('.fc-event, .fc-daygrid-event, .fc-list-item')) {
      const siblingTitle = normalize(sibling.querySelector?.('.fc-event-title, .fc-title, .event-title')?.textContent || sibling.textContent);
      const siblingTime = normalize(sibling.querySelector?.('.fc-event-time, .fc-time')?.textContent);
      if (siblingTitle === title && siblingTime === time) occurrence += 1;
    }
    sibling = sibling.previousElementSibling;
  }
  return occurrence;
}

/** Build both legacy-compatible path and rerender-stable semantic aliases. */
export function buildIdCandidates(node, origin = globalThis.location?.origin ?? 'https://fuhsd.schoology.com') {
  if (!node?.tagName) throw new TypeError('A calendar element is required.');
  const { canonical, legacyIds } = findCanonical(node, origin);
  const titleElement = node.querySelector?.('.fc-event-title, .fc-title, .event-title');
  const linkElement = node.querySelector?.('a[href]');
  const title = normalize(titleElement?.textContent || linkElement?.textContent || node.textContent);
  const time = normalize(node.querySelector?.('.fc-event-time, .fc-time')?.textContent);
  const context = nearestContext(node);
  const linkPath = linkElement?.href ? normalizeHref(linkElement.href, origin) : '';
  const occurrence = matchingOccurrence(node, title, time);
  const elementPath = elementPathFingerprint(node, 6);

  // This exact shape preserves compatibility with v1.2's fallback IDs and ID map.
  const pathFingerprint = `${title}||${time}||${elementPath}`;
  const semanticKey = `${title}||${time}||${context}||${linkPath}||occurrence:${occurrence}`;
  const fallbackId = `cal::${shortHash(pathFingerprint)}`;
  const semanticAliases = [
    `semantic::${shortHash(semanticKey)}`,
    `content::${shortHash(`${title}||${time}||${context}||occurrence:${occurrence}`)}`
  ];

  return {
    canonical,
    fallbackId,
    legacyIds,
    pathFingerprint,
    semanticAliases,
    aliases: [...semanticAliases, pathFingerprint, `path::${shortHash(pathFingerprint)}`]
  };
}

function cleanRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function normalizeSettings(value) {
  const settings = cleanRecord(value);
  const filter = FILTER_MODES.includes(settings.filter)
    ? settings.filter
    : settings.hide
      ? 'pending'
      : 'all';
  return { ...DEFAULT_SETTINGS, ...settings, filter };
}

function cleanData(value) {
  const data = cleanRecord(value);
  return {
    version: DATA_VERSION,
    states: cleanRecord(data.states),
    settings: normalizeSettings(data.settings),
    idMap: cleanRecord(data.idMap)
  };
}

function parseLegacy(storage, key) {
  try {
    return cleanRecord(JSON.parse(storage?.getItem(key) || '{}'));
  } catch {
    return {};
  }
}

export class ExtensionStore {
  constructor(storageArea, legacyStorage = null) {
    if (!storageArea?.get || !storageArea?.set) throw new TypeError('A WebExtension storage area is required.');
    this.storageArea = storageArea;
    this.legacyStorage = legacyStorage;
    this.data = cleanData();
    this.queue = Promise.resolve();
    this.initialized = false;
  }

  async initialize() {
    const stored = await this.storageArea.get([DATA_KEY]);
    if (stored[DATA_KEY]) {
      this.data = cleanData(stored[DATA_KEY]);
    } else {
      this.data = cleanData({
        states: parseLegacy(this.legacyStorage, LEGACY_KEYS.states),
        settings: parseLegacy(this.legacyStorage, LEGACY_KEYS.settings),
        idMap: parseLegacy(this.legacyStorage, LEGACY_KEYS.idMap)
      });
      await this.storageArea.set({ [DATA_KEY]: this.data });
    }
    this.initialized = true;
    return this.snapshot();
  }

  snapshot() {
    return structuredClone(this.data);
  }

  getSettings() {
    return { ...this.data.settings };
  }

  isChecked(id) {
    return Boolean(id && this.data.states[id]);
  }

  checkedIds() {
    return Object.keys(this.data.states).filter((id) => Boolean(this.data.states[id]));
  }

  mutate(mutator) {
    if (!this.initialized) return Promise.reject(new Error('Storage is not initialized.'));
    const operation = this.queue.then(async () => {
      const next = this.snapshot();
      const result = mutator(next);
      next.version = DATA_VERSION;
      await this.storageArea.set({ [DATA_KEY]: next });
      this.data = next;
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async resolve(candidates) {
    let resolved;
    await this.mutate((next) => {
      const mappedIds = candidates.aliases.map((alias) => next.idMap[alias]).filter(Boolean);
      const target = candidates.canonical || mappedIds[0] || candidates.fallbackId;
      const sourceIds = new Set([candidates.fallbackId, ...candidates.legacyIds, ...mappedIds]);
      const checkedValues = [next.states[target], ...[...sourceIds].map((id) => next.states[id])]
        .filter((value) => Number.isFinite(Number(value)))
        .map(Number);

      if (checkedValues.length) next.states[target] = Math.max(...checkedValues);
      for (const sourceId of sourceIds) {
        if (sourceId !== target) delete next.states[sourceId];
      }
      for (const alias of candidates.aliases) next.idMap[alias] = target;
      resolved = { id: target, checked: Boolean(next.states[target]) };
    });
    return resolved;
  }

  setChecked(id, checked, timestamp = Date.now()) {
    return this.mutate((next) => {
      const related = new Set([id]);
      for (const mappedId of Object.values(next.idMap)) {
        if (mappedId === id) related.add(mappedId);
      }
      if (checked) next.states[id] = timestamp;
      else for (const relatedId of related) delete next.states[relatedId];
    });
  }

  updateSettings(patch) {
    return this.mutate((next) => {
      next.settings = normalizeSettings({ ...next.settings, ...cleanRecord(patch) });
    });
  }

  clearStates() {
    return this.mutate((next) => { next.states = {}; });
  }
}

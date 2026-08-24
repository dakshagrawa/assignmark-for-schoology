(() => {
  // src/core.js
  var DATA_KEY = "scCalendarData";
  var DATA_VERSION = 4;
  var FILTER_MODES = Object.freeze(["all", "pending", "done"]);
  var DEFAULT_SETTINGS = Object.freeze({ hide: false, dim: true, filter: "all" });
  var LEGACY_KEYS = Object.freeze({
    states: "sc_cal_checkbox_states_calendar_only",
    settings: "sc_cal_checkbox_settings_calendar_only",
    idMap: "sc_cal_idmap_calendar_only_v2"
  });
  function normalize(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  }
  function shortHash(value) {
    let hash = 2166136261 >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0;
    }
    return hash.toString(36);
  }
  function elementPathFingerprint(element, depth = 6) {
    if (!element?.tagName) return "";
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
    return parts.join(">");
  }
  function normalizeHref(href, origin = globalThis.location?.origin ?? "https://fuhsd.schoology.com") {
    try {
      const url = new URL(href, origin);
      url.hash = "";
      for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"]) {
        url.searchParams.delete(key);
      }
      const query = [...url.searchParams].sort(([a], [b]) => a.localeCompare(b));
      url.search = "";
      for (const [key, value] of query) url.searchParams.append(key, value);
      return `${url.pathname}${url.search}`;
    } catch {
      return String(href ?? "");
    }
  }
  function findCanonical(node, origin) {
    const eventRoot = node.closest?.(".fc-event, .fc-daygrid-event, .fc-list-item") || node;
    let anchor = eventRoot.tagName === "A" ? eventRoot : null;
    if (!anchor) {
      anchor = eventRoot.querySelector?.('a[href*="/assignment/"], a[href*="/event/"], a[href*="/events/"]') ?? null;
    }
    if (anchor?.href) {
      const path = normalizeHref(anchor.href, origin).split("?")[0];
      const match = path.match(/\/(assignment|event|events)\/(\d+)(?:\/|$)/);
      if (match) return { canonical: `href::${path}`, legacyIds: [] };
    }
    for (const attribute of ["data-assignment-id", "data-event-id", "data-event-instance", "data-id"]) {
      const owner = eventRoot.getAttribute?.(attribute) ? eventRoot : eventRoot.querySelector?.(`[${attribute}]`);
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
    const contextAttributes = ["data-date", "data-start", "data-end", "aria-label", "title"];
    const values = [];
    let current = node;
    for (let depth = 0; depth < 6 && current; depth += 1, current = current.parentElement) {
      for (const attribute of contextAttributes) {
        const value = current.getAttribute?.(attribute);
        if (value) values.push(`${attribute}:${normalize(value)}`);
      }
    }
    return values.join("|");
  }
  function matchingOccurrence(node, title, time) {
    const root = node.closest?.(".fc-event, .fc-daygrid-event, .fc-list-item") || node;
    let occurrence = 1;
    let sibling = root.previousElementSibling;
    while (sibling) {
      if (sibling.matches?.(".fc-event, .fc-daygrid-event, .fc-list-item")) {
        const siblingTitle = normalize(sibling.querySelector?.(".fc-event-title, .fc-title, .event-title")?.textContent || sibling.textContent);
        const siblingTime = normalize(sibling.querySelector?.(".fc-event-time, .fc-time")?.textContent);
        if (siblingTitle === title && siblingTime === time) occurrence += 1;
      }
      sibling = sibling.previousElementSibling;
    }
    return occurrence;
  }
  function buildIdCandidates(node, origin = globalThis.location?.origin ?? "https://fuhsd.schoology.com") {
    if (!node?.tagName) throw new TypeError("A calendar element is required.");
    const { canonical, legacyIds } = findCanonical(node, origin);
    const titleElement = node.querySelector?.(".fc-event-title, .fc-title, .event-title");
    const linkElement = node.querySelector?.("a[href]");
    const title = normalize(titleElement?.textContent || linkElement?.textContent || node.textContent);
    const time = normalize(node.querySelector?.(".fc-event-time, .fc-time")?.textContent);
    const context = nearestContext(node);
    const linkPath = linkElement?.href ? normalizeHref(linkElement.href, origin) : "";
    const occurrence = matchingOccurrence(node, title, time);
    const elementPath = elementPathFingerprint(node, 6);
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

  // src/storage-protocol.js
  var STORAGE_MESSAGE_TYPE = "assignmark:storage";

  // src/storage-client.js
  function cleanRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  }
  function cleanSnapshot(value) {
    const snapshot = cleanRecord(value);
    return {
      version: Number(snapshot.version) || DATA_VERSION,
      states: cleanRecord(snapshot.states),
      stateVersions: cleanRecord(snapshot.stateVersions),
      settings: { ...DEFAULT_SETTINGS, ...cleanRecord(snapshot.settings) },
      idMap: cleanRecord(snapshot.idMap)
    };
  }
  var StorageClient = class {
    constructor(sendMessage) {
      if (typeof sendMessage !== "function") throw new TypeError("A sendMessage function is required.");
      this.sendMessage = sendMessage;
      this.data = cleanSnapshot();
      this.initialized = false;
    }
    async request(operation, payload = {}) {
      const response = await this.sendMessage({ type: STORAGE_MESSAGE_TYPE, operation, ...payload });
      if (response?.ok === false) throw new Error(response.error || "Extension storage request failed.");
      if (!response?.snapshot) throw new Error("Extension storage returned no snapshot.");
      this.data = cleanSnapshot(response.snapshot);
      this.initialized = true;
      return response.result;
    }
    initialize(legacyData = void 0) {
      return this.request("initialize", { legacyData }).then(() => this.snapshot());
    }
    snapshot() {
      return structuredClone(this.data);
    }
    replaceSnapshot(snapshot) {
      this.data = cleanSnapshot(snapshot);
      this.initialized = true;
      return this.snapshot();
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
    checkedSnapshot(ids = this.checkedIds()) {
      const states = {};
      for (const id of new Set(Array.isArray(ids) ? ids : [])) {
        if (this.data.states[id]) states[id] = this.data.states[id];
      }
      return states;
    }
    setChecked(id, checked, timestamp = Date.now()) {
      return this.request("setChecked", { id, checked, timestamp });
    }
    updateSettings(patch) {
      return this.request("updateSettings", { patch });
    }
    resolve(candidates) {
      return this.request("resolve", { candidates });
    }
    resolveMany(candidatesList) {
      return this.request("resolveMany", { candidatesList });
    }
    clearCompleted(expectedStates) {
      return this.request("clearCompleted", { expectedStates });
    }
    clearAllStates(expectedStates) {
      return this.request("clearAllStates", { expectedStates });
    }
    restoreStates(snapshot) {
      return this.request("restoreStates", { snapshot });
    }
  };

  // src/calendar-adapter.js
  var CALENDAR_SELECTORS = [
    ".fc-event",
    ".fc-daygrid-event",
    ".fc-list-item",
    ".fc-event-inner",
    ".fc-event-main-frame"
  ];
  function logicalRoot(node) {
    return node.closest?.(".fc-event, .fc-daygrid-event, .fc-list-item") || node;
  }
  var CalendarAdapter = class {
    constructor(document2) {
      if (!document2?.querySelectorAll) throw new TypeError("A document is required.");
      this.document = document2;
    }
    isPresent() {
      return Boolean(
        this.document.querySelector(".fc, .fc-daygrid, .fc-day-grid, .fc-view") || this.document.location?.pathname?.includes("/calendar")
      );
    }
    discover() {
      const roots = /* @__PURE__ */ new Set();
      for (const selector of CALENDAR_SELECTORS) {
        for (const match of this.document.querySelectorAll(selector)) roots.add(logicalRoot(match));
      }
      return [...roots].filter((node) => node?.nodeType === 1);
    }
  };
  var RenderedItemRegistry = class {
    constructor() {
      this.byId = /* @__PURE__ */ new Map();
    }
    replace(entries) {
      this.byId.clear();
      for (const entry of Array.isArray(entries) ? entries : []) {
        if (!entry || typeof entry.id !== "string" || !entry.id || !entry.node) continue;
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
      return [...this.byId.get(id)?.nodes || []];
    }
    items() {
      return [...this.byId].map(([id, record]) => ({ id, checked: record.checked }));
    }
  };

  // src/control-center.js
  var VALID_FILTERS = FILTER_MODES;
  function normalizeFilter(value) {
    return VALID_FILTERS.includes(value) ? value : "all";
  }
  function summarizeRenderedItems(items) {
    const byId = /* @__PURE__ */ new Map();
    for (const item of Array.isArray(items) ? items : []) {
      if (!item || typeof item.id !== "string" || !item.id) continue;
      byId.set(item.id, Boolean(item.checked) || Boolean(byId.get(item.id)));
    }
    const completed = [...byId.values()].filter(Boolean).length;
    return {
      total: byId.size,
      completed,
      pending: byId.size - completed
    };
  }
  function isVisible(checked, filter) {
    switch (normalizeFilter(filter)) {
      case "pending":
        return !checked;
      case "done":
        return Boolean(checked);
      default:
        return true;
    }
  }
  function appearanceForItem(checked, settings = {}) {
    return {
      visible: isVisible(checked, settings.filter),
      dimmed: Boolean(checked && settings.dim)
    };
  }
  function makeButton(doc, id, iconSVG, label, pressed = null, dataFilter = null) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.id = id;
    if (pressed !== null) btn.setAttribute("aria-pressed", String(Boolean(pressed)));
    if (dataFilter) btn.setAttribute("data-filter", dataFilter);
    btn.innerHTML = `${iconSVG}<span>${label}</span>`;
    return btn;
  }
  function createControlCenter(doc, callbacks) {
    const ICONS = {
      filterAll: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v18H3zM5 5h14v14H5z"/></svg>',
      filterPending: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>',
      filterDone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
      clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>',
      undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>',
      collapse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
      expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6 6-6-6 1.41-1.41z"/></svg>'
    };
    const container = doc.createElement("div");
    container.className = "sc-cc";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Assignmark controls");
    const summary = doc.createElement("div");
    summary.className = "sc-cc-summary";
    summary.setAttribute("data-role", "progress");
    summary.setAttribute("aria-live", "polite");
    summary.textContent = "0 of 0 current-view items completed";
    container.appendChild(summary);
    const filters = doc.createElement("div");
    filters.className = "sc-cc-filters";
    filters.setAttribute("data-role", "filters");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Show items");
    const btnAll = makeButton(doc, "sc-cc-all", ICONS.filterAll, "All", true, "all");
    const btnPending = makeButton(doc, "sc-cc-pending", ICONS.filterPending, "Pending", false, "pending");
    const btnDone = makeButton(doc, "sc-cc-done", ICONS.filterDone, "Done", false, "done");
    filters.append(btnAll, btnPending, btnDone);
    container.appendChild(filters);
    const actions = doc.createElement("div");
    actions.className = "sc-cc-actions";
    const btnDim = makeButton(doc, "sc-cc-dim", ICONS.filterDone, "Dim", true);
    btnDim.setAttribute("data-role", "dim");
    const btnClearView = makeButton(doc, "sc-cc-clear-view", ICONS.clear, "Clear view");
    btnClearView.setAttribute("data-role", "clear-view");
    const btnClearAll = makeButton(doc, "sc-cc-clear-all", ICONS.clear, "Clear all");
    btnClearAll.setAttribute("data-role", "clear-all");
    const btnUndo = makeButton(doc, "sc-cc-undo", ICONS.undo, "Undo");
    btnUndo.hidden = true;
    btnUndo.setAttribute("data-role", "undo");
    actions.append(btnDim, btnClearView, btnClearAll, btnUndo);
    container.appendChild(actions);
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "sc-cc-toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Collapse controls");
    toggle.innerHTML = ICONS.collapse;
    container.appendChild(toggle);
    let currentFilter = "all";
    async function requestFilter(filter) {
      if (currentFilter === filter) return;
      await callbacks.onFilterChange?.(filter);
    }
    btnAll.addEventListener("click", () => void requestFilter("all"));
    btnPending.addEventListener("click", () => void requestFilter("pending"));
    btnDone.addEventListener("click", () => void requestFilter("done"));
    btnDim.addEventListener("click", () => callbacks.onDimChange?.());
    btnClearView.addEventListener("click", () => callbacks.onClearView?.());
    btnClearAll.addEventListener("click", () => callbacks.onClearAll?.());
    btnUndo.addEventListener("click", () => callbacks.onUndo?.());
    let expanded = true;
    toggle.addEventListener("click", () => {
      expanded = !expanded;
      container.classList.toggle("sc-cc-collapsed", !expanded);
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.innerHTML = expanded ? ICONS.collapse : ICONS.expand;
      toggle.setAttribute("aria-label", expanded ? "Collapse controls" : "Expand controls");
    });
    function setFilterPressed(filter) {
      currentFilter = normalizeFilter(filter);
      btnAll.setAttribute("aria-pressed", currentFilter === "all" ? "true" : "false");
      btnPending.setAttribute("aria-pressed", currentFilter === "pending" ? "true" : "false");
      btnDone.setAttribute("aria-pressed", currentFilter === "done" ? "true" : "false");
    }
    function showUndo(show) {
      btnUndo.hidden = !show;
    }
    function render2({ filter, dim, total, completed }) {
      setFilterPressed(filter);
      btnDim.setAttribute("aria-pressed", String(Boolean(dim)));
      summary.textContent = `${completed} of ${total} current-view items completed`;
    }
    return {
      element: container,
      render: render2,
      showUndo,
      destroy() {
        container.remove();
      }
    };
  }

  // src/content.js
  var POLL_MS = 3e3;
  var LEGACY_KEYS2 = {
    states: "sc_cal_checkbox_states_calendar_only",
    settings: "sc_cal_checkbox_settings_calendar_only",
    idMap: "sc_cal_idmap_calendar_only_v2"
  };
  var store = new StorageClient((message) => chrome.runtime.sendMessage(message));
  var adapter = new CalendarAdapter(document);
  var registry = new RenderedItemRegistry();
  var controlCenter = null;
  var undoSnapshot = null;
  var scanQueued = false;
  var scanRunning = false;
  function reportError(error, context) {
    console.error(`[Assignmark] ${context}`, error);
    let notice = document.querySelector(".sc-cal-error");
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "sc-cal-error";
      notice.setAttribute("role", "status");
      document.body?.appendChild(notice);
    }
    if (!notice) return;
    notice.textContent = "Assignmark could not save a change. Reload Schoology and try again.";
    clearTimeout(Number(notice.dataset.timer));
    notice.dataset.timer = String(setTimeout(() => notice.remove(), 8e3));
  }
  function readLegacyData() {
    const parse = (key) => {
      try {
        return JSON.parse(window.localStorage.getItem(key) || "{}");
      } catch {
        return {};
      }
    };
    return {
      states: parse(LEGACY_KEYS2.states),
      settings: parse(LEGACY_KEYS2.settings),
      idMap: parse(LEGACY_KEYS2.idMap)
    };
  }
  function applyState(id, checked) {
    const appearance = appearanceForItem(checked, store.getSettings());
    for (const element of registry.occurrences(id)) {
      element.classList.toggle("sc-checked-dim", appearance.dimmed);
      element.classList.toggle("sc-filtered-out", !appearance.visible);
      const checkbox = element.querySelector(".sc-cal-left-checkbox");
      if (checkbox instanceof HTMLInputElement) checkbox.checked = checked;
    }
  }
  function render() {
    for (const id of registry.currentScopeIds()) applyState(id, store.isChecked(id));
    registry.replace(registry.currentScopeIds().flatMap(
      (id) => registry.occurrences(id).map((node) => ({ id, node, checked: store.isChecked(id) }))
    ));
    const summary = summarizeRenderedItems(registry.items());
    controlCenter?.render({ ...summary, ...store.getSettings() });
    controlCenter?.showUndo(Boolean(undoSnapshot && Object.keys(undoSnapshot.states || {}).length));
  }
  function addCheckbox(node, resolution) {
    node.dataset.scId = resolution.id;
    node.dataset.scSource = "calendar";
    let checkbox = node.querySelector(".sc-cal-left-checkbox");
    if (!(checkbox instanceof HTMLInputElement)) {
      const wrapper = document.createElement("span");
      wrapper.className = "sc-cal-left-wrapper";
      wrapper.dataset.scLeft = "1";
      checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "sc-cal-left-checkbox";
      checkbox.title = "Mark done (calendar-only)";
      checkbox.setAttribute("aria-label", "Mark this calendar item done");
      const block = (event) => event.stopPropagation();
      for (const name of ["pointerdown", "touchstart", "mousedown"]) checkbox.addEventListener(name, block, { passive: true });
      checkbox.addEventListener("click", block, true);
      checkbox.addEventListener("change", async () => {
        const id = node.dataset.scId;
        const requested = checkbox.checked;
        checkbox.disabled = true;
        try {
          await store.setChecked(id, requested);
          render();
        } catch (error) {
          checkbox.checked = !requested;
          reportError(error, "Saving checkbox state failed.");
        } finally {
          checkbox.disabled = false;
        }
      });
      wrapper.appendChild(checkbox);
      const title = node.querySelector(".fc-event-title, .fc-title, .event-title, a") || node.firstChild;
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
        try {
          await store.updateSettings({ filter });
          render();
        } catch (error) {
          reportError(error, "Saving filter failed.");
        }
      },
      onDimChange: async () => {
        try {
          await store.updateSettings({ dim: !store.getSettings().dim });
          render();
        } catch (error) {
          reportError(error, "Saving Dim setting failed.");
        }
      },
      onClearView: async () => {
        const expectedStates = store.checkedSnapshot(registry.completedScopeIds());
        const count = Object.keys(expectedStates).length;
        if (count === 0 || !window.confirm(`Clear ${count} completed item${count === 1 ? "" : "s"} in the current view?`)) return;
        try {
          undoSnapshot = await store.clearCompleted(expectedStates);
          render();
        } catch (error) {
          reportError(error, "Clearing current-view checkoffs failed.");
        }
      },
      onClearAll: async () => {
        const expectedStates = store.checkedSnapshot();
        const count = Object.keys(expectedStates).length;
        if (count === 0 || !window.confirm(`Clear all ${count} saved checkoff${count === 1 ? "" : "s"}?`)) return;
        try {
          undoSnapshot = await store.clearAllStates(expectedStates);
          render();
        } catch (error) {
          reportError(error, "Clearing all checkoffs failed.");
        }
      },
      onUndo: async () => {
        if (!undoSnapshot) return;
        const snapshot = undoSnapshot;
        try {
          await store.restoreStates(snapshot);
          undoSnapshot = null;
          render();
        } catch (error) {
          reportError(error, "Restoring cleared checkoffs failed.");
        }
      }
    });
    document.body.appendChild(controlCenter.element);
  }
  async function scan() {
    if (scanRunning) {
      scanQueued = true;
      return;
    }
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
      reportError(error, "Scanning calendar items failed.");
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
      await store.initialize(readLegacyData());
    } catch (error) {
      reportError(error, "Extension storage initialization failed.");
      return;
    }
    await scan();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length > 0)) scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes[DATA_KEY]) scheduleScan();
    });
    setInterval(scheduleScan, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) scheduleScan();
    });
    window.addEventListener("focus", scheduleScan);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void init(), { once: true });
  else void init();
})();

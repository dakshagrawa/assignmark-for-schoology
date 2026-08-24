(() => {
  // src/core.js
  var DATA_KEY = "scCalendarData";
  var DATA_VERSION = 4;
  var FILTER_MODES = Object.freeze(["all", "pending", "done"]);
  var DEFAULT_SETTINGS = Object.freeze({ hide: false, dim: true, filter: "all", accentColor: "#0078d4" });
  function accentForeground(value) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
    if (!match) return "#ffffff";
    const channels = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return luminance > 0.45 ? "#111111" : "#ffffff";
  }
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
  function isDarkColor(value) {
    const match = String(value || "").match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!match || Number(match[4] ?? 1) === 0) return false;
    const channels = match.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
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
  var ICONS = Object.freeze({
    eyeOpen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.75"/></svg>',
    eyeClosed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A11.8 11.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15.7 15.7 0 0 1-2.4 3.1M6.3 6.3C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.6-.3 3.7-.7M9.9 9.9A3 3 0 0 0 14.1 14"/></svg>',
    fade: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="sc-icon-fill" d="M12 3a9 9 0 0 0 0 18V3Z"/></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M4.7 15a8 8 0 1 0 .2-6.3L4 10"/><path d="m9.5 12 1.7 1.7 3.6-4"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8 4 12l5 4v-3h5a5 5 0 0 1 5 5v1M4 12h10"/></svg>'
  });
  function makeButton(doc, { id, icon, label, role, pressed = null, primary = false }) {
    const button = doc.createElement("button");
    button.type = "button";
    button.id = id;
    button.className = primary ? "sc-icon-btn sc-cc-primary" : "sc-icon-btn";
    button.setAttribute("data-role", role);
    if (pressed !== null) button.setAttribute("aria-pressed", String(Boolean(pressed)));
    button.innerHTML = `${icon}<span class="sc-label">${label}</span>`;
    return button;
  }
  function setButtonContent(button, icon, label) {
    button.innerHTML = `${icon}<span class="sc-label">${label}</span>`;
  }
  function createControlCenter(doc, callbacks = {}) {
    const container = doc.createElement("div");
    container.className = "sc-cc";
    container.setAttribute("role", "toolbar");
    container.setAttribute("aria-label", "Assignmark calendar controls");
    const summary = doc.createElement("div");
    summary.className = "sc-cc-summary";
    summary.setAttribute("data-role", "progress");
    summary.setAttribute("aria-live", "polite");
    summary.setAttribute("aria-label", "0 of 0 current-view items completed");
    summary.title = "0 of 0 current-view items completed";
    summary.textContent = "0/0";
    const hideDone = makeButton(doc, {
      id: "sc-cc-hide-done",
      icon: ICONS.eyeOpen,
      label: "Hide done",
      role: "hide-done",
      pressed: false,
      primary: true
    });
    const fadeDone = makeButton(doc, {
      id: "sc-cc-dim",
      icon: ICONS.fade,
      label: "Fade done",
      role: "dim",
      pressed: true,
      primary: true
    });
    const resetView = makeButton(doc, {
      id: "sc-cc-clear-view",
      icon: ICONS.reset,
      label: "Reset view",
      role: "clear-view",
      primary: true
    });
    const undo = makeButton(doc, {
      id: "sc-cc-undo",
      icon: ICONS.undo,
      label: "Undo reset",
      role: "undo"
    });
    undo.hidden = true;
    hideDone.title = "Hide completed items from this calendar view.";
    fadeDone.title = "Make completed items lighter and strike them through. Checkmarks stay saved.";
    resetView.title = "No completed items in this calendar view.";
    resetView.disabled = true;
    container.append(summary, hideDone, fadeDone, resetView, undo);
    let currentFilter = "all";
    hideDone.addEventListener("click", () => {
      const nextFilter = currentFilter === "pending" ? "all" : currentFilter === "done" ? "all" : "pending";
      void callbacks.onFilterChange?.(nextFilter);
    });
    fadeDone.addEventListener("click", () => callbacks.onDimChange?.());
    resetView.addEventListener("click", () => callbacks.onClearView?.());
    undo.addEventListener("click", () => callbacks.onUndo?.());
    function showUndo(show) {
      undo.hidden = !show;
    }
    function render2({ filter, dim, total, completed, accentColor, resetPending = false }) {
      currentFilter = normalizeFilter(filter);
      const pendingOnly = currentFilter === "pending";
      const doneOnly = currentFilter === "done";
      hideDone.setAttribute("aria-pressed", String(pendingOnly));
      if (doneOnly) {
        setButtonContent(hideDone, ICONS.eyeOpen, "Show all");
        hideDone.title = "Showing only completed items. Click to show every item.";
        hideDone.setAttribute("aria-label", "Show all calendar items");
      } else {
        setButtonContent(hideDone, pendingOnly ? ICONS.eyeClosed : ICONS.eyeOpen, "Hide done");
        hideDone.title = pendingOnly ? "Completed items are hidden. Click to show them again." : "Hide completed items from this calendar view.";
        hideDone.setAttribute("aria-label", pendingOnly ? "Show completed calendar items" : "Hide completed calendar items");
      }
      fadeDone.setAttribute("aria-pressed", String(Boolean(dim)));
      fadeDone.title = dim ? "Completed items are faded and struck through. Click to show them normally." : "Make completed items lighter and strike them through. Checkmarks stay saved.";
      fadeDone.setAttribute("aria-label", dim ? "Stop fading completed items" : "Fade completed items");
      const progressLabel = `${completed} of ${total} current-view items completed`;
      summary.textContent = `${completed}/${total}`;
      summary.setAttribute("aria-label", progressLabel);
      summary.title = progressLabel;
      resetView.disabled = resetPending || completed === 0;
      resetView.setAttribute("aria-busy", String(Boolean(resetPending)));
      resetView.title = completed === 0 ? "No completed items in this calendar view." : "Remove checkmarks only from completed items visible in this calendar view.";
      resetView.setAttribute("aria-label", completed === 0 ? "Reset current view unavailable because no visible items are completed" : `Reset ${completed} completed item${completed === 1 ? "" : "s"} in this calendar view`);
      if (typeof accentColor === "string") {
        container.style.setProperty("--sc-assignmark-accent", accentColor);
        container.style.setProperty("--sc-assignmark-accent-foreground", accentForeground(accentColor));
      }
      const darkSurface = pageUsesDarkSurface(doc);
      container.classList.toggle("sc-cc-dark", darkSurface);
      container.classList.toggle("sc-cc-light", !darkSurface);
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

  // src/reset-action.js
  function createResetOperation({
    getExpectedStates,
    confirmAction = () => true,
    clear,
    onPendingChange = () => {
    },
    onSuccess = () => {
    },
    onZeroResult = () => {
    },
    onError = () => {
    }
  } = {}) {
    let pending = false;
    return async function reset() {
      if (pending) return;
      const expectedStates = getExpectedStates?.() || {};
      const expectedCount = Object.keys(expectedStates).length;
      if (expectedCount === 0 || !confirmAction(expectedCount, expectedStates)) return;
      pending = true;
      onPendingChange(true);
      try {
        const snapshot = await clear(expectedStates);
        const clearedCount = Object.keys(snapshot?.states || {}).length;
        if (clearedCount > 0) onSuccess(snapshot, clearedCount);
        else onZeroResult();
      } catch (error) {
        onError(error);
      } finally {
        pending = false;
        onPendingChange(false);
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
  var viewResetPending = false;
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
  function showNotice(message) {
    let notice = document.querySelector(".sc-cal-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "sc-cal-notice";
      notice.setAttribute("role", "status");
      document.body?.appendChild(notice);
    }
    if (!notice) return;
    notice.textContent = message;
    clearTimeout(Number(notice.dataset.timer));
    notice.dataset.timer = String(setTimeout(() => notice.remove(), 6e3));
  }
  var resetCurrentView = createResetOperation({
    getExpectedStates: () => store.checkedSnapshot(registry.completedScopeIds()),
    confirmAction: (count) => window.confirm(`Reset ${count} completed item${count === 1 ? "" : "s"} in the current view?`),
    clear: (expectedStates) => store.clearCompleted(expectedStates),
    onPendingChange: (pending) => {
      viewResetPending = pending;
      render();
    },
    onSuccess: (snapshot, count) => {
      undoSnapshot = snapshot;
      render();
      showNotice(`Reset ${count} checkoff${count === 1 ? "" : "s"} in this calendar view. Undo is available.`);
    },
    onZeroResult: () => {
      render();
      showNotice("No checkoffs were reset because the saved data changed.");
    },
    onError: (error) => reportError(error, "Resetting current-view checkoffs failed.")
  });
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
    const settings = store.getSettings();
    document.documentElement.style.setProperty("--sc-assignmark-accent", settings.accentColor);
    document.documentElement.style.setProperty("--sc-assignmark-accent-foreground", accentForeground(settings.accentColor));
    for (const id of registry.currentScopeIds()) applyState(id, store.isChecked(id));
    registry.replace(registry.currentScopeIds().flatMap(
      (id) => registry.occurrences(id).map((node) => ({ id, node, checked: store.isChecked(id) }))
    ));
    const summary = summarizeRenderedItems(registry.items());
    controlCenter?.render({ ...summary, ...settings, resetPending: viewResetPending });
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
          reportError(error, "Saving Fade completed setting failed.");
        }
      },
      onClearView: resetCurrentView,
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

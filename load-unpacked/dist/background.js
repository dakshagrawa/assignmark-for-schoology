(() => {
  // src/core.js
  var DATA_KEY = "scCalendarData";
  var DATA_VERSION = 4;
  var FILTER_MODES = Object.freeze(["all", "pending", "done"]);
  var CONTROL_SCALE_RANGE = Object.freeze({ min: 80, max: 120, step: 5 });
  var DEFAULT_SETTINGS = Object.freeze({ hide: false, dim: true, filter: "all", accentColor: "#0a84ff", controlScale: 100, showHideDone: true, showFadeDone: true, showResetView: true, moveMode: false, controlPosition: Object.freeze({ right: 12, bottom: 70 }) });
  var LEGACY_KEYS = Object.freeze({
    states: "sc_cal_checkbox_states_calendar_only",
    settings: "sc_cal_checkbox_settings_calendar_only",
    idMap: "sc_cal_idmap_calendar_only_v2"
  });
  function resolveCandidates(data, candidates) {
    const { canonical, fallbackId, legacyIds, aliases } = candidates;
    const mappedIds = aliases.map((alias) => data.idMap[alias]).filter(Boolean);
    const target = canonical || mappedIds[0] || fallbackId;
    const sourceIds = /* @__PURE__ */ new Set([fallbackId, ...legacyIds, ...mappedIds]);
    const checkedValues = [data.states[target], ...[...sourceIds].map((id) => data.states[id])].filter((value) => Number.isFinite(Number(value))).map(Number);
    let changed = false;
    const newStates = { ...data.states };
    const newStateVersions = { ...cleanRecord(data.stateVersions) };
    const newIdMap = { ...data.idMap };
    const stateVersionValues = [newStateVersions[target], ...[...sourceIds].map((id) => newStateVersions[id])].filter((value) => Number.isFinite(Number(value))).map(Number);
    if (stateVersionValues.length) {
      const maxVersion = Math.max(...stateVersionValues);
      if (Number(newStateVersions[target]) !== maxVersion) {
        newStateVersions[target] = maxVersion;
        changed = true;
      }
    }
    if (checkedValues.length) {
      const maxTimestamp = Math.max(...checkedValues);
      if (!Number.isFinite(newStates[target]) || newStates[target] !== maxTimestamp) {
        newStates[target] = maxTimestamp;
        changed = true;
      }
    }
    for (const sourceId of sourceIds) {
      if (sourceId !== target && newStates[sourceId] !== void 0) {
        delete newStates[sourceId];
        changed = true;
      }
      if (sourceId !== target && newStateVersions[sourceId] !== void 0) {
        delete newStateVersions[sourceId];
        changed = true;
      }
    }
    for (const alias of aliases) {
      if (newIdMap[alias] !== target) {
        newIdMap[alias] = target;
        changed = true;
      }
    }
    const resolution = { id: target, checked: Boolean(newStates[target]) };
    return {
      resolution,
      changed,
      next: changed ? { ...data, states: newStates, stateVersions: newStateVersions, idMap: newIdMap } : data
    };
  }
  function cleanRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  }
  function normalizeSettings(value) {
    const settings = cleanRecord(value);
    const filter = FILTER_MODES.includes(settings.filter) ? settings.filter : settings.hide ? "pending" : "all";
    const accentColor = /^#[0-9a-f]{6}$/i.test(String(settings.accentColor || "")) ? String(settings.accentColor).toLowerCase() : DEFAULT_SETTINGS.accentColor;
    const controlScale = Number.isFinite(Number(settings.controlScale)) ? Math.min(CONTROL_SCALE_RANGE.max, Math.max(CONTROL_SCALE_RANGE.min, Math.round(Number(settings.controlScale) / CONTROL_SCALE_RANGE.step) * CONTROL_SCALE_RANGE.step)) : DEFAULT_SETTINGS.controlScale;
    const rawPosition = cleanRecord(settings.controlPosition);
    const controlPosition = {
      right: Number.isFinite(Number(rawPosition.right)) ? Math.max(0, Math.round(Number(rawPosition.right))) : DEFAULT_SETTINGS.controlPosition.right,
      bottom: Number.isFinite(Number(rawPosition.bottom)) ? Math.max(0, Math.round(Number(rawPosition.bottom))) : DEFAULT_SETTINGS.controlPosition.bottom
    };
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      filter,
      accentColor,
      controlScale,
      showHideDone: settings.showHideDone !== false,
      showFadeDone: settings.showFadeDone !== false,
      showResetView: settings.showResetView !== false,
      moveMode: settings.moveMode === true,
      controlPosition
    };
  }
  function cleanData(value) {
    const data = cleanRecord(value);
    return {
      version: DATA_VERSION,
      states: cleanRecord(data.states),
      stateVersions: cleanRecord(data.stateVersions),
      settings: normalizeSettings(data.settings),
      idMap: cleanRecord(data.idMap),
      legacyMigrationPending: data.legacyMigrationPending === true
    };
  }
  function mergeLateLegacyData(current, legacyData) {
    const legacy = cleanData(legacyData);
    const settings = { ...current.settings };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (settings[key] === DEFAULT_SETTINGS[key]) settings[key] = legacy.settings[key];
    }
    return cleanData({
      ...current,
      states: { ...legacy.states, ...current.states },
      settings,
      idMap: { ...legacy.idMap, ...current.idMap },
      legacyMigrationPending: false
    });
  }
  function nextStateVersion(data, timestamp = Date.now()) {
    const current = Object.values(cleanRecord(data.stateVersions)).map(Number).filter(Number.isFinite).reduce((maximum, value) => Math.max(maximum, value), 0);
    const requested = Number(timestamp);
    return Math.max(Date.now(), Number.isFinite(requested) ? requested : 0, current + 1);
  }
  function parseLegacy(storage, key) {
    try {
      return cleanRecord(JSON.parse(storage?.getItem(key) || "{}"));
    } catch {
      return {};
    }
  }
  var DataRepository = class {
    constructor(storageArea, legacyStorage = null) {
      if (!storageArea?.get || !storageArea?.set) throw new TypeError("A WebExtension storage area is required.");
      this.storageArea = storageArea;
      this.legacyStorage = legacyStorage;
      this.data = cleanData();
      this.queue = Promise.resolve();
      this.initialized = false;
    }
    async initialize(legacyData = null) {
      const stored = await this.storageArea.get([DATA_KEY]);
      if (stored[DATA_KEY]) {
        this.data = cleanData(stored[DATA_KEY]);
        if (this.data.legacyMigrationPending && legacyData) {
          this.data = mergeLateLegacyData(this.data, legacyData);
          await this.storageArea.set({ [DATA_KEY]: this.data });
        }
      } else if (legacyData) {
        this.data = cleanData({ ...legacyData, legacyMigrationPending: false });
        await this.storageArea.set({ [DATA_KEY]: this.data });
      } else {
        this.data = cleanData({
          states: parseLegacy(this.legacyStorage, LEGACY_KEYS.states),
          settings: parseLegacy(this.legacyStorage, LEGACY_KEYS.settings),
          idMap: parseLegacy(this.legacyStorage, LEGACY_KEYS.idMap),
          legacyMigrationPending: !this.legacyStorage
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
      if (!this.initialized) return Promise.reject(new Error("Storage is not initialized."));
      const operation = this.queue.then(async () => {
        const next = this.snapshot();
        const result = mutator(next);
        next.version = DATA_VERSION;
        await this.storageArea.set({ [DATA_KEY]: next });
        this.data = next;
        return result;
      });
      this.queue = operation.catch(() => void 0);
      return operation;
    }
    async resolve(candidates) {
      let resolved;
      await this.mutate((next) => {
        const result = resolveCandidates(next, candidates);
        resolved = result.resolution;
        if (result.changed) {
          Object.assign(next, result.next);
        }
      });
      return resolved;
    }
    async resolveMany(candidatesList) {
      if (!Array.isArray(candidatesList) || candidatesList.length === 0) return [];
      const operation = this.queue.then(async () => {
        let workingData = this.snapshot();
        let changed = false;
        const resolutions = [];
        for (const candidates of candidatesList) {
          const result = resolveCandidates(workingData, candidates);
          resolutions.push(result.resolution);
          if (result.changed) {
            changed = true;
            workingData = result.next;
          }
        }
        if (changed) {
          workingData.version = DATA_VERSION;
          await this.storageArea.set({ [DATA_KEY]: workingData });
          this.data = workingData;
        }
        return resolutions;
      });
      this.queue = operation.catch(() => void 0);
      return operation;
    }
    setChecked(id, checked, timestamp = Date.now()) {
      return this.mutate((next) => {
        const related = /* @__PURE__ */ new Set([id]);
        for (const mappedId of Object.values(next.idMap)) {
          if (mappedId === id) related.add(mappedId);
        }
        const revision = nextStateVersion(next, timestamp);
        if (checked) {
          next.states[id] = timestamp;
          next.stateVersions[id] = revision;
        } else {
          for (const relatedId of related) {
            delete next.states[relatedId];
            next.stateVersions[relatedId] = revision;
          }
        }
      });
    }
    updateSettings(patch) {
      return this.mutate((next) => {
        next.settings = normalizeSettings({ ...next.settings, ...cleanRecord(patch) });
      });
    }
    resetSettings() {
      return this.mutate((next) => {
        next.settings = normalizeSettings(DEFAULT_SETTINGS);
      });
    }
    clearCompleted(expectedStates) {
      return this.clearConfirmedStates(expectedStates);
    }
    clearAllStates(expectedStates) {
      return this.clearConfirmedStates(expectedStates);
    }
    clearConfirmedStates(expectedStates) {
      const expected = cleanRecord(expectedStates);
      if (Object.keys(expected).length === 0) return Promise.resolve({ states: {}, versions: {} });
      const operation = this.queue.then(async () => {
        const next = this.snapshot();
        const removed = { states: {}, versions: {}, aliases: {} };
        const matches = Object.entries(expected).filter(
          ([id, rawTimestamp]) => id && Number(next.states[id]) === Number(rawTimestamp)
        );
        if (matches.length === 0) return removed;
        const revision = nextStateVersion(next);
        for (const [id, rawTimestamp] of matches) {
          removed.states[id] = Number(rawTimestamp);
          removed.versions[id] = revision;
          removed.aliases[id] = Object.entries(next.idMap).filter(([, target]) => target === id).map(([alias]) => alias);
          delete next.states[id];
          next.stateVersions[id] = revision;
        }
        next.version = DATA_VERSION;
        await this.storageArea.set({ [DATA_KEY]: next });
        this.data = next;
        return removed;
      });
      this.queue = operation.catch(() => void 0);
      return operation;
    }
    restoreStates(snapshot) {
      const states = cleanRecord(snapshot?.states);
      const versions = cleanRecord(snapshot?.versions);
      const aliases = cleanRecord(snapshot?.aliases);
      if (Object.keys(states).length === 0) return Promise.resolve({});
      const operation = this.queue.then(async () => {
        const next = this.snapshot();
        const restored = {};
        const eligible = Object.entries(states).map(([id, rawTimestamp]) => {
          const timestamp = Number(rawTimestamp);
          const clearedVersion = Number(versions[id]);
          const migratedTargets = Array.isArray(aliases[id]) ? aliases[id].map((alias) => next.idMap[alias]).filter(Boolean) : [];
          const target = [id, ...migratedTargets].find(
            (candidate) => Number(next.stateVersions[candidate]) === clearedVersion
          );
          return { id, target, timestamp, clearedVersion };
        }).filter(
          ({ id, target, timestamp, clearedVersion }) => id && target && Number.isFinite(timestamp) && timestamp > 0 && Number.isFinite(clearedVersion)
        );
        if (eligible.length === 0) return restored;
        const revision = nextStateVersion(next);
        for (const { target, timestamp } of eligible) {
          const existing = Number(next.states[target]);
          const value = Number.isFinite(existing) ? Math.max(existing, timestamp) : timestamp;
          next.states[target] = value;
          next.stateVersions[target] = revision;
          restored[target] = value;
        }
        next.version = DATA_VERSION;
        await this.storageArea.set({ [DATA_KEY]: next });
        this.data = next;
        return restored;
      });
      this.queue = operation.catch(() => void 0);
      return operation;
    }
  };

  // src/storage-protocol.js
  var STORAGE_MESSAGE_TYPE = "assignmark:storage";

  // src/background.js
  function createStorageMessageHandler(repository) {
    if (!repository) throw new TypeError("A data repository is required.");
    let initialization = null;
    const ensureInitialized = (legacyData) => {
      if (!initialization) initialization = repository.initialize(legacyData);
      else if (legacyData) initialization = initialization.then(() => repository.initialize(legacyData));
      return initialization;
    };
    return async function handleStorageMessage(message) {
      if (!message || message.type !== STORAGE_MESSAGE_TYPE) return void 0;
      const operation = message.operation;
      await ensureInitialized(message.legacyData);
      let result;
      switch (operation) {
        case "initialize":
          break;
        case "setChecked":
          result = await repository.setChecked(message.id, message.checked, message.timestamp);
          break;
        case "updateSettings":
          result = await repository.updateSettings(message.patch);
          break;
        case "resetSettings":
          result = await repository.resetSettings();
          break;
        case "resolve":
          result = await repository.resolve(message.candidates);
          break;
        case "resolveMany":
          result = await repository.resolveMany(message.candidatesList);
          break;
        case "clearCompleted":
          result = await repository.clearCompleted(message.expectedStates);
          break;
        case "clearAllStates":
          result = await repository.clearAllStates(message.expectedStates);
          break;
        case "restoreStates":
          result = await repository.restoreStates(message.snapshot);
          break;
        default:
          throw new Error(`Unknown storage operation: ${String(operation)}`);
      }
      return { result, snapshot: repository.snapshot() };
    };
  }
  if (globalThis.chrome?.runtime?.onMessage && globalThis.chrome?.storage?.local) {
    const repository = new DataRepository(globalThis.chrome.storage.local);
    const handleStorageMessage = createStorageMessageHandler(repository);
    globalThis.chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== STORAGE_MESSAGE_TYPE) return false;
      handleStorageMessage(message).then((response) => sendResponse({ ok: true, ...response })).catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
      return true;
    });
  }
})();

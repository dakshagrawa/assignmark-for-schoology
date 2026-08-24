import { DATA_VERSION, DEFAULT_SETTINGS } from './core.js';
import { STORAGE_MESSAGE_TYPE } from './storage-protocol.js';

function cleanRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
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

export class StorageClient {
  constructor(sendMessage) {
    if (typeof sendMessage !== 'function') throw new TypeError('A sendMessage function is required.');
    this.sendMessage = sendMessage;
    this.data = cleanSnapshot();
    this.initialized = false;
  }

  async request(operation, payload = {}) {
    const response = await this.sendMessage({ type: STORAGE_MESSAGE_TYPE, operation, ...payload });
    if (response?.ok === false) throw new Error(response.error || 'Extension storage request failed.');
    if (!response?.snapshot) throw new Error('Extension storage returned no snapshot.');
    this.data = cleanSnapshot(response.snapshot);
    this.initialized = true;
    return response.result;
  }

  initialize(legacyData = undefined) {
    return this.request('initialize', { legacyData }).then(() => this.snapshot());
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
    return this.request('setChecked', { id, checked, timestamp });
  }

  updateSettings(patch) {
    return this.request('updateSettings', { patch });
  }

  resetSettings() {
    return this.request('resetSettings');
  }

  resolve(candidates) {
    return this.request('resolve', { candidates });
  }

  resolveMany(candidatesList) {
    return this.request('resolveMany', { candidatesList });
  }

  clearCompleted(expectedStates) {
    return this.request('clearCompleted', { expectedStates });
  }

  clearAllStates(expectedStates) {
    return this.request('clearAllStates', { expectedStates });
  }

  restoreStates(snapshot) {
    return this.request('restoreStates', { snapshot });
  }
}

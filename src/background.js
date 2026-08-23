import { DataRepository } from './core.js';
import { STORAGE_MESSAGE_TYPE } from './storage-protocol.js';

export function createStorageMessageHandler(repository) {
  if (!repository) throw new TypeError('A data repository is required.');
  let initialization = null;

  const ensureInitialized = (legacyData) => {
    if (!initialization) initialization = repository.initialize(legacyData);
    return initialization;
  };

  return async function handleStorageMessage(message) {
    if (!message || message.type !== STORAGE_MESSAGE_TYPE) return undefined;
    const operation = message.operation;
    await ensureInitialized(message.legacyData);

    let result;
    switch (operation) {
      case 'initialize':
        break;
      case 'setChecked':
        result = await repository.setChecked(message.id, message.checked, message.timestamp);
        break;
      case 'updateSettings':
        result = await repository.updateSettings(message.patch);
        break;
      case 'resolve':
        result = await repository.resolve(message.candidates);
        break;
      case 'clearCompleted':
        result = await repository.clearCompleted(message.ids);
        break;
      case 'clearAllStates':
        result = await repository.clearAllStates();
        break;
      case 'clearStates':
        result = await repository.clearStates(message.ids);
        break;
      case 'restoreStates':
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
    handleStorageMessage(message)
      .then((response) => sendResponse({ ok: true, ...response }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  });
}

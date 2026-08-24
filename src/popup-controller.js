import { StorageClient } from './storage-client.js';
import { createSettingsPopup } from './popup-ui.js';
import { createResetOperation } from './reset-action.js';

export async function initSettingsPopup(doc, {
  sendMessage,
  confirmAction = (message) => globalThis.confirm(message),
  subscribeStorage
} = {}) {
  const store = new StorageClient(sendMessage);
  let undoSnapshot = null;
  let resetPending = false;
  let popup;

  const render = () => {
    popup.render({
      settings: store.getSettings(),
      checkedCount: Object.keys(store.checkedSnapshot()).length,
      canUndo: Boolean(undoSnapshot && Object.keys(undoSnapshot.states || {}).length),
      resetPending
    });
  };

  const resetAll = createResetOperation({
    getExpectedStates: () => store.checkedSnapshot(),
    confirmAction: (count) => confirmAction(`Reset all ${count} saved checkoffs across every calendar date?`),
    clear: (expectedStates) => store.clearAllStates(expectedStates),
    onPendingChange: (pending) => { resetPending = pending; render(); },
    onSuccess: (snapshot, count) => {
      undoSnapshot = snapshot;
      popup.setStatus(`Reset ${count} checkoff${count === 1 ? '' : 's'} from every calendar date.`, 'success');
    },
    onZeroResult: () => popup.setStatus('No checkoffs were reset because the saved data changed.', 'neutral'),
    onError: (error) => {
      popup.setStatus('Could not reset saved checkoffs. Try again.', 'error');
      console.error('[Assignmark] Reset all failed.', error);
    }
  });

  const undo = async () => {
    if (!undoSnapshot) return;
    const snapshot = undoSnapshot;
    const count = Object.keys(snapshot.states || {}).length;
    try {
      const restored = await store.restoreStates(snapshot);
      const restoredCount = Object.keys(restored || {}).length;
      undoSnapshot = null;
      render();
      popup.setStatus(restoredCount > 0
        ? `Restored ${restoredCount} checkoff${restoredCount === 1 ? '' : 's'}.`
        : 'No checkoffs were restored because the saved data changed.', restoredCount > 0 ? 'success' : 'neutral');
    } catch (error) {
      popup.setStatus('Could not restore checkoffs. Try again.', 'error');
      console.error('[Assignmark] Undo reset failed.', error);
    }
  };

  const updateFilter = async (filter) => {
    try {
      await store.updateSettings({ filter });
      render();
      const messages = {
        all: 'Showing all calendar items.',
        pending: 'Showing unfinished items.',
        done: 'Showing completed items.'
      };
      popup.setStatus(messages[filter] || messages.all, 'success');
    } catch (error) {
      popup.setStatus('Could not update the calendar view. Try again.', 'error');
      console.error('[Assignmark] Updating the calendar view failed.', error);
    }
  };

  const updateDim = async (dim) => {
    try {
      await store.updateSettings({ dim });
      render();
      popup.setStatus(dim
        ? 'Completed items now fade without being hidden or unchecked.'
        : 'Completed items now stay at full brightness.', 'success');
    } catch (error) {
      popup.setStatus('Could not update the Fade completed setting. Try again.', 'error');
      console.error('[Assignmark] Updating Fade completed failed.', error);
    }
  };

  const updateAccent = async (value) => {
    const accentColor = String(value || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(accentColor)) {
      render();
      popup.setStatus('Enter a six-digit hex color, such as #0078d4.', 'error');
      return;
    }
    try {
      await store.updateSettings({ accentColor });
      render();
      popup.setStatus('Accent color updated.', 'success');
    } catch (error) {
      popup.setStatus('Could not update the accent color. Try again.', 'error');
      console.error('[Assignmark] Updating the accent color failed.', error);
    }
  };

  popup = createSettingsPopup(doc, {
    onFilterChange: updateFilter,
    onDimChange: updateDim,
    onAccentChange: updateAccent,
    onResetAll: resetAll,
    onUndo: undo
  });
  doc.querySelector('#app')?.appendChild(popup.element);
  await store.initialize();
  render();
  subscribeStorage?.((snapshot) => {
    store.replaceSnapshot(snapshot);
    render();
  });
  return { popup, store };
}

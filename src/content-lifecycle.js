function safely(cleanup) {
  try {
    cleanup();
  } catch {
    // Chrome extension APIs can throw while an invalidated context is tearing down.
  }
}

export function createContentLifecycle({
  clearInterval,
  removeStorageListener = () => {},
  removeVisibilityListener = () => {},
  removeFocusListener = () => {}
}) {
  let invalidated = false;
  let scanTimerId = null;
  let mutationObserver = null;
  let scanQueued = false;

  return {
    isInvalidated() {
      return invalidated;
    },

    trackTimer(timerId) {
      if (invalidated) {
        safely(() => clearInterval(timerId));
        return false;
      }
      scanTimerId = timerId;
      return true;
    },

    trackObserver(observer) {
      if (invalidated) {
        safely(() => observer?.disconnect());
        return false;
      }
      mutationObserver = observer;
      return true;
    },

    queueScan() {
      if (invalidated || scanQueued) return false;
      scanQueued = true;
      return true;
    },

    takeQueuedScan() {
      if (invalidated || !scanQueued) return false;
      scanQueued = false;
      return true;
    },

    stop() {
      if (invalidated) return;
      invalidated = true;
      scanQueued = false;

      if (scanTimerId !== null) safely(() => clearInterval(scanTimerId));
      scanTimerId = null;
      safely(() => mutationObserver?.disconnect());
      mutationObserver = null;
      safely(removeStorageListener);
      safely(removeVisibilityListener);
      safely(removeFocusListener);
    },

    inspect() {
      return {
        invalidated,
        hasTimer: scanTimerId !== null,
        hasObserver: mutationObserver !== null,
        scanQueued
      };
    }
  };
}

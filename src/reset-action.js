export function createResetOperation({
  getExpectedStates,
  confirmAction = () => true,
  clear,
  onPendingChange = () => {},
  onSuccess = () => {},
  onZeroResult = () => {},
  onError = () => {}
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

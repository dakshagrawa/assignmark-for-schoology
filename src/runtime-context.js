const INVALIDATED_CONTEXT_PATTERN = /extension context invalidated/i;

export function isExtensionContextInvalidated(error, runtimeId) {
  if (!runtimeId) return true;
  const message = typeof error === 'string' ? error : error?.message;
  return INVALIDATED_CONTEXT_PATTERN.test(String(message || ''));
}

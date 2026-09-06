import test from 'node:test';
import assert from 'node:assert/strict';
import { isExtensionContextInvalidated } from '../src/runtime-context.js';

test('detects Chrome extension-context invalidation errors by message', () => {
  assert.equal(isExtensionContextInvalidated(new Error('Extension context invalidated.'), 'extension-id'), true);
  assert.equal(isExtensionContextInvalidated({ message: 'Uncaught Error: Extension context invalidated' }, 'extension-id'), true);
});

test('treats a missing runtime id as an invalidated context', () => {
  assert.equal(isExtensionContextInvalidated(new Error('any failure'), ''), true);
  assert.equal(isExtensionContextInvalidated(null, undefined), true);
});

test('does not suppress genuine storage or coordinator failures', () => {
  assert.equal(isExtensionContextInvalidated(new Error('Extension storage returned no snapshot.'), 'extension-id'), false);
  assert.equal(isExtensionContextInvalidated(new Error('Coordinator rejected operation.'), 'extension-id'), false);
});

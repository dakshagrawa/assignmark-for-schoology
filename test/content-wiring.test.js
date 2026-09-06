import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/content.js', import.meta.url), 'utf8');
const popupSource = await readFile(new URL('../src/popup-controller.js', import.meta.url), 'utf8');

test('content entrypoint reaches the service-worker client and calendar adapter', () => {
  assert.match(source, /import \{ StorageClient \} from '\.\/storage-client\.js'/);
  assert.match(source, /import \{ CalendarAdapter, RenderedItemRegistry \} from '\.\/calendar-adapter\.js'/);
  assert.doesNotMatch(source, /new ExtensionStore\(/);
  assert.match(source, /new StorageClient\(/);
  assert.match(source, /\.resolveMany\(/);
});

test('contextual reset stays in the calendar while global reset lives in settings', () => {
  assert.match(source, /\.clearCompleted\(/);
  assert.doesNotMatch(source, /\.clearAllStates\(/);
  assert.match(popupSource, /\.clearAllStates\(/);
  assert.match(source, /appearanceForItem\(/);
  assert.doesNotMatch(source, /settings\.hide/);
});

test('current-view reset uses Reset wording and reports a successful scoped result', () => {
  assert.match(source, /window\.confirm\(`Reset \$\{count\} completed item/);
  assert.match(source, /showNotice\(`Reset \$\{count\} checkoff/);
  assert.match(source, /in this calendar view\. Undo is available\./);
});

test('user-facing calendar copy no longer calls fading Dim', () => {
  assert.doesNotMatch(source, /Saving Dim setting failed/);
  assert.match(source, /Saving Fade completed setting failed/);
});

test('content entrypoint applies the saved accent color to calendar checkboxes and controls', () => {
  assert.match(source, /style\.setProperty\(\s*'--sc-assignmark-accent'/);
  assert.match(source, /style\.setProperty\(\s*'--sc-assignmark-accent-foreground'/);
  assert.match(source, /accentForeground\(settings\.accentColor\)/);
});

test('content entrypoint removes the calendar-only control center when the calendar leaves the DOM', () => {
  assert.match(source, /if \(!adapter\.isPresent\(\)\) \{\s*controlCenter\?\.destroy\(\);\s*controlCenter = null;\s*return;\s*\}/);
});

test('invalidated extension context routes all lifecycle work through the executable controller', () => {
  assert.match(source, /import \{ isExtensionContextInvalidated \} from '\.\/runtime-context\.js'/);
  assert.match(source, /import \{ createContentLifecycle \} from '\.\/content-lifecycle\.js'/);
  assert.match(source, /const lifecycle = createContentLifecycle\(/);
  assert.match(source, /async function sendStorageMessage\(message\)/);
  assert.match(source, /await chrome\.runtime\.sendMessage\(message\)/);
  assert.match(source, /if \(isExtensionContextInvalidated\(error, chrome\.runtime\?\.id\)\) stopBackgroundWork\(\);/);
  assert.match(source, /if \(lifecycle\.isInvalidated\(\)\) return;\s*const mutationObserver/);
  assert.match(source, /if \(!lifecycle\.trackObserver\(mutationObserver\)\) return;/);
  assert.match(source, /lifecycle\.trackTimer\(setInterval\(scheduleScan, POLL_MS\)\)/);
});

test('error reporting stays silent for message-based invalidation but reports genuine failures', () => {
  const reportRule = source.match(/function reportError\(error, context\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(reportRule, /isExtensionContextInvalidated\(error, chrome\.runtime\?\.id\)/);
  assert.match(reportRule, /console\.error\(`/);
});

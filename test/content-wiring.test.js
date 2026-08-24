import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/content.js', import.meta.url), 'utf8');

test('content entrypoint reaches the service-worker client and calendar adapter', () => {
  assert.match(source, /import \{ StorageClient \} from '\.\/storage-client\.js'/);
  assert.match(source, /import \{ CalendarAdapter, RenderedItemRegistry \} from '\.\/calendar-adapter\.js'/);
  assert.doesNotMatch(source, /new ExtensionStore\(/);
  assert.match(source, /new StorageClient\(/);
  assert.match(source, /\.resolveMany\(/);
});

test('content entrypoint uses explicit clear operations and filter-driven appearance', () => {
  assert.match(source, /\.clearCompleted\(/);
  assert.match(source, /\.clearAllStates\(/);
  assert.match(source, /appearanceForItem\(/);
  assert.doesNotMatch(source, /settings\.hide/);
});

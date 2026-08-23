import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

test('manifest keeps minimal scope and uses the local storage coordinator', () => {
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://fuhsd.schoology.com/*']);
  assert.equal(manifest.background.service_worker, 'dist/background.js');
  assert.equal(manifest.background.type, undefined);
});

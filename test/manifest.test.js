import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('release metadata identifies version 2.2.1 consistently', () => {
  assert.equal(manifest.version, '2.2.1');
  assert.equal(packageJson.version, manifest.version);
});

test('manifest exposes the local settings popup without adding permissions', () => {
  assert.equal(manifest.action?.default_popup, 'src/popup.html');
  assert.equal(manifest.action?.default_title, 'Assignmark settings');
  assert.deepEqual(manifest.permissions, ['storage']);
});

test('manifest keeps minimal scope and uses the local storage coordinator', () => {
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://fuhsd.schoology.com/*']);
  assert.equal(manifest.background.service_worker, 'dist/background.js');
  assert.equal(manifest.background.type, undefined);
});

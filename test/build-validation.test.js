import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseManifest } from '../scripts/manifest-validation.mjs';
import { readFile } from 'node:fs/promises';

const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

const valid = {
  manifest_version: 3,
  permissions: ['storage'],
  content_scripts: [{ matches: ['https://fuhsd.schoology.com/*'] }]
};

test('CI rejects drift between source builds and committed unpacked artifacts', () => {
  assert.match(ci, /git diff --exit-code -- load-unpacked/);
  assert.match(ci, /git status --porcelain --untracked-files=all -- load-unpacked/);
});

test('release manifest validation requires the exact permission and Schoology scope', () => {
  assert.doesNotThrow(() => validateReleaseManifest(valid));
  assert.throws(() => validateReleaseManifest({ ...valid, permissions: [] }), /permission/);
  assert.throws(() => validateReleaseManifest({ ...valid, permissions: ['storage', 'tabs'] }), /permission/);
  assert.throws(() => validateReleaseManifest({ ...valid, content_scripts: [{ matches: ['https://*.schoology.com/*'] }] }), /match/);
  assert.throws(() => validateReleaseManifest({ ...valid, host_permissions: ['https://example.com/*'] }), /scope/);
  assert.throws(() => validateReleaseManifest({ ...valid, optional_permissions: ['tabs'] }), /scope/);
  assert.throws(() => validateReleaseManifest({ ...valid, content_scripts: [...valid.content_scripts, { matches: ['https://fuhsd.schoology.com/*'] }] }), /scope/);
});

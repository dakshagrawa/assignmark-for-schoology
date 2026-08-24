import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const popupHtml = await readFile(new URL('../src/popup.html', import.meta.url), 'utf8');
const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');

test('popup loads only packaged styles and scripts', () => {
  assert.match(popupHtml, /href="\.\.\/dist\/popup\.css"/);
  assert.match(popupHtml, /src="\.\.\/dist\/popup\.js"/);
  assert.doesNotMatch(popupHtml, /https?:\/\//);
  assert.doesNotMatch(popupHtml, /<script[^>]*>[^<]+<\/script>/);
});

test('release build bundles and copies the settings popup', () => {
  assert.match(build, /popup:\s*resolve\(root, 'src\/popup\.js'\)/);
  assert.match(build, /path\.join\(root, 'src', 'popup\.html'\)/);
  assert.match(build, /path\.join\(root, 'THIRD_PARTY_NOTICES\.md'\)/);
  assert.match(build, /path\.join\(root, 'LICENSE'\)/);
});

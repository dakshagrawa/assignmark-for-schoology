import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/popup.css', import.meta.url), 'utf8');

test('settings popup uses one restrained Apple-style token system', () => {
  assert.match(css, /--popup-accent:#0071e3/);
  assert.match(css, /--popup-surface:#fff/);
  assert.match(css, /--popup-radius:12px/);
  assert.doesNotMatch(css, /backdrop-filter|linear-gradient|radial-gradient/);
  assert.equal((css.match(/@media\(prefers-color-scheme:dark\)/g) || []).length, 1);
});

test('settings popup keeps primary interaction targets at least 44px tall', () => {
  assert.match(css, /\.segmented-control button\{[^}]*min-height:44px/);
  assert.match(css, /\.switch-row\{[^}]*min-height:44px/);
  assert.match(css, /\.visibility-option\{[^}]*min-height:44px/);
  assert.match(css, /\.danger-button,\.secondary-button\{[^}]*min-height:44px/);
  assert.match(css, /\.swatches button\{[^}]*width:44px[^}]*height:44px/);
  assert.match(css, /\.dock-grid button\{[^}]*min-height:44px/);
});

test('accent presets and rail positions use calm two-column grids instead of crowded rows', () => {
  assert.match(css, /\.swatches\{[^}]*grid-template-columns:repeat\(3,44px\)/);
  assert.match(css, /\.dock-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('settings popup small light-theme status and footer text meet contrast tokens', () => {
  assert.match(css, /--popup-success:#1f7a34/);
  assert.match(css, /footer\{[^}]*color:var\(--popup-muted\)/);
});

test('settings popup focus uses the fixed interaction blue, not the customizable accent', () => {
  const focusRule = css.match(/button:focus-visible,input:focus-visible\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(focusRule, /box-shadow\s*:/);
  assert.match(focusRule, /var\(--popup-accent\)/);
  assert.doesNotMatch(focusRule, /var\(--accent/);
  assert.match(css, /\.switch-row\[aria-checked=true\] \.switch span\s*\{[^}]*background\s*:\s*var\(--accent-foreground/);
});

test('settings popup prevents horizontal overflow in a narrow toolbar viewport', () => {
  assert.match(css, /html,body\s*\{[^}]*overflow-x\s*:\s*hidden/);
  assert.match(css, /\.color-setting\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,1fr\)\s+102px/);
  assert.match(css, /\.color-field-wrap \.clr-field\s*\{[^}]*width\s*:\s*100%/);
});

test('settings popup exposes theme adaptation and customizable control settings', () => {
  assert.match(css, /prefers-color-scheme:dark/);
  assert.match(css, /control-preferences/);
  assert.match(css, /visibility-option/);
  assert.match(css, /\.size-setting output\{color:var\(--popup-text,#1d1d1f\)\}/);
});

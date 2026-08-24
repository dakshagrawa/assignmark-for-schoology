import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/popup.css', import.meta.url), 'utf8');

test('settings popup focus does not depend on the customizable accent', () => {
  const focusRule = css.match(/button:focus-visible,input:focus-visible\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(focusRule, /box-shadow\s*:/);
  assert.doesNotMatch(focusRule, /outline[^;]*var\(--accent/);
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

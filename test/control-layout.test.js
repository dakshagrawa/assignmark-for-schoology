import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/content.css', import.meta.url), 'utf8');

test('control center restores the compact v2.0 footprint without a calendar-blocking panel', () => {
  const controlRule = css.match(/\.sc-cc\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(controlRule, /width\s*:\s*calc\(60px \* var\(--sc-control-scale,1\)\)/);
  assert.match(controlRule, /display\s*:\s*flex/);
  assert.match(controlRule, /flex-direction\s*:\s*column/);
  assert.match(controlRule, /gap\s*:\s*8px/);
  assert.doesNotMatch(css, /width\s*:\s*min\(320px/);
  assert.doesNotMatch(css, /\.sc-cc-toggle/);
});

test('successful reset feedback is visible without covering the calendar', () => {
  const rule = css.match(/\.sc-cal-notice\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /position\s*:\s*fixed/);
  assert.match(rule, /max-width\s*:\s*min\(/);
  assert.match(rule, /pointer-events\s*:\s*none/);
});

test('toolbar focus and active foreground remain visible with extreme custom accents', () => {
  const activeRule = css.match(/\.sc-cc button\[aria-pressed=true\]\s*\{([^}]*)\}/)?.[1] || '';
  const focusRule = css.match(/\.sc-cal-left-checkbox:focus-visible, \.sc-cc button:focus-visible\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(activeRule, /color\s*:\s*var\(--sc-assignmark-accent-foreground/);
  assert.match(focusRule, /box-shadow\s*:[^;]*!important/);
  assert.doesNotMatch(focusRule, /outline[^;]*var\(--sc-assignmark-accent/);
  const noticeRule = css.match(/\.sc-cal-notice\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(noticeRule, /color\s*:\s*var\(--sc-assignmark-accent-foreground/);
});

test('primary controls use consistent touch targets and an adaptive glass surface', () => {
  const buttonRule = css.match(/\.sc-cc \.sc-icon-btn\s*\{([^}]*)\}/)?.[1] || '';
  const width = Number(buttonRule.match(/width\s*:\s*(\d+)px/)?.[1]);
  const height = Number(buttonRule.match(/height\s*:\s*(\d+)px/)?.[1]);

  assert.match(buttonRule, /width\s*:\s*calc\(60px \* var\(--sc-control-scale,1\)\)/);
  assert.match(buttonRule, /height\s*:\s*calc\(60px \* var\(--sc-control-scale,1\)\)/);
  assert.match(buttonRule, /backdrop-filter\s*:[^;]*blur\(/);
  assert.match(buttonRule, /border-radius\s*:\s*12px/);
});

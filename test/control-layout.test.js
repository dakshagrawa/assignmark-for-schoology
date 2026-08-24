import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/content.css', import.meta.url), 'utf8');

test('control center restores the compact v2.0 footprint without a calendar-blocking panel', () => {
  const controlRule = css.match(/\.sc-cc\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(controlRule, /width\s*:\s*calc\(52px \* var\(--sc-control-scale,1\)\)/);
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
  assert.match(focusRule, /outline\s*:\s*3px solid #ffbf47/);
  assert.doesNotMatch(focusRule, /var\(--sc-assignmark-accent/);
  const noticeRule = css.match(/\.sc-cal-notice\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(noticeRule, /color\s*:\s*var\(--sc-assignmark-accent-foreground/);
});

test('primary controls use the opaque compact v2.0 tile treatment', () => {
  const buttonRule = css.match(/\.sc-cc \.sc-icon-btn\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(buttonRule, /width\s*:\s*calc\(52px \* var\(--sc-control-scale,1\)\)/);
  assert.match(buttonRule, /height\s*:\s*calc\(52px \* var\(--sc-control-scale,1\)\)/);
  assert.match(buttonRule, /border-radius\s*:\s*10px/);
  assert.match(buttonRule, /background\s*:\s*var\(--sc-surface\)/);
  assert.doesNotMatch(buttonRule, /backdrop-filter|blur\(/);
  assert.doesNotMatch(css, /backdrop-filter|blur\(/);
});

test('move controls use a separate opaque palette instead of an overlay cover', () => {
  const overlayRule = css.match(/\.sc-cc-move-overlay\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(overlayRule, /left\s*:\s*calc\(100% \+ 8px\)/);
  assert.match(overlayRule, /background\s*:\s*var\(--sc-surface\)/);
  assert.match(overlayRule, /border-radius\s*:\s*10px/);
  assert.doesNotMatch(overlayRule, /dashed|blur\(/);
});

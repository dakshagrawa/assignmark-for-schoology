import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/content.css', import.meta.url), 'utf8');

test('control center uses a narrow previous-style vertical rail instead of a wide calendar-blocking panel', () => {
  const controlRule = css.match(/\.sc-cc\s*\{([^}]*)\}/)?.[1] || '';
  const width = Number(controlRule.match(/(?:^|;)\s*width\s*:\s*(\d+)px/)?.[1]);

  assert.ok(Number.isFinite(width), 'control rail must have an explicit pixel width');
  assert.ok(width <= 96, `control rail width ${width}px must not exceed 96px`);
  assert.match(controlRule, /display\s*:\s*flex/);
  assert.match(controlRule, /flex-direction\s*:\s*column/);
  assert.doesNotMatch(css, /width\s*:\s*min\(320px/);
});

test('control center keeps every compact rail control at least 44px tall', () => {
  const buttonRule = css.match(/\.sc-cc button\s*\{([^}]*)\}/)?.[1] || '';
  const toggleRule = css.match(/\.sc-cc-toggle\s*\{([^}]*)\}/)?.[1] || '';
  const buttonHeight = Number(buttonRule.match(/min-height\s*:\s*(\d+)px/)?.[1]);
  const toggleHeight = Number(toggleRule.match(/min-height\s*:\s*(\d+)px/)?.[1]);

  assert.ok(buttonHeight >= 44, `rail buttons are only ${buttonHeight}px tall`);
  assert.ok(toggleHeight >= 44, `collapse control is only ${toggleHeight}px tall`);
});

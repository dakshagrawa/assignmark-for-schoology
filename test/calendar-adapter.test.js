import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CalendarAdapter, RenderedItemRegistry } from '../src/calendar-adapter.js';

function documentFor(body) {
  return new JSDOM(`<!doctype html><body>${body}</body>`, {
    url: 'https://fuhsd.schoology.com/calendar'
  }).window.document;
}

test('calendar adapter discovers one logical root per event', () => {
  const document = documentFor(`
    <div class="fc fc-view">
      <div class="fc-event"><div class="fc-event-main-frame"><span class="fc-event-title">Essay</span></div></div>
      <div class="fc-list-item"><span class="fc-event-title">Lab</span></div>
    </div>`);

  const adapter = new CalendarAdapter(document);
  const roots = adapter.discover();

  assert.equal(roots.length, 2);
  assert.equal(roots[0].classList.contains('fc-event'), true);
  assert.equal(roots[1].classList.contains('fc-list-item'), true);
});

test('rendered item registry deduplicates IDs but preserves DOM occurrences', () => {
  const document = documentFor(`
    <div class="fc-event" id="one"></div>
    <div class="fc-event" id="two"></div>
    <div class="fc-event" id="three"></div>`);
  const [one, two, three] = document.querySelectorAll('.fc-event');
  const registry = new RenderedItemRegistry();

  registry.replace([
    { id: 'a', node: one, checked: true },
    { id: 'a', node: two, checked: true },
    { id: 'b', node: three, checked: false }
  ]);

  assert.deepEqual(registry.currentScopeIds(), ['a', 'b']);
  assert.deepEqual(registry.completedScopeIds(), ['a']);
  assert.equal(registry.occurrences('a').length, 2);
  assert.deepEqual(registry.items(), [
    { id: 'a', checked: true },
    { id: 'b', checked: false }
  ]);
});

test('rendered item registry drops disconnected nodes on refresh', () => {
  const document = documentFor('<div class="fc-event" id="one"></div>');
  const node = document.querySelector('.fc-event');
  const registry = new RenderedItemRegistry();
  registry.replace([{ id: 'a', node, checked: true }]);

  node.remove();
  registry.prune();

  assert.deepEqual(registry.currentScopeIds(), []);
});

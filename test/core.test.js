import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  DEFAULT_SETTINGS,
  ExtensionStore,
  buildIdCandidates,
  shortHash
} from '../src/core.js';

class MemoryStorageArea {
  constructor(initial = {}) { this.data = structuredClone(initial); }
  async get(keys) {
    if (keys == null) return structuredClone(this.data);
    const names = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(names.filter((key) => key in this.data).map((key) => [key, structuredClone(this.data[key])]));
  }
  async set(values) { Object.assign(this.data, structuredClone(values)); }
}

function eventNode(html, url = 'https://fuhsd.schoology.com/calendar') {
  const dom = new JSDOM(html, { url });
  return { dom, node: dom.window.document.querySelector('.fc-event') };
}

test('extracts an assignment canonical ID from href', () => {
  const { node } = eventNode('<div class="fc-event"><a href="/assignment/123456?utm_source=x#details"><span class="fc-event-title">Essay</span></a></div>');
  const result = buildIdCandidates(node, 'https://fuhsd.schoology.com');
  assert.equal(result.canonical, 'href::/assignment/123456');
});

test('extracts canonical event ID from data attributes', () => {
  const { node } = eventNode('<div class="fc-event" data-event-id="evt-42"><span class="fc-event-title">Meeting</span></div>');
  const result = buildIdCandidates(node, 'https://fuhsd.schoology.com');
  assert.equal(result.canonical, 'eid::data-event-id::evt-42');
});

test('does not borrow a canonical anchor from a sibling calendar event', () => {
  const { dom } = eventNode(`
    <div class="fc">
      <div class="fc-event"><a href="/assignment/123"><span class="fc-event-title">Essay</span></a></div>
      <div class="fc-event"><span class="fc-event-title">Unlinked lab</span></div>
    </div>`);
  const events = dom.window.document.querySelectorAll('.fc-event');
  assert.equal(buildIdCandidates(events[0], 'https://fuhsd.schoology.com').canonical, 'href::/assignment/123');
  assert.equal(buildIdCandidates(events[1], 'https://fuhsd.schoology.com').canonical, null);
});

test('builds a content-and-path fingerprint fallback', () => {
  const { node } = eventNode('<main><div><div class="fc-event"><span class="fc-event-time">9:00 AM</span><span class="fc-event-title">Quiz</span></div></div></main>');
  const result = buildIdCandidates(node, 'https://fuhsd.schoology.com');
  assert.equal(result.canonical, null);
  assert.match(result.fallbackId, /^cal::[a-z0-9]+$/);
  assert.equal(result.fallbackId, `cal::${shortHash(result.pathFingerprint)}`);
  assert.ok(result.semanticAliases.length >= 1);
});

test('distinguishes duplicate fallback events with identical content', () => {
  const { dom } = eventNode(`
    <div class="fc" data-date="2026-08-24">
      <div class="fc-event"><span class="fc-event-time">9 AM</span><span class="fc-event-title">Study</span></div>
      <div class="fc-event"><span class="fc-event-time">9 AM</span><span class="fc-event-title">Study</span></div>
    </div>`);
  const [first, second] = dom.window.document.querySelectorAll('.fc-event');
  assert.notDeepEqual(
    buildIdCandidates(first, 'https://fuhsd.schoology.com').semanticAliases,
    buildIdCandidates(second, 'https://fuhsd.schoology.com').semanticAliases
  );
});

test('persists checkbox states and settings in extension storage', async () => {
  const area = new MemoryStorageArea();
  const store = new ExtensionStore(area);
  await store.initialize();
  await store.setChecked('href::/assignment/7', true, 1234);
  await store.updateSettings({ hide: true });

  const reloaded = new ExtensionStore(area);
  await reloaded.initialize();
  assert.equal(reloaded.isChecked('href::/assignment/7'), true);
  assert.deepEqual(reloaded.getSettings(), { ...DEFAULT_SETTINGS, hide: true });
});

test('reconciles fallback state into a canonical ID without losing the checked value', async () => {
  const area = new MemoryStorageArea();
  const store = new ExtensionStore(area);
  await store.initialize();

  const first = eventNode('<div class="fc-event"><span class="fc-event-time">10 AM</span><span class="fc-event-title">Lab</span></div>').node;
  const firstResolution = await store.resolve(buildIdCandidates(first, 'https://fuhsd.schoology.com'));
  await store.setChecked(firstResolution.id, true, 111);

  const canonical = eventNode('<div class="fc-event"><a href="/assignment/99"><span class="fc-event-time">10 AM</span><span class="fc-event-title">Lab</span></a></div>').node;
  const canonicalResolution = await store.resolve(buildIdCandidates(canonical, 'https://fuhsd.schoology.com'));

  assert.equal(canonicalResolution.id, 'href::/assignment/99');
  assert.equal(store.isChecked('href::/assignment/99'), true);
  assert.equal(store.isChecked(firstResolution.id), false);
});

test('regression: checked fallback survives rerender when sibling path shifts', async () => {
  const area = new MemoryStorageArea();
  const store = new ExtensionStore(area);
  await store.initialize();

  const before = eventNode('<section><div class="fc-event"><span class="fc-event-time">8 AM</span><span class="fc-event-title">Homework</span></div></section>').node;
  const beforeCandidates = buildIdCandidates(before, 'https://fuhsd.schoology.com');
  const first = await store.resolve(beforeCandidates);
  await store.setChecked(first.id, true, 222);

  const after = eventNode('<section><aside>New Schoology sibling</aside><div class="fc-event"><span class="fc-event-time">8 AM</span><span class="fc-event-title">Homework</span></div></section>').node;
  const afterCandidates = buildIdCandidates(after, 'https://fuhsd.schoology.com');
  assert.notEqual(afterCandidates.pathFingerprint, beforeCandidates.pathFingerprint);

  const second = await store.resolve(afterCandidates);
  assert.equal(second.id, first.id);
  assert.equal(store.isChecked(second.id), true);

  const reloaded = new ExtensionStore(area);
  await reloaded.initialize();
  const third = await reloaded.resolve(afterCandidates);
  assert.equal(third.id, first.id);
  assert.equal(reloaded.isChecked(third.id), true);
});

test('serialized mutations do not overwrite a checked state during concurrent resolution', async () => {
  const area = new MemoryStorageArea();
  const store = new ExtensionStore(area);
  await store.initialize();
  const { node } = eventNode('<div class="fc-event"><span class="fc-event-title">Project</span></div>');
  const candidates = buildIdCandidates(node, 'https://fuhsd.schoology.com');

  const resolution = await store.resolve(candidates);
  await Promise.all([
    store.setChecked(resolution.id, true, 333),
    store.resolve(candidates),
    store.updateSettings({ dim: false })
  ]);

  assert.equal(store.isChecked(resolution.id), true);
  assert.equal(store.getSettings().dim, false);
  assert.equal(area.data.scCalendarData.states[resolution.id], 333);
});

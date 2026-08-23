import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  DEFAULT_SETTINGS,
  DataRepository,
  ExtensionStore,
  buildIdCandidates,
  shortHash,
  resolveCandidates
} from '../src/core.js';

class MemoryStorageArea {
  constructor(initial = {}) { this.data = structuredClone(initial); this.setCount = 0; }
  async get(keys) {
    if (keys == null) return structuredClone(this.data);
    const names = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(names.filter((key) => key in this.data).map((key) => [key, structuredClone(this.data[key])]));
  }
  async set(values) { this.setCount += 1; Object.assign(this.data, structuredClone(values)); }
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

test('filter setting defaults to all', async () => {
  const store = new ExtensionStore(new MemoryStorageArea());
  await store.initialize();
  assert.equal(store.getSettings().filter, 'all');
});

test('filter setting migrates legacy hide and rejects invalid values', async () => {
  const hiddenArea = new MemoryStorageArea({
    scCalendarData: { states: {}, settings: { hide: true, dim: true }, idMap: {} }
  });
  const hiddenStore = new ExtensionStore(hiddenArea);
  await hiddenStore.initialize();
  assert.equal(hiddenStore.getSettings().filter, 'pending');

  const invalidArea = new MemoryStorageArea({
    scCalendarData: { states: {}, settings: { hide: false, dim: true, filter: 'surprise' }, idMap: {} }
  });
  const invalidStore = new ExtensionStore(invalidArea);
  await invalidStore.initialize();
  assert.equal(invalidStore.getSettings().filter, 'all');
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

test('coordinator serializes independent tab mutations without losing state', async () => {
  const area = new MemoryStorageArea();
  const repository = new DataRepository(area);
  await repository.initialize();

  await Promise.all([
    repository.setChecked('id-a', true, 100),
    repository.setChecked('id-b', true, 200)
  ]);

  const persisted = (await area.get(['scCalendarData'])).scCalendarData;
  assert.deepEqual(persisted.states, { 'id-a': 100, 'id-b': 200 });
});

test('pure resolveCandidates does not mutate storage and returns changed flag', async () => {
  const area = new MemoryStorageArea();
  const repository = new DataRepository(area);
  await repository.initialize();

  const { node } = eventNode('<div class="fc-event"><span class="fc-event-time">9:00 AM</span><span class="fc-event-title">Quiz</span></div>');
  const candidates = buildIdCandidates(node, 'https://fuhsd.schoology.com');

  // First resolution with empty snapshot - adds aliases
  let snapshot = repository.snapshot();
  const first = resolveCandidates(snapshot, candidates);
  assert.equal(first.resolution.checked, false);
  assert.equal(first.changed, true);

  // Apply the first result and resolve again - no changes
  snapshot = first.next;
  const second = resolveCandidates(snapshot, candidates);
  assert.deepEqual(second.resolution, first.resolution);
  assert.equal(second.changed, false);
});

test('repository resolveMany commits at most once per scan', async () => {
  const area = new MemoryStorageArea();
  const repository = new DataRepository(area);
  await repository.initialize();

  const { node: nodeA } = eventNode('<div class="fc-event"><span class="fc-event-time">9 AM</span><span class="fc-event-title">Study</span></div>');
  const { node: nodeB } = eventNode('<div class="fc-event"><span class="fc-event-time">10 AM</span><span class="fc-event-title">Lab</span></div>');
  const candidatesA = buildIdCandidates(nodeA, 'https://fuhsd.schoology.com');
  const candidatesB = buildIdCandidates(nodeB, 'https://fuhsd.schoology.com');

  const writeCountBefore = area.setCount;

  // First scan: adds aliases for both items
  await repository.resolveMany([candidatesA, candidatesB]);
  const writeCountAfterFirst = area.setCount;

  // Second scan with same items: no writes needed
  await repository.resolveMany([candidatesA, candidatesB]);
  const writeCountAfterSecond = area.setCount;

  assert.ok(writeCountAfterFirst > writeCountBefore, 'first scan should write');
  assert.equal(writeCountAfterSecond, writeCountAfterFirst, 'second scan should not write');
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

test('scoped clear removes only requested checked states and returns an undo snapshot', async () => {
  const store = new ExtensionStore(new MemoryStorageArea());
  await store.initialize();
  await store.setChecked('a', true, 100);
  await store.setChecked('b', true, 200);
  await store.setChecked('c', true, 300);

  const removed = await store.clearStates(['a', 'b', 'a']);

  assert.deepEqual(removed, { a: 100, b: 200 });
  assert.equal(store.isChecked('a'), false);
  assert.equal(store.isChecked('b'), false);
  assert.equal(store.isChecked('c'), true);
});

test('restore cleared states preserves newer concurrent timestamps', async () => {
  const store = new ExtensionStore(new MemoryStorageArea());
  await store.initialize();
  await store.setChecked('a', true, 100);
  await store.setChecked('b', true, 200);
  const removed = await store.clearStates(['a', 'b']);
  await store.setChecked('a', true, 400);

  await store.restoreStates(removed);

  assert.deepEqual(store.snapshot().states, { a: 400, b: 200 });
});

test('scoped clear with an empty scope leaves states unchanged', async () => {
  const store = new ExtensionStore(new MemoryStorageArea());
  await store.initialize();
  await store.setChecked('a', true, 100);

  const removed = await store.clearStates([]);

  assert.deepEqual(removed, {});
  assert.deepEqual(store.snapshot().states, { a: 100 });
});

test('clearCompleted removes only explicitly scoped checked IDs', async () => {
  const store = new ExtensionStore(new MemoryStorageArea());
  await store.initialize();
  await store.setChecked('a', true, 100);
  await store.setChecked('b', true, 200);
  await store.setChecked('c', false, 0);

  const removed = await store.clearCompleted(['a', 'b', 'a']);

  assert.deepEqual(removed, { a: 100, b: 200 });
  assert.equal(store.isChecked('a'), false);
  assert.equal(store.isChecked('b'), false);
  assert.equal(store.isChecked('c'), false);
});

test('clearAllStates is separately named and removes all checked IDs', async () => {
  const store = new ExtensionStore(new MemoryStorageArea());
  await store.initialize();
  await store.setChecked('a', true, 100);
  await store.setChecked('b', true, 200);

  const removed = await store.clearAllStates();

  assert.deepEqual(removed, { a: 100, b: 200 });
  assert.deepEqual(store.snapshot().states, {});
});

test('clearCompleted with empty scope performs zero writes', async () => {
  const area = new MemoryStorageArea();
  const repository = new DataRepository(area);
  await repository.initialize();
  await repository.setChecked('a', true, 100);

  const writeCountBefore = area.setCount;
  await repository.clearCompleted([]);
  const writeCountAfter = area.setCount;

  assert.equal(writeCountAfter, writeCountBefore);
});

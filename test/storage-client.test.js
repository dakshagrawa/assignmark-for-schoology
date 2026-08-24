import test from 'node:test';
import assert from 'node:assert/strict';
import { DataRepository } from '../src/core.js';
import { createStorageMessageHandler } from '../src/background.js';
import { StorageClient } from '../src/storage-client.js';

class MemoryStorageArea {
  constructor(initial = {}) {
    this.data = structuredClone(initial);
    this.setCount = 0;
  }

  async get(keys) {
    const names = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(names.filter((key) => key in this.data).map((key) => [key, structuredClone(this.data[key])]));
  }

  async set(values) {
    this.setCount += 1;
    Object.assign(this.data, structuredClone(values));
  }
}

function clientPair(area = new MemoryStorageArea()) {
  const repository = new DataRepository(area);
  const handle = createStorageMessageHandler(repository);
  const sendMessage = (message) => handle(message);
  return {
    area,
    repository,
    first: new StorageClient(sendMessage),
    second: new StorageClient(sendMessage)
  };
}

test('independent clients share one coordinator without losing checkoffs', async () => {
  const { area, first, second } = clientPair();
  await Promise.all([first.initialize(), second.initialize()]);

  await Promise.all([
    first.setChecked('id-a', true, 100),
    second.setChecked('id-b', true, 200)
  ]);

  assert.deepEqual(area.data.scCalendarData.states, { 'id-a': 100, 'id-b': 200 });
});

test('storage client receives a validated snapshot after each mutation', async () => {
  const { first } = clientPair();
  await first.initialize();
  await first.setChecked('id-a', true, 100);

  assert.equal(first.isChecked('id-a'), true);
  assert.equal(first.snapshot().states['id-a'], 100);
});

test('storage client batches candidate resolution through the coordinator', async () => {
  const { first } = clientPair();
  await first.initialize();
  const candidates = [{
    canonical: 'href::/assignment/1',
    fallbackId: 'cal::fallback',
    legacyIds: [],
    aliases: ['semantic::one']
  }];

  const resolutions = await first.resolveMany(candidates);

  assert.equal(resolutions.length, 1);
  assert.equal(resolutions[0].id, 'href::/assignment/1');
  assert.equal(first.snapshot().idMap['semantic::one'], 'href::/assignment/1');
});

test('coordinator imports page legacy data only when extension storage is empty', async () => {
  const { first } = clientPair();

  await first.initialize({
    states: { 'legacy-id': 123 },
    settings: { hide: true, dim: false },
    idMap: { 'legacy-alias': 'legacy-id' }
  });

  assert.equal(first.isChecked('legacy-id'), true);
  assert.equal(first.getSettings().filter, 'pending');
  assert.equal(first.snapshot().idMap['legacy-alias'], 'legacy-id');
});

test('coordinator rejects unknown message operations', async () => {
  const { repository } = clientPair();
  const handle = createStorageMessageHandler(repository);

  await assert.rejects(() => handle({ type: 'assignmark:storage', operation: 'erase-everything' }), /Unknown storage operation/);
});

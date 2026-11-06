// Verifies the entry-point lifecycle wiring and the manifest contract.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { activate, prepare } from '../index.js';
import { STORAGE_SERVICE_NAME } from '../lib/prefs-service.js';

const MANIFEST_PATH = new URL('../manifest.json', import.meta.url);
const PACKAGE_PATH = new URL('../package.json', import.meta.url);

function createPrepareContext(configOverrides = {}) {
  const published = [];
  const listeners = {};
  return {
    config: { ...configOverrides },
    events: {
      publish: (type, data) => published.push({ type, data }),
      subscribe: (type, listener) => {
        listeners[type] = listeners[type] ?? [];
        listeners[type].push(listener);
        return () => {
          const index = listeners[type].indexOf(listener);
          if (index !== -1) listeners[type].splice(index, 1);
        };
      },
    },
    onShutdown: null,
    onDeactivated: null,
    reportCriticalError: (error) => published.push({ type: 'critical', data: error }),
    published,
    listeners,
  };
}

test('should_register_service_when_prepare_is_called', async () => {
  const context = createPrepareContext();

  const registrations = await prepare(context);

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].name, 'pey.prefs.service');
  assert.equal(typeof registrations[0].object.get, 'function');
  assert.equal(typeof registrations[0].object.set, 'function');
});

test('should_assign_lifecycle_hooks_when_prepare_is_called', async () => {
  const context = createPrepareContext();

  await prepare(context);

  assert.equal(typeof context.onShutdown, 'function');
  assert.equal(typeof context.onDeactivated, 'function');
});

test('should_bind_storage_when_activate_is_called', async () => {
  const context = createPrepareContext();
  const registrations = await prepare(context);

  const storage = {
    read: async () => ({ key: 'theme', value: 'dark' }),
    write: async () => {},
  };
  await activate({ 'pey.storage.service': storage });

  const prefsService = registrations[0].object;
  assert.equal(await prefsService.get('theme'), 'dark');
  assert.equal(await prefsService.set('theme', 'light'), true);
});

test('should_report_critical_error_when_storage_dependency_is_lost', async () => {
  const context = createPrepareContext();
  await prepare(context);

  context.listeners['core:service-unavailable'][0]({
    type: 'core:service-unavailable',
    data: { serviceName: 'pey.storage.service' },
  });

  const criticalReport = context.published.find((entry) => entry.type === 'critical');
  assert.equal(criticalReport.data.code, 'REQUIRED_DEPENDENCY_LOST');
  assert.equal(criticalReport.data.source, 'pey.prefs');
});

test('should_not_report_critical_error_when_unrelated_service_is_lost', async () => {
  const context = createPrepareContext();
  await prepare(context);

  context.listeners['core:service-unavailable'][0]({
    type: 'core:service-unavailable',
    data: { serviceName: 'some.other.service' },
  });

  assert.equal(context.published.find((entry) => entry.type === 'critical'), undefined);
});

test('should_not_report_critical_error_when_dependency_is_lost_after_shutdown', async () => {
  const context = createPrepareContext();
  await prepare(context);

  await context.onShutdown();
  context.listeners['core:service-unavailable'][0]?.({
    type: 'core:service-unavailable',
    data: { serviceName: 'pey.storage.service' },
  });

  assert.equal(context.published.find((entry) => entry.type === 'critical'), undefined);
  assert.equal(context.listeners['core:service-unavailable'].length, 0, 'listener must leave the bus after shutdown');
});

test('should_deactivate_service_when_shutdown_hook_is_invoked', async () => {
  const context = createPrepareContext();
  const registrations = await prepare(context);
  await activate({ 'pey.storage.service': { read: async () => ({ key: 'theme', value: 'dark' }), write: async () => {} } });

  await context.onShutdown();

  assert.equal(await registrations[0].object.get('theme'), null);
  assert.equal(await registrations[0].object.set('theme', 'dark'), false);
});

test('should_use_configured_collection_when_prepare_receives_one', async () => {
  const context = createPrepareContext({ collection: 'ui-prefs' });
  const registrations = await prepare(context);
  const calls = [];
  const storage = {
    read: async (collection, key) => {
      calls.push(['read', collection, key]);
      return null;
    },
    write: async (collection, record) => {
      calls.push(['write', collection, record]);
    },
  };
  await activate({ 'pey.storage.service': storage });

  await registrations[0].object.set('theme', 'dark');

  assert.deepEqual(calls[0], ['write', 'ui-prefs', { key: 'theme', value: 'dark' }]);
});

test('should_use_default_collection_when_config_collection_is_not_a_string', async () => {
  const context = createPrepareContext({ collection: 42 });
  const registrations = await prepare(context);
  const calls = [];
  const storage = {
    read: async (collection, key) => {
      calls.push(['read', collection, key]);
      return null;
    },
    write: async (collection, record) => {
      calls.push(['write', collection, record]);
    },
  };
  await activate({ 'pey.storage.service': storage });

  await registrations[0].object.set('theme', 'dark');

  assert.deepEqual(calls[0], ['write', 'prefs', { key: 'theme', value: 'dark' }]);
});

test('should_not_report_critical_error_twice_when_prepare_is_called_again', async () => {
  const first = createPrepareContext();
  await prepare(first);

  const second = createPrepareContext();
  await prepare(second);

  first.listeners['core:service-unavailable'][0]?.({
    type: 'core:service-unavailable',
    data: { serviceName: 'pey.storage.service' },
  });
  assert.equal(first.published.find((entry) => entry.type === 'critical'), undefined, 'old listener must be gone');

  second.listeners['core:service-unavailable'][0]({
    type: 'core:service-unavailable',
    data: { serviceName: 'pey.storage.service' },
  });
  assert.notEqual(second.published.find((entry) => entry.type === 'critical'), undefined, 'new listener must work');
});

test('should_match_manifest_contract_when_loaded', async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const pkg = JSON.parse(await readFile(PACKAGE_PATH, 'utf8'));

  assert.equal(manifest.name, 'pey.prefs');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.type, 'feature');
  assert.equal(manifest.adapterType, undefined);
  assert.deepEqual(manifest.dependencies.required, [STORAGE_SERVICE_NAME]);
  assert.deepEqual(manifest.dependencies.optional, []);
  assert.equal(manifest.provides.length, 1);
  assert.equal(manifest.provides[0].name, 'pey.prefs.service');
  const methodNames = manifest.provides[0].methods.map((method) => method.name);
  assert.deepEqual(methodNames, ['get', 'set']);
  assert.deepEqual(manifest.events, []);
});

test('should_keep_the_new_service_healthy_when_a_stale_hook_from_a_previous_prepare_fires', async () => {
  const first = createPrepareContext();
  await prepare(first);

  const second = createPrepareContext();
  const secondRegistrations = await prepare(second);
  await activate({ 'pey.storage.service': { read: async () => ({ key: 'theme', value: 'dark' }), write: async () => {} } });

  // The host (or a test) invokes the OLD context's hook: it must be
  // harmless to the NEW prepare()'s service and listener.
  await first.onShutdown();

  assert.equal(await secondRegistrations[0].object.get('theme'), 'dark', 'the new service must stay usable');
  assert.equal(await secondRegistrations[0].object.set('theme', 'light'), true);
  second.listeners['core:service-unavailable'][0]?.({
    type: 'core:service-unavailable',
    data: { serviceName: 'pey.storage.service' },
  });
  assert.notEqual(
    second.published.find((entry) => entry.type === 'critical'),
    undefined,
    'the new listener must still be armed',
  );
});

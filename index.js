// Wires the preference service into Bonyan's two-phase plugin lifecycle.

import { PREFS_SERVICE_NAME, STORAGE_SERVICE_NAME, createPrefsService } from './lib/prefs-service.js';

const CORE_SERVICE_UNAVAILABLE_EVENT = 'core:service-unavailable';
const REQUIRED_SERVICE_NAMES = [STORAGE_SERVICE_NAME];
const PLUGIN_NAME = 'pey.prefs';
const DEFAULT_COLLECTION = 'prefs';

let lifecycleControls = null;
let unsubscribeUnavailable = null;

/**
 * Releases this prepare() call's resources: the service goes unavailable and
 * the core:service-unavailable listener leaves the Event Bus, so a lost-
 * dependency event after shutdown can never report a critical error for a
 * dead plugin.
 */
function teardown() {
  lifecycleControls?.deactivate();
  lifecycleControls = null;
  if (unsubscribeUnavailable !== null) {
    unsubscribeUnavailable();
    unsubscribeUnavailable = null;
  }
}

/**
 * Prepares the declared preference service.
 *
 * @param {object} prepareContext Bonyan preparation context.
 * @returns {Promise<Array<{name: string, object: object}>>} Declared service registrations.
 */
export async function prepare(prepareContext) {
  // A repeated prepare() call must not leave the previous call's listener
  // (and service) behind on the Event Bus.
  teardown();

  const collection = prepareContext.config.collection;
  const prefs = createPrefsService({
    collection: typeof collection === 'string' && collection.length > 0 ? collection : DEFAULT_COLLECTION,
  });
  lifecycleControls = prefs;

  // Losing the required storage dependency after activation is a critical
  // error this plugin must report itself. The unsubscribe handle is kept so
  // the listener is removed again on shutdown/deactivation.
  const unsubscribe = prepareContext.events.subscribe(CORE_SERVICE_UNAVAILABLE_EVENT, (event) => {
    const serviceName = event?.data?.serviceName;
    if (REQUIRED_SERVICE_NAMES.includes(serviceName)) {
      prepareContext.reportCriticalError({
        code: 'REQUIRED_DEPENDENCY_LOST',
        message: `Required service ${serviceName} is no longer available`,
        source: PLUGIN_NAME,
        type: 'critical',
        timestamp: new Date().toISOString(),
      });
    }
  });
  unsubscribeUnavailable = unsubscribe;

  // The hooks tear down THIS call's resources only: a stale hook left on an
  // earlier context can never destroy a newer prepare()'s service and
  // listener (it re-runs harmlessly on already-released resources).
  let torn = false;
  const teardownThisCall = () => {
    prefs.deactivate();
    if (!torn) {
      torn = true;
      unsubscribe();
    }
    if (lifecycleControls === prefs) {
      lifecycleControls = null;
    }
    if (unsubscribeUnavailable === unsubscribe) {
      unsubscribeUnavailable = null;
    }
  };
  prepareContext.onDeactivated = () => teardownThisCall();
  prepareContext.onShutdown = async () => teardownThisCall();

  return [{ name: PREFS_SERVICE_NAME, object: prefs.service }];
}

/**
 * Binds the storage dependency after settlement.
 *
 * @param {Record<string, object>} services Bound declared dependencies.
 * @returns {Promise<void>}
 */
export async function activate(services) {
  lifecycleControls?.bindDependencies(services);
}

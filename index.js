// Wires the preference service into Bonyan's two-phase plugin lifecycle.

import { PLUGIN_NAME, PREFS_SERVICE_NAME, STORAGE_SERVICE_NAME, createPrefsService } from './lib/prefs-service.js';

const CORE_SERVICE_UNAVAILABLE_EVENT = 'core:service-unavailable';
const REQUIRED_SERVICE_NAMES = [STORAGE_SERVICE_NAME];
const DEFAULT_COLLECTION = 'prefs';

let lifecycleControls = null;
// The current call's subscription record: `{ unsubscribe, torn }` — the torn
// flag lives on the record so EVERY release path marks it, and a stale hook
// from an earlier context can never invoke the same unsubscribe handle
// twice (the Event Bus contract does not promise idempotent unsubscribe).
let subscription = null;

/**
 * Releases the current prepare() call's resources: the service goes
 * unavailable and the core:service-unavailable listener leaves the Event
 * Bus, so a lost-dependency event after shutdown can never report a
 * critical error for a dead plugin.
 */
function teardown() {
  lifecycleControls?.deactivate();
  lifecycleControls = null;
  releaseSubscription();
}

/**
 * Unsubscribes exactly once per record, whoever releases it first.
 * @returns {void}
 */
function releaseSubscription() {
  if (subscription !== null && !subscription.torn) {
    subscription.torn = true;
    subscription.unsubscribe();
  }
  subscription = null;
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
  subscription = { unsubscribe, torn: false };

  // The hooks tear down THIS call's resources only: a stale hook left on an
  // earlier context can never destroy a newer prepare()'s service and
  // listener — and the shared torn flag guarantees the same unsubscribe
  // handle is invoked at most once, whichever path releases first.
  // INVARIANT this relies on: a non-current record is ALWAYS already torn
  // — the record is replaced only through releaseSubscription(), which
  // marks torn and unsubscribes before nulling, and prepare() has no await
  // between subscription and hook assignment. A stale hook therefore never
  // re-invokes a released handle, and there is no "mark torn without
  // unsubscribing" branch that could permanently orphan a listener if the
  // invariant were ever broken.
  const thisSubscription = subscription;
  const teardownThisCall = () => {
    prefs.deactivate();
    if (subscription === thisSubscription) {
      releaseSubscription();
    }
    if (lifecycleControls === prefs) {
      lifecycleControls = null;
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

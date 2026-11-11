# Changelog

## [1.0.2] - 1405-08-19

Review-fix releases (second through seventh pass, all unpublished) on top of the tagged 1.0.1; no service-contract change.

- The `core:service-unavailable` subscription is released on shutdown/deactivation (and on a repeated `prepare()`), so a dependency-loss event after shutdown can no longer report a critical error for a dead plugin; the lifecycle hooks tear down their own prepare call's resources, so a stale hook from an earlier context can never destroy a newer instance.
- `config.collection` is type-checked: a non-string **or empty-string** value falls back to the `prefs` default (the empty case now has its own test).
- The unreachable defensive branch in `teardownThisCall` (marking a stale record torn without unsubscribing — a permanent listener leak if the invariant ever broke) is removed, and the invariant it relied on is documented in place.
- The stale-hook teardown shares one `torn` flag through a subscription record: the prepare-start release marks it, so a stale hook from an earlier context can never invoke the same unsubscribe handle twice (regression test added).
- Release note: 1.0.2 was never published — all review-fix rounds fold into this one entry, and the local `v1.0.2` tag tracks the fixed tree until the tag chain is pushed to origin (`v1.0.1`/`v1.0.2` are still local-only).
- The provided service name is a shared constant too (`PREFS_SERVICE_NAME`), locking manifest ↔ entry point ↔ tests to one source, like the dependency name — and the plugin name joined them (`PLUGIN_NAME`), so the critical report's `source`, the manifest and the tests read one constant.
- The tagged `[1.0.1]` entry is back in this file (it had been dropped in the restructure), so the changelog history matches the `v1.0.0 → v1.0.1 → v1.0.2` tag chain.
- Test coverage gained: non-string keys, a real shutdown-hook invocation, the configured collection end-to-end through `prepare()`, a single set→get round trip, an empty `bindDependencies` object, manifest↔lib locks on both service names, and the stale-hook scenario (27 tests). (Silent storage-failure logging stays out by design — graceful degradation is the contract; an optional logger dependency is a future MINOR.)

## [1.0.1] - 1405-08-15

- Fixed a subscription leak: the `core:service-unavailable` unsubscribe handle is now kept and invoked on shutdown/deactivation (and on a repeated `prepare()`), so a dependency-loss event after shutdown can no longer report a critical error for a dead plugin.
- `config.collection` is now type-checked: a non-string or empty value falls back to the `prefs` default instead of passing through unchecked.
- Test coverage: non-string keys, a real shutdown-hook invocation, the configured collection end-to-end through `prepare()`, a single set→get round trip, an empty `bindDependencies` object, and a manifest↔lib lock on the storage service name; one test renamed to the standard `should_…_when_…` pattern.

## [1.0.0] - 1405-08-08

Initial pey release: graceful user-preference persistence — `get(key)` / `set(key, value)` over `pey.storage.service` (configurable `collection`, default `prefs`); missing preferences read as null, failed writes report false, storage loss at runtime is reported as a critical error, and `docs/requirements.md` is the construction source of truth.

> Derived from the `shirazeh.prefs` plugin (Shirazeh, incubated as 0.1.0): renamed to `pey.prefs` / `pey.prefs.service` and generalized to the host application. That history stays with the source project — the pey release lineage starts here.

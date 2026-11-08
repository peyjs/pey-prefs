# Changelog

## [1.0.2] - 1405-08-17

Review-fix releases (second and third pass) on top of the tagged 1.0.1; no service-contract change.

- The `core:service-unavailable` subscription is released on shutdown/deactivation (and on a repeated `prepare()`), so a dependency-loss event after shutdown can no longer report a critical error for a dead plugin; the lifecycle hooks tear down their own prepare call's resources, so a stale hook from an earlier context can never destroy a newer instance.
- `config.collection` is type-checked: a non-string **or empty-string** value falls back to the `prefs` default (the empty case now has its own test).
- The provided service name is a shared constant too (`PREFS_SERVICE_NAME`), locking manifest ↔ entry point ↔ tests to one source, like the dependency name.
- Test coverage gained: non-string keys, a real shutdown-hook invocation, the configured collection end-to-end through `prepare()`, a single set→get round trip, an empty `bindDependencies` object, manifest↔lib locks on both service names, and the stale-hook scenario (26 tests). (Silent storage-failure logging stays out by design — graceful degradation is the contract; an optional logger dependency is a future MINOR.)

## [1.0.0] - 1405-08-08

Initial pey release: graceful user-preference persistence — `get(key)` / `set(key, value)` over `pey.storage.service` (configurable `collection`, default `prefs`); missing preferences read as null, failed writes report false, storage loss at runtime is reported as a critical error, and `docs/requirements.md` is the construction source of truth.

> Derived from the `shirazeh.prefs` plugin (Shirazeh, incubated as 0.1.0): renamed to `pey.prefs` / `pey.prefs.service` and generalized to the host application. That history stays with the source project — the pey release lineage starts here.

# Changelog

## [1.0.1] - 1405-08-15

- Fixed a subscription leak: the `core:service-unavailable` unsubscribe handle is now kept and invoked on shutdown/deactivation (and on a repeated `prepare()`), so a dependency-loss event after shutdown can no longer report a critical error for a dead plugin.
- `config.collection` is now type-checked: a non-string or empty value falls back to the `prefs` default instead of passing through unchecked.
- Test coverage: non-string keys, a real shutdown-hook invocation, the configured collection end-to-end through `prepare()`, a single set→get round trip, an empty `bindDependencies` object, and a manifest↔lib lock on the storage service name; one test renamed to the standard `should_…_when_…` pattern.

## [1.0.0] - 1405-08-08

Initial pey release: graceful user-preference persistence — `get(key)` / `set(key, value)` over `pey.storage.service` (configurable `collection`, default `prefs`); missing preferences read as null, failed writes report false, storage loss at runtime is reported as a critical error, and `docs/requirements.md` is the construction source of truth.

> Derived from the `shirazeh.prefs` plugin (Shirazeh, incubated as 0.1.0): renamed to `pey.prefs` / `pey.prefs.service` and generalized to the host application. That history stays with the source project — the pey release lineage starts here.

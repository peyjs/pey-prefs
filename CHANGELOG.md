# Changelog

## [1.0.0] - 2026-10-30

Initial pey release: graceful user-preference persistence — `get(key)` / `set(key, value)` over `pey.storage.service` (configurable `collection`, default `prefs`); missing preferences read as null, failed writes report false, storage loss at runtime is reported as a critical error, and `docs/requirements.md` is the construction source of truth.

> Derived from the `shirazeh.prefs` plugin (Shirazeh, incubated as 0.1.0): renamed to `pey.prefs` / `pey.prefs.service` and generalized to the host application. That history stays with the source project — the pey release lineage starts here.

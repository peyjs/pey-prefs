# pey.prefs

## Purpose

Feature plugin persisting the host application's user UI preferences (theme, language) on top of the storage infrastructure service.

## Structure

- `docs/requirements.md` — requirements; the construction source of truth.
- `manifest.json` — plugin contract.
- `index.js` — Bonyan two-phase entry point, including the `core:service-unavailable` subscription.
- `lib/prefs-service.js` — the preference service.
- `tests/` — unit tests (`node:test`).

## Dependencies

- **Required:** `pey.storage.service` — all persistence goes through the storage infrastructure service.
- **Optional:** none.

## See Also

- [docs/requirements.md](docs/requirements.md) for the "what and why", written before the implementation.
- [docs/reference.md](docs/reference.md) for the full API, errors, config, business rules, and constraints.

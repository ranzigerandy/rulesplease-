# Rules Please!

Board-game rulebook assistant with web and native Android clients. Convex is the central backend, Next.js serves the web frontend and catalog API, Expo/React Native powers Android, and the Python worker handles discovery, PDF extraction and OCR. During the current test phase that worker runs on the development PC; Railway is prepared for a later 24/7 migration.

## Run the local rollback application

```powershell
./start-local.ps1
```

Then open the URL printed by the script (normally `http://localhost:4173`).

## Run the Convex application

See [`web/README.md`](web/README.md) for the one-time Convex login, Auth setup, development commands, migration import, worker configuration, and rollback switch.

The live web app and the Android test configuration currently share the
`tidy-heron-277` Convex deployment. Start their local rulebook worker with:

```powershell
./scripts/start-convex-worker.ps1
```

Use `-Environment production` only after both clients have intentionally moved
to the production Convex deployment.

## Project structure

- `app_server.py` — local Python server and API
- `index.html` — original rollback interface
- `design-system.css` — shared visual system
- `assets/` — Rules Please! mascot assets
- `boardgames_ranks.csv` — local board-game catalogue
- `convex_worker.py` — lease-based Python ingestion worker for Convex
- `web/` — Next.js frontend, Convex functions, schema, tests, and migration scripts
- `mobile/` — Expo/React Native Android app, EAS profiles, native tests, and Maestro flows
- `packages/shared/` — shared Convex bindings, API contracts, PDF validation, and citation helpers
- `Dockerfile` and `railway.toml` — 24/7 worker deployment with healthcheck and restart policy
- `convex-migration-plan.md` — migration architecture and delivery phases

Downloaded rulebooks, generated indexes, local application state, and test output are intentionally excluded from version control.

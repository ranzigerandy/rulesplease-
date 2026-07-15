# Rules Please!

Board-game rulebook assistant with a staged Convex backend migration. Convex is the central application backend, Next.js is the new frontend, and Python remains responsible for catalogue search, PDF extraction, OCR, and ingestion. The original local application stays available as a rollback path.

## Run the local rollback application

```powershell
./start-local.ps1
```

Then open the URL printed by the script (normally `http://localhost:4173`).

## Run the Convex application

See [`web/README.md`](web/README.md) for the one-time Convex login, Auth setup, development commands, migration import, worker configuration, and rollback switch.

## Project structure

- `app_server.py` — local Python server and API
- `index.html` — original rollback interface
- `design-system.css` — shared visual system
- `assets/` — Rules Please! mascot assets
- `boardgames_ranks.csv` — local board-game catalogue
- `convex_worker.py` — lease-based Python ingestion worker for Convex
- `web/` — Next.js frontend, Convex functions, schema, tests, and migration scripts
- `convex-migration-plan.md` — migration architecture and delivery phases

Downloaded rulebooks, generated indexes, local application state, and test output are intentionally excluded from version control.

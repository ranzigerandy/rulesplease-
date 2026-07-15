# Rules Please!

Local board-game rulebook assistant. Add a board game, save its rulebook, and ask questions with cited rulebook passages.

## Run locally

```powershell
./start-local.ps1
```

Then open `http://localhost:4175`.

## Project structure

- `app_server.py` — local Python server and API
- `index.html` — application interface
- `design-system.css` — shared visual system
- `assets/` — Rules Please! mascot assets
- `boardgames_ranks.csv` — local board-game catalogue

Downloaded rulebooks, generated indexes, local application state, and test output are intentionally excluded from version control.

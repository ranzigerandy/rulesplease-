# Board Game Rules Wizard - Document Index

Datum: 2026-07-02

Deze map bevat de huidige projectdocumenten voor de Board Game Rules Wizard.

## Huidige lokale MVP-beslissing

- Game search gebruikt tijdelijk de lokale BGG CSV dump: `boardgames_ranks.csv`.
- Live BGG API is uitgesteld tot later; een username zoals `Vortlas` is geen vervanging voor API authorization.
- UI-taal: Engels.
- MVP draait lokaal.
- OpenAI wordt gebruikt via `OPENAI_API_KEY` als environment variable; keys worden niet in documenten opgeslagen.
- Database/storage eerst lokaal, met migratiepad naar Convex.

## Documenten

- `board-game-rules-wizard-prd.md` - Product Requirements Document.
- `board-game-rules-wizard-mvp-plan.md` - Concrete MVP scope, stack, milestones en benodigdheden.
- `board-game-rules-wizard-project-state.md` - Project state/TODO met checkbox-taken.
- `board-game-rules-wizard-research.md` - Uitgebreid researchrapport.
- `board-game-rules-wizard-research.html` - Browserleesbare researchversie.
- `rulebook-test-matrix.md` - Testmatrix voor Wingspan, Viticulture, Frutticola en SUMO.

## CSV dump

De huidige CSV bevat minimaal:

- `id`
- `name`
- `yearpublished`
- `rank`
- `bayesaverage`
- `average`
- `usersrated`
- `is_expansion`
- category rank velden

Voor MVP-search is dit genoeg. Publisher, image, description en uitgebreidere metadata komen later via live BGG API of extra metadata sources.

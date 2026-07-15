# Rulebook Test Matrix

Datum: 2026-07-02

| Game | BGG id / target | Source tested | Source type | Fetch result | PDF size | Pages | Text extraction | Keyword hits | Source/legal confidence | Automation risk | Feasibility |
|---|---:|---|---|---|---:|---:|---|---|---|---|---|
| Wingspan | 266192 | Stonemaier rules page -> Dropbox folder -> `WS_Rulebook_r24.pdf` | Official publisher, folder-based | Direct PDF mirror gave 403; official Dropbox `dl=1` downloaded 783 MB folder zip; extracted only rulebook | 75.9 MB | 12 | Good: 32,998 chars, no empty pages | `food` 67, `eggs` 23, `round` 35, `birdfeeder` 19, `end-of-round` 10 | High if sourced from Stonemaier Dropbox; lower for mirrors | High: Dropbox folder/huge zip, expansion files mixed in | High with custom downloader |
| Viticulture | 128621 base / 183394 Essential Edition | Stonemaier rules page; direct Steam manual candidate tested | Publisher page plus third-party/direct candidate | Steam PDF downloaded OK | 23.4 MB | 20 | Poor: 0 chars, 20 empty pages via pdfplumber | all tested terms 0 because image-only | Medium: publisher page exists, tested file not ideal primary source | High: edition ambiguity and OCR requirement | Medium with OCR and review |
| Frutticola | 234900 | Giochix direct PDF | Likely publisher-hosted PDF | Download OK | 5.1 MB | 12 | Good: 27,695 chars, 1 near-empty page | `jam` 47, `workers` 15, `fruit` 59, `market` 6, `warehouse` 35 | Medium-high if Giochix source accepted | Medium: obscure title, hard to discover automatically | Medium-high |
| SUMO | 406257 | Golden Meeple PDF; Bright Eye Games page confirms game | Retail/mirror PDF plus publisher confirmation | Download OK | 6.5 MB | 2 | Good: 5,480 chars, no empty pages | `trick` 12, `Lead player` 9, `YORIKIRI` 1, `WUCCHARI` 4 | Medium-low: PDF is not on publisher domain | High: title ambiguity, mirror source | Medium |

## Notes

- BGG XML API was tested without token and returned `401 Unauthorized` for both search and thing endpoints.
- Viticulture demonstrates why OCR must be part of the MVP pipeline.
- Wingspan demonstrates why official source discovery needs folder handling and max-size safeguards.
- SUMO demonstrates why title matching must use BGG identity plus publisher/year, not only game title.
- Frutticola demonstrates that obscure games can still work well if the publisher PDF is directly reachable.

## Recommended acceptance criteria for MVP ingestion

| Check | Pass threshold |
|---|---|
| Game identity | User selected BGG `boardgame` id, not just free text |
| Source confidence | Publisher domain or manually approved fallback |
| Language | English detected unless user chooses another language |
| Edition | Base game unless user explicitly chose expansion/edition |
| PDF size | Reject or manual review above configurable max size |
| Text extraction | At least 500 chars/page average or OCR fallback completed |
| Citation readiness | Every chunk has page number and source URL |
| Retrieval QA | At least 90% correct citations on curated eval set before launch |

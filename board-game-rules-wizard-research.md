# Board Game Rules Wizard - Research Report

Datum: 2026-07-02

## Executive summary

Het project is realistisch als MVP, maar niet als volledig automatische "elk spel werkt meteen" oplossing. De sterke MVP-route is:

- BGG gebruiken voor spelidentificatie via server-side API calls met eigen application token.
- Rulebooks vinden via een candidate pipeline met publisher-first ranking en menselijke bevestiging bij twijfel.
- PDF's zelf verwerken naar pagina's, tekst en chunks, niet alleen blind uploaden naar een hosted file-search tool.
- Hybrid retrieval gebruiken: exact/full-text search plus vector search plus reranking.
- Antwoorden genereren uit korte geciteerde passages, met verplicht "niet gevonden in de regels" wanneer de passages onvoldoende bewijs geven.

Belangrijkste risico's:

- BGG XML API vereist sinds de huidige documentatie registratie, approval en Authorization bearer tokens. Een test zonder token gaf `401 Unauthorized`.
- BGG kan commerciele toepassingen weigeren of voorwaarden wijzigen.
- Rulebook-PDF's zijn vaak publiek vindbaar, maar public availability is niet automatisch toestemming om ze in een SaaS te bewaren en te verwerken.
- PDF-kwaliteit varieert sterk. In de test was Viticulture via een direct gevonden PDF image-only: 20 pagina's, 0 extraheerbare tekst zonder OCR.
- Populaire spellen zijn vindbaar, maar publishers gebruiken soms Dropbox-folders, zip-downloads of JS/HTML flows in plaats van directe PDF-links.

Aanbevolen MVP: Engelstalige rulebooks, base game only, publisher/official-source first, manual review queue bij lage confidence, en antwoorden alleen met pagina-citaten.

## BGG API en spelidentificatie

### Bevindingen

BGG XML API2 documenteert `/xmlapi2/search` voor naamzoekopdrachten en `/xmlapi2/thing` voor detailmetadata. De API2 pagina noemt ook throttling: bij te snelle requests kan BGG `500` of `503` geven; een wachttijd van ongeveer 5 seconden tussen requests wordt genoemd als praktisch voldoende.

De aparte "Using the XML API" pagina is belangrijker voor productplanning. Die pagina heeft version date 2025-07-02 en zegt dat registratie en authorization vereist zijn voor XML API-gebruik. Een applicatie moet worden geregistreerd via BGG applications; approval kan een week of meer duren. Voor commerciele toepassingen is een commercial license nodig. BGG adviseert server-side requests met caching en minimale requestvolumes. Bearer tokens moeten via de `Authorization` header worden meegestuurd.

Eigen test:

```text
GET https://boardgamegeek.com/xmlapi2/search?query=wingspan&type=boardgame&exact=1
Result: 401 Unauthorized

GET https://boardgamegeek.com/xmlapi2/thing?id=266192&stats=1
Result: 401 Unauthorized
```

Conclusie: de API is technisch eenvoudig, maar productmatig afhankelijk van BGG approval en voorwaarden.

### Search/select UX

De app moet niet toelaten dat de gebruiker zomaar vrije tekst gebruikt als rulebook identity. Flow:

1. User typt spelnaam.
2. Backend zoekt BGG server-side met token.
3. UI toont kandidaten met naam, jaartal, type, afbeelding indien beschikbaar, publisher en BGG rank/rating indien toegestaan.
4. User kiest exact spel.
5. Backend gebruikt `bgg_game_id` als primaire identity.
6. Rulebook pipeline zoekt specifiek voor die game-id, titel, jaartal en publisher.

Ambiguiteit:

- "Viticulture" kan base game, Essential Edition, expansions en digitale/manual mirrors opleveren.
- "SUMO" is zeer ambigu; de juiste niche titel is BGG 406257, maar web search kan Kabuto Sumo of algemene sumo-games teruggeven.
- Expansions moeten niet automatisch gemengd worden met base game. De UI moet expansions apart laten kiezen.

Caching:

- Cache BGG search results kort, bijvoorbeeld 24 uur.
- Cache `thing` detailmetadata langer, bijvoorbeeld 7-30 dagen.
- Log API usage per endpoint.
- Alle BGG calls server-side; geen token in browser.

## Rulebook discovery

### Testresultaten

| Game | BGG target | Bronresultaat | Download | Extractie | Verdict |
|---|---:|---|---|---|---|
| Wingspan | 266192 | Stonemaier publisher page linkt naar Dropbox-folder; Rulepop ook beschikbaar. Officiele Dropbox folder bevat `WS_Rulebook_r24.pdf`. | Direct PDF via gewone link faalde met 403; Dropbox folder als zip was 783 MB; alleen rulebook geextraheerd. | 12 pagina's, 32.998 chars, goede tekst. | Haalbaar, maar discovery/download moet Dropbox-folder en grote zip vermijden. |
| Viticulture | 128621 / 183394 | Stonemaier publisher page linkt naar Dropbox-folder met rulebooks. Direct gevonden Steam manual candidate getest. | Steam PDF download OK, 23.4 MB. | 20 pagina's, 0 chars via pdfplumber: OCR nodig. | Haalbaar met OCR en betere source selection; niet vertrouwen op eerste PDF. |
| Frutticola | 234900 | Giochix direct PDF gevonden; BGG filepage bestaat voor English rulebook. | Direct download OK, 5.1 MB. | 12 pagina's, 27.695 chars, goede tekst behalve 1 vrijwel lege pagina. | Verrassend haalbaar als publisher PDF bekend is; discovery is moeilijker. |
| SUMO | 406257 | Bright Eye Games pagina bevestigt spel; Golden Meeple PDF mirror gevonden. | Direct download OK, 6.5 MB. | 2 pagina's, 5.480 chars, goede tekst. | Technisch haalbaar, maar bron is mirror/retailer, geen primaire publisher-download. |

### Discovery-strategie

Gebruik een candidate pipeline, geen single-shot scraper:

1. Official publisher page uit BGG metadata of web search.
2. Publisher domain search: `site:publisher.com "Game Title" rulebook PDF`.
3. Generic web search: `"Game Title" rulebook PDF board game`.
4. BGG filepage only als discoverability signal, niet blind scrapen of downloaden zonder toestemming/token.
5. Retail/library mirrors alleen als fallback en met lagere confidence.
6. User/manual review bij confidence onder drempel.

Ranking-signalen:

- Publisher domain match.
- PDF filename bevat titel of bekende afkorting.
- PDF tekst bevat titel, publisher, components/setup headings.
- BGG year/publisher match.
- Taal detectie is Engels.
- Geen expansion-keywords tenzij gebruiker expansion koos.
- HTTP content type `application/pdf`.
- PDF is tekst-extractable of OCRbaar.

Belangrijk: Stonemaier toont dat een officiele bron niet altijd een directe PDF is. Voor Wingspan gaf de publisherpagina een Dropbox-folder; `dl=1` downloadde een volledige folderzip van 783 MB. Productiecode moet folder-zips detecteren, indexeren zonder bulkdownload waar mogelijk, en max download size afdwingen.

## PDF parsing en opslag

### Extractie-observaties

- Wingspan: grote PDF maar goede tekstextractie.
- Frutticola: multi-column/layout geeft soms rommelige volgorde, maar tekst is bruikbaar.
- SUMO: kleine folder/layout, goede tekst maar speciale tekens zoals `Dohyō` moeten UTF-8 veilig verwerkt worden.
- Viticulture candidate: image-only; normale PDF text extraction levert niets op.

Conclusie: OCR is geen edge case maar een noodzakelijke pipeline-stap.

### Aanbevolen datamodel

Relationele DB plus object storage:

- `games`: `bgg_id`, canonical title, year, publishers, selected edition.
- `rulebook_sources`: discovered URL, source type, confidence, license status, language, edition guess.
- `rulebooks`: selected source, file hash, storage key, MIME, size, page count, processing status.
- `rulebook_pages`: page number, extracted text, OCR flag, extraction confidence, optional rendered image path.
- `rulebook_chunks`: chunk text, page range, section heading, token count, source offsets, confidence.
- `chunk_embeddings`: vector, model, dimensions, chunk id.
- `qa_logs`: question, retrieved chunks, answer, cited pages, refusal/not-found flag.

Object storage:

- Raw PDF.
- Rendered page images for viewer/OCR/debug.
- Optional normalized text JSON.

Indexing:

- Full-text index on page/chunk text.
- Trigram or exact keyword search for card names and rule terms.
- Vector index for semantic retrieval.
- Metadata filters on `bgg_id`, language, edition, base-game vs expansion.

Do not store only the PDF blob. Page-level and chunk-level records are needed for reliable citations.

## Retrieval en chatbotarchitectuur

### Waarom regex alleen onvoldoende is

Regex/full-text is goed voor exacte termen zoals `birdfeeder`, `YORIKIRI`, kaartnamen of setup keywords. Het faalt bij semantische vragen zoals "Wat gebeurt er als ik geen passende kleur heb?" of "Wanneer eindigt het spel?". Vector search helpt daar, maar vector search alleen kan exacte boardgame-termen missen. De juiste default is hybrid retrieval.

### Aanbevolen RAG-flow

1. Normalize question.
2. Detect selected game and rulebook edition from session.
3. Run exact/full-text retrieval against page/chunk text.
4. Run vector retrieval for semantic matches.
5. Merge results and rerank.
6. Keep top 4-8 chunks, with page numbers.
7. Ask model to answer only from supplied chunks.
8. Require structured output:
   - `answer`
   - `citations`: page, chunk id, quote/passages
   - `confidence`
   - `not_found_in_rules`
9. If no chunk passes threshold, answer: "Ik vind dit niet terug in de regels die voor dit spel zijn geladen."
10. UI shows answer plus "Bekijk passage" opening PDF page and optionally highlighted page text.

Prompt rule:

```text
You are a rules assistant. Answer only from the provided rule passages.
If the passages do not contain the answer, say that the answer is not found in the loaded rules.
Every factual claim must cite at least one passage id and page number.
Do not use general board game knowledge.
```

### Hosted OpenAI File Search vs self-managed retrieval

OpenAI File Search is excellent for prototyping: it supports semantic and keyword search over uploaded files through vector stores, and the Responses API can use the `file_search` tool. The docs also expose a vector store search endpoint with metadata filters, max result limits, reranking options, score thresholds and returned content chunks.

For this product, self-managed retrieval is still recommended for production because:

- Page citations must be deterministic.
- OCR and layout repair are product-specific.
- You need base-game/edition/language filters.
- You need source confidence and legal status.
- You need a PDF viewer that opens the exact page/passage.

OpenAI File Search is a good prototype option or internal admin QA tool. The production MVP should store its own chunks and page numbers.

## Modelkeuze: DeepSeek vs OpenAI

### DeepSeek

DeepSeek docs currently show OpenAI-compatible and Anthropic-compatible API formats. Current listed models include `deepseek-v4-flash` and `deepseek-v4-pro`; older `deepseek-chat` and `deepseek-reasoner` names are marked for deprecation on 2026-07-24. The pricing page lists 1M context length and low token prices: for `deepseek-v4-flash`, $0.14 per 1M input tokens cache miss and $0.28 per 1M output tokens; for `deepseek-v4-pro`, $0.435 input and $0.87 output per 1M tokens.

DeepSeek is attractive as answer model after retrieval. It should not be the only search mechanism. A 1M context model does not remove the need for page-aware retrieval, because citations, latency, cost, OCR quality and "not found" behavior still need deterministic evidence.

Current DeepSeek docs searched did not show a first-party embeddings or file-search equivalent comparable to OpenAI File Search. Plan on external retrieval/embeddings if using DeepSeek.

### OpenAI

OpenAI is stronger for an end-to-end prototype because File Search and Vector Stores are native, support PDF files, can combine semantic/keyword search, and expose retrieval controls. OpenAI pricing on 2026-07-02 lists File Search storage at $0.10/GB/day after 1 GB free and File Search tool calls at $2.50 per 1k calls. Model pricing varies strongly: `gpt-5.4-mini` is much cheaper than `gpt-5.5`, while `gpt-5.5` is listed as the latest flagship.

Recommendation:

- Prototype: OpenAI File Search + `gpt-5.4-mini` or current low-cost GPT model for fast validation.
- Production MVP: self-managed hybrid retrieval + OpenAI answer model for first release if citation quality is critical.
- Cost-optimized production: self-managed hybrid retrieval + DeepSeek v4-flash answer model after passing a citation-eval suite.

### Practical model evaluation

Do not choose the model only by benchmark or price. Build a 40-question eval set:

- 10 questions per test game.
- Include setup, turn timing, win condition, exceptions, exact term lookup and "not in rules" questions.
- Score exactness, citation correctness, refusal correctness and latency.
- Any answer without a valid page citation is a fail.

## Cost model

These are planning estimates, not quotes.

Assumptions:

- Average processed rulebook: 10k-25k text tokens after extraction/OCR.
- Average chat question: 2k retrieved input tokens and 800 output tokens.
- 1.000 games processed.
- 1.000 chat questions.

### Storage and ingestion

Raw PDFs in the four-test sample ranged from 5.1 MB to 75.9 MB. The mean is skewed by Wingspan's large art-heavy PDF. For 1.000 games, raw object storage can easily be 10-30 GB before rendered page images.

With OpenAI File Search storage pricing, 30 GB would be roughly 29 billable GB after the free 1 GB, or about $2.90/day if all stored in File Search. Self-managed object storage plus pgvector is likely cheaper for long-lived catalog storage.

OCR is the hidden cost. Viticulture showed 0 extractable chars from a 20-page candidate, so OCR must be budgeted for at least a meaningful minority of PDFs.

### Chat costs

OpenAI File Search prototype:

- File Search tool call: $2.50 per 1k questions.
- Plus model tokens.
- With `gpt-5.4-mini` and the 2k input/800 output assumption: about $1.50 input + $3.60 output per 1k questions, plus $2.50 tool calls = about $7.60 per 1k questions before storage.

DeepSeek answer model with self-managed retrieval:

- `deepseek-v4-flash`: about $0.28 input + $0.224 output per 1k questions under the same token assumption = about $0.50 per 1k questions, excluding retrieval infra and embeddings.
- `deepseek-v4-pro`: about $0.87 input + $0.696 output = about $1.57 per 1k questions, excluding retrieval infra and embeddings.

Interpretation: DeepSeek can materially reduce answer-generation cost, but retrieval quality and citation correctness must be proven separately.

## Technical architecture for MVP

### Frontend

- Search bar with BGG-powered autocomplete.
- Result picker showing title, year, type, publisher and BGG link.
- Rulebook discovery screen showing candidate source, language, edition and confidence.
- Ingestion progress: downloaded, text extracted, OCR if needed, indexed.
- Chat UI with answers, page citations and "Bekijk passage".
- PDF viewer pane opening cited page; later add highlighted passage boxes.

### Backend services

- `bgg-service`: server-side BGG XML API client, token auth, 5s rate-limit guard, cache.
- `discovery-service`: finds candidate rulebook URLs, scores sources, creates review tasks.
- `ingestion-worker`: downloads PDFs with max size/time limits, stores raw file, extracts text, OCRs if needed, chunks and indexes.
- `retrieval-service`: hybrid exact/vector retrieval plus reranking.
- `qa-service`: model call with strict citation schema and refusal behavior.
- `admin-review`: approve/reject candidate rulebook matches and legal/source confidence.

### Stack recommendation

MVP stack:

- Next.js or Remix frontend.
- Node/TypeScript API or Python FastAPI worker layer.
- Postgres + pgvector for metadata and vectors.
- S3/R2-compatible object storage for PDFs and rendered pages.
- Redis/BullMQ or similar queue for ingestion.
- `pdfplumber`/`pypdf` for text extraction.
- OCR: Tesseract for baseline; evaluate cloud OCR if accuracy is poor.
- Search: Postgres full-text + pgvector; optionally add Meilisearch/OpenSearch later.

## Legal and product risk

Public rulebook URLs are not automatically free-to-store assets. A commercial SaaS should:

- Prefer official publisher-hosted rulebooks.
- Store source URL, publisher, access date and license status.
- Avoid scraping private BGG APIs or BGG files without permission.
- Consider storing only user-uploaded PDFs for early private beta.
- Add takedown/removal process.
- For public app, include BGG attribution/logo if required by terms.

The largest go/no-go item is not AI quality; it is rulebook sourcing rights and BGG API license approval.

## Go/no-go by subsystem

| Subsystem | Verdict | Reason |
|---|---|---|
| BGG game search | Go with dependency | Technically simple, but requires BGG approval/token/license. |
| Rulebook discovery | Go for MVP, not full automation | Works for tested cases but needs fallback and review. |
| PDF parsing | Go with OCR requirement | 3/4 candidates extract text; 1/4 needs OCR. |
| Page citations | Go if self-managed | Reliable only if chunks retain page metadata. |
| Chatbot answers | Go with eval gate | RAG pattern is solid; strict citation eval is required. |
| DeepSeek-only solution | No-go | Good answer model candidate, but not enough for retrieval/citations alone. |
| OpenAI-only File Search product | Prototype go, production caution | Fast to build, but page control/legal/source metadata weaker than self-managed retrieval. |

## Recommended MVP scope

Build a private MVP with:

- BGG token-approved search.
- Base games only.
- English rulebooks only.
- Official/publisher source preferred.
- Manual review when source confidence is not high.
- Self-managed ingestion and retrieval.
- Chat answers only with page citations.
- No automatic answer when retrieval confidence is low.

Defer:

- Expansions and multiple editions.
- User collections.
- BGG files scraping.
- Multilingual rulebooks.
- Fully automatic long-tail coverage.
- Mobile app.

## Source list

- BGG XML API2: https://boardgamegeek.com/wiki/page/BGG_XML_API2
- BGG XML API usage/auth/licensing: https://boardgamegeek.com/using_the_xml_api
- OpenAI File Search docs: https://developers.openai.com/api/docs/guides/tools-file-search
- OpenAI Vector Store Search API: https://developers.openai.com/api/reference/resources/vector_stores/methods/search
- OpenAI API pricing: https://developers.openai.com/api/docs/pricing
- DeepSeek first API call: https://api-docs.deepseek.com/
- DeepSeek models/pricing: https://api-docs.deepseek.com/quick_start/pricing
- DeepSeek parameter settings: https://api-docs.deepseek.com/quick_start/parameter_settings
- Stonemaier Wingspan rules page: https://stonemaiergames.com/games/wingspan/rules/
- Stonemaier Viticulture rules page: https://stonemaiergames.com/games/viticulture/rules/
- Rulepop Wingspan: https://rulepop.com/wingspan/
- Frutticola PDF: https://www.giochix.it/rules/frutticola%20ENG.pdf
- Frutticola BGG filepage signal: https://boardgamegeek.com/filepage/216714/english-rulebook
- Bright Eye Games game list: https://www.brighteyegames.com/games
- SUMO PDF candidate: https://www.goldenmeeple.be/wp-content/uploads/2024/07/Sumo-Rulebook.pdf

# MVP Plan: Board Game Rules Wizard

Datum: 2026-07-02  
Status: MVP proposal v1

## 0. Beslissingen na user input

Deze keuzes zijn vastgelegd op 2026-07-02:

- BGG username/context: `Vortlas`.
- BGG auth: username is niet genoeg voor de huidige XML API calls; API auth blijft later nodig, maar is geen blocker voor de lokale MVP.
- Tijdelijke game catalogus: gebruik de lokale BGG CSV dump `C:\Users\kdeme\Documents\Karel Demeersseman\Boardgame rules\boardgames_ranks_2026-07-02\boardgames_ranks.csv`.
- Lokale MVP gebruikt CSV-based search in plaats van live BGG API calls.
- OpenAI: gebruik `OPENAI_API_KEY` als environment variable voor lokale tests. De key wordt niet in repo- of outputbestanden opgeslagen.
- Juridische bronpolicy: nog niet aan de orde.
- Hosting: lokaal voor MVP; later migratie naar Vercel.
- Database/storage: eerst lokaal; ontwerp met migratiepad naar Convex.
- UI-taal: Engels.
- Eerste beta-catalogus: nog niet vastgelegd.

## 1. MVP in 1 zin

Een webapp waarin je via BoardGameGeek een bordspel selecteert, een Engelstalig base-game rulebook laat verwerken, en daarna vragen stelt aan een chatbot die alleen antwoordt met bewijs uit het rulebook en altijd paginacitaties toont.

## 2. MVP-doel

Valideren of gebruikers vertrouwen hebben in een rules chatbot wanneer:

- het juiste spel via BGG gekozen wordt;
- het rulebook controleerbaar aan dat spel gekoppeld is;
- antwoorden alleen uit het rulebook komen;
- elke uitleg een pagina/passage toont;
- de bot eerlijk weigert wanneer het antwoord niet in de regels staat.

De MVP moet betrouwbaarheid bewijzen, niet maximale catalogusdekking.

## 3. MVP-scope

### Wel in MVP

- Game search via lokale BGG CSV dump.
- Result picker met titel, jaar, rank, rating, user count, expansion/base-game indicator en BGG-link.
- Base-game only.
- Engelstalige rulebooks.
- Rulebook candidate discovery met confidence score.
- Admin/manual approval voor lage confidence.
- PDF download en opslag.
- PDF text extraction.
- OCR fallback voor image-only PDFs.
- Page-level text opslag.
- Chunking met page metadata.
- Hybrid retrieval: full-text plus vector search.
- Chatbot met strict grounded answers.
- Paginacitaties bij elk antwoord.
- "Bekijk passage" opent de juiste PDF-pagina.
- Evalset voor Wingspan, Viticulture, Frutticola en SUMO.

### Niet in MVP

- Volledige automatische dekking voor alle spellen.
- Expansions automatisch combineren met base game.
- Meertalige rulebooks.
- BGG files scraping zonder expliciete toestemming.
- Native mobile app.
- User accounts met collecties.
- Publisher dashboards.
- Exacte tekst-highlighting met bounding boxes.
- Betalingen/subscriptions.

## 4. Aanbevolen MVP-stack

### Frontend

- Next.js app.
- Eén user-facing flow:
  - search/select game;
  - rulebook status;
  - chat met citations;
  - PDF viewer.
- Eén admin flow:
  - candidate review;
  - approve/reject/legal uncertain.

### Backend

- Next.js API routes voor lokale MVP.
- Lokale worker of background task voor ingestion, omdat PDF/OCR/indexing async moet zijn.
- Lokale database voor MVP, bij voorkeur SQLite met een data-access laag die later naar Convex kan migreren.
- Lokale filesystem storage voor PDFs, rendered pages en extraction artifacts.
- In-process job queue voor lokale MVP; later Redis/BullMQ of Convex actions/workflows.
- Ontwerp storage en repositories zo dat database/provider swap later beperkt blijft.

### PDF en OCR

- `pdfplumber`/`pypdf` voor tekstextractie.
- Tesseract als eerste OCR-baseline.
- Cloud OCR later evalueren als Tesseract onvoldoende is.

### AI/retrieval

- MVP-start: self-managed retrieval met lokale full-text/vector search.
- Answer model: OpenAI low-cost GPT-model als default voor betrouwbaarheid.
- DeepSeek v4-flash later testen als kostenoptimalisatie.
- Later migration target: Convex is plausibel omdat Convex officiële full-text search en vector search ondersteunt.

## 5. Kernflows

### Flow A: spel kiezen

1. Gebruiker zoekt `Wingspan`.
2. App zoekt in de lokale BGG CSV dump via backend.
3. App toont resultaten met `id`, `name`, `yearpublished`, `rank`, `average`, `usersrated` en `is_expansion`.
4. Gebruiker kiest exact BGG-resultaat.
5. App bewaart `bgg_id` en CSV metadata.

MVP acceptance:

- Chat kan niet starten zonder gekozen BGG-game.
- Ambigue titels tonen meerdere opties.
- Expansion-resultaten worden niet automatisch als base game gekozen.
- Resultaten kunnen zonder live BGG API werken zolang de CSV dump aanwezig is.

### Flow B: rulebook verwerken

1. App zoekt rulebook candidates.
2. App scoort candidates op publisher match, title match, language, edition, source type en PDF-validiteit.
3. Hoge confidence: ingestion start.
4. Lage confidence: admin review.
5. Ingestion downloadt PDF, extraheert tekst, OCRt indien nodig, chunked en indexeert.
6. Status wordt `ready`.

MVP acceptance:

- Image-only PDF activeert OCR.
- Te grote downloads of folder-zips worden geblokkeerd of naar review gestuurd.
- Elke chunk heeft page metadata.

### Flow C: vraag beantwoorden

1. Gebruiker stelt vraag.
2. Backend zoekt relevante chunks via full-text + vector search.
3. Backend rerankt en filtert op confidence.
4. Model krijgt alleen relevante chunks.
5. Model antwoordt met citations.
6. UI toont antwoord plus paginalinks.

MVP acceptance:

- Geen antwoord zonder citatie.
- Not-found als retrieval onvoldoende bewijs vindt.
- PDF viewer opent de geciteerde pagina.

## 6. MVP-milestones

### Week 1 - Foundations

- Project scaffold.
- Database schema.
- Object storage setup.
- CSV catalog loader/search endpoint.
- Basic game search UI.

### Week 2 - Ingestion

- Rulebook source model.
- PDF downloader.
- Text extraction.
- OCR fallback.
- Chunking.
- Ingestion status UI.

### Week 3 - Retrieval en chat

- Full-text retrieval.
- Vector embeddings en pgvector search.
- Hybrid merge/rerank.
- Strict answer prompt/schema.
- Chat UI met citations.
- PDF page viewer.

### Week 4 - Admin en eval

- Admin review queue.
- Candidate approval/rejection.
- 40-question evalset.
- Citation correctness tests.
- Security/download hardening.
- Private beta readiness checklist.

## 7. Nodig van jou voor implementatie

### Verplicht

1. **BGG API toegang**
   - Username `Vortlas` is genoteerd, maar dit is geen vervanging voor API authorization.
   - Voor de lokale MVP gebruiken we geen live BGG API voor search.
   - Game search gebruikt tijdelijk de CSV dump: `C:\Users\kdeme\Documents\Karel Demeersseman\Boardgame rules\boardgames_ranks_2026-07-02\boardgames_ranks.csv`.
   - Een echte BGG application token blijft later nodig voor live metadata zoals images, publishers, descriptions en up-to-date thing details.
   - Beslissing of dit commercieel bedoeld is blijft later relevant, want BGG kan commercial licensing vereisen.

2. **Model/API keuze**
   - OpenAI gebruiken voor lokale MVP-tests via `OPENAI_API_KEY`.
   - De key wordt alleen als environment variable gebruikt, niet in bestanden opgeslagen.
   - Embeddings mogen voorlopig via OpenAI lopen voor de lokale MVP, tenzij later anders beslist.

3. **Juridische bronpolicy**
   - Mag de MVP publieke publisher PDFs opslaan?
   - Of starten we veiliger met handmatig goedgekeurde/test-rulebooks?
   - Takedown/removal procedure nodig voor beta.

4. **Hosting/infrastructuur**
- MVP draait lokaal.
- Later deployment target: Vercel.
- Database/storage eerst lokaal; later migratiepad naar Convex onderzoeken/voorbereiden.
- Relevante documenten worden ook bewaard in `C:\Users\kdeme\Documents\Karel Demeersseman\Boardgame rules\boardgames_ranks_2026-07-02`.

5. **MVP taalkeuze**
   - UI in Engels.
   - Rulebooks in MVP: aanbevolen Engels only.

### Sterk aanbevolen

6. **Eerste catalogus**
   - Nog niet nodig.
   - Voor technische MVP gebruiken we de vier research-games: Wingspan, Viticulture, Frutticola en SUMO.

7. **Budgetgrens**
   - Maandbudget voor model calls, storage en OCR.
   - Beslissing of we duurdere maar betrouwbaardere models mogen gebruiken tijdens eval.

8. **Admin/reviewer**
   - Wie keurt rulebook candidates goed?
   - Wie beslist legal uncertain vs approved?

9. **Succescriteria**
   - Bijvoorbeeld: 90% citation-correct antwoorden op evalset.
   - Max chat latency.
   - Hoeveel manual review acceptabel is.

## 8. Beslissingen die ik als default zou nemen

Als jij geen voorkeur geeft, zou ik deze defaults nemen:

- UI: Engels voor app labels, omdat rulebooks MVP ook Engels zijn.
- Backend: TypeScript/Next.js plus lokale worker.
- DB: lokale SQLite of equivalent local store achter repository interfaces.
- Storage: lokale filesystem storage onder een configureerbare data directory.
- Queue: lokale in-process queue voor MVP.
- Retrieval: self-managed hybrid retrieval.
- Model MVP: OpenAI voor answer generation en embeddings.
- DeepSeek: pas testen na werkende eval baseline.
- OCR: Tesseract baseline.
- Rulebook policy: alleen official publisher sources of handmatig approved sources.
- MVP catalogus: Wingspan, Viticulture, Frutticola en SUMO.

## 9. Private beta launch criteria

- CSV catalog loader werkt lokaal en kan zoeken op naam.
- BGG API token is niet nodig voor private local MVP, maar blijft later nodig voor live BGG metadata.
- Minstens 10 spellen verwerkt of correct in review gezet.
- 40-question evalset draait automatisch.
- Minimaal 90% correcte antwoorden met correcte citaties.
- Minimaal 95% correcte not-found behavior.
- 0 toegelaten antwoorden zonder citatie.
- Admin kan sources goedkeuren/afwijzen.
- PDF viewer opent geciteerde pagina.
- Download hardening actief: max size, redirect limit, SSRF-blocking.
- Basic logging voor retrieval en QA beschikbaar.

## 10. Eerste implementatievolgorde

1. Scaffold app + DB + storage.
2. Local config/secrets setup met `OPENAI_API_KEY`; `BGG_API_TOKEN` blijft optioneel voor later.
3. CSV catalog loader bouwen voor `boardgames_ranks.csv`.
4. CSV search/select bouwen.
5. Handmatige rulebook upload/source toevoegen voor testspellen.
6. PDF extraction + OCR + page/chunk storage.
7. Hybrid retrieval.
8. Chat with citations.
9. PDF page viewer.
10. Discovery automation.
11. Admin review.
12. Eval suite en hardening.

Deze volgorde vermijdt dat het project vastloopt op volledig automatische rulebook discovery voordat de kernwaarde is bewezen: betrouwbare vraag/antwoord met pagina-citaties.

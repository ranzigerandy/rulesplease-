# PRD: Board Game Rules Wizard

Datum: 2026-07-02  
Status: Draft v1  
Producttype: Webapp / AI rules assistant  
Primaire taal MVP: Engels voor UI en rulebooks

## 0. Beslissingen na user input

- UI-taal MVP: Engels.
- BGG username/context: `Vortlas`.
- BGG auth: username is geen vervanging voor API authorization; API auth blijft later nodig maar is geen blocker voor lokale MVP.
- Tijdelijke game catalogus: gebruik `C:\Users\kdeme\Documents\Karel Demeersseman\Boardgame rules\boardgames_ranks_2026-07-02\boardgames_ranks.csv`.
- Lokale MVP gebruikt CSV-based game search in plaats van live BGG API calls.
- OpenAI: lokale MVP-tests gebruiken `OPENAI_API_KEY` als environment variable. Secrets worden niet in bestanden opgeslagen.
- Hosting: lokaal voor MVP, later Vercel.
- Database/storage: lokaal voor MVP, met migratiepad naar Convex.
- Eerste beta-catalogus: nog niet vastgelegd; technische MVP gebruikt Wingspan, Viticulture, Frutticola en SUMO.
- Juridische bronpolicy: later te beslissen.

## 1. Productoverzicht

Board Game Rules Wizard is een tool waarmee een gebruiker een bordspel zoekt via BoardGameGeek, het juiste spel selecteert, het bijhorende rulebook laat ophalen en daarna vragen kan stellen aan een chatbot. De chatbot mag alleen antwoorden op basis van het geladen rulebook en moet elke inhoudelijke claim ondersteunen met een paginaverwijzing en een optie om de relevante passage in het rulebook te bekijken.

De MVP focust op gecontroleerde betrouwbaarheid, niet op volledige automatische dekking van alle spellen. Het product moet daarom publisher-first rulebook discovery, manual review bij twijfel, OCR, page-aware chunking en strict cited QA ondersteunen.

## 2. Probleem

Bordspelregels zijn vaak lang, verspreid over rulebooks, FAQ's, expansions en edities. Spelers willen snel antwoord op regelsituaties zonder lange PDFs te doorzoeken. Generieke chatbots kunnen hallucineren of antwoorden geven op basis van algemene kennis, waardoor ze onbetrouwbaar zijn voor regels.

Het product lost dit op door:

- het juiste spel te identificeren via BGG;
- het juiste rulebook te koppelen aan dat spel;
- het rulebook pagina- en chunkgewijs te indexeren;
- antwoorden te beperken tot gevonden passages;
- elke uitleg controleerbaar te maken via paginacitaties.

## 3. Doelen

### Productdoelen

- Gebruikers kunnen een spel zoeken en ondubbelzinnig selecteren via de lokale BGG CSV dump.
- Gebruikers kunnen een rulebook laten vinden en verwerken voor het gekozen spel.
- Gebruikers kunnen vragen stellen en antwoorden krijgen met paginaverwijzingen.
- De chatbot weigert te antwoorden wanneer het antwoord niet in de geladen regels staat.
- Admins kunnen rulebook-kandidaten beoordelen wanneer automatische confidence laag is.

### Technische doelen

- Alle BGG API-calls server-side uitvoeren met token, rate limiting en caching.
- Voor de lokale MVP: game search uitvoeren via de lokale BGG CSV dump, zonder live BGG API dependency.
- Rulebook discovery uitvoeren via een candidate pipeline met confidence scoring.
- PDFs verwerken naar raw file, page text, OCR-status, chunks en embeddings.
- Hybrid retrieval gebruiken: full-text plus vector search plus reranking.
- Antwoorden genereren met een strikt citations-schema.
- Lokale MVP-infrastructuur gebruiken met repository/storage interfaces zodat later migratie naar Convex/Vercel mogelijk blijft.

### Niet-doelen voor MVP

- Geen volledige automatische dekking voor alle BGG-spellen.
- Geen expansions tenzij expliciet geselecteerd.
- Geen meertalige rulebook-support behalve Engels.
- Geen BGG files scraping zonder expliciete toestemming/voorwaardencheck.
- Geen mobiele native app.
- Geen user collections of social features.
- Geen algemene bordspelkennis buiten het geselecteerde rulebook.

## 4. Doelgebruikers

### Primaire gebruiker: bordspelspeler

Wil tijdens of voor een spel snel een regelvraag stellen en het antwoord kunnen controleren in het rulebook.

Belangrijkste behoeften:

- snel juiste spel kiezen;
- vraag in natuurlijke taal stellen;
- kort en duidelijk antwoord krijgen;
- passage en pagina kunnen controleren;
- vertrouwen dat de bot niet verzint.

### Secundaire gebruiker: power user / host

Speelt veel verschillende spellen en wil vooraf rulebooks voorbereiden of vaker vragen stellen rond complexe games.

Belangrijkste behoeften:

- eerder verwerkte spellen hergebruiken;
- duidelijk zien welke editie of taal geladen is;
- foutieve rulebook-match kunnen melden.

### Interne gebruiker: admin/reviewer

Beoordeelt rulebook-kandidaten, juridische status en bronconfidence.

Belangrijkste behoeften:

- kandidaten naast BGG metadata bekijken;
- bron, taal, editie en confidence zien;
- rulebook goedkeuren of afwijzen;
- processing status en extractiekwaliteit inspecteren.

## 5. MVP-scope

### In scope

- Webapp met game search, game selection, rulebook ingestion status en chat.
- BGG game search via lokale CSV dump.
- BGG application token en server-side client.
- Base game selectie.
- Engelstalige rulebook discovery.
- Rulebook candidate scoring.
- Admin review flow voor lage confidence.
- PDF download met max-size, MIME en redirect checks.
- Text extraction plus OCR fallback.
- Page-level text storage.
- Chunking met page metadata.
- Full-text search plus vector search.
- Answer generation met citations en refusal behavior.
- PDF/passage viewer op geciteerde pagina.
- Basic QA/eval set voor de vier research-games: Wingspan, Viticulture, Frutticola, SUMO.

### Out of scope voor MVP

- Automatisch verwerken van expansions en meerdere edities tegelijk.
- Volledige BGG catalogus vooraf crawlen.
- User uploads als primaire flow.
- Publisher partnerships.
- Native mobile apps.
- Real-time multiplayer of table mode.
- Geavanceerde passage highlighting met exacte bounding boxes, tenzij makkelijk beschikbaar uit OCR.

## 6. Belangrijkste gebruikersflows

### Flow 1: spel zoeken en selecteren

1. Gebruiker typt een spelnaam in het zoekveld.
2. Backend zoekt in de lokale BGG CSV dump.
3. UI toont zoekresultaten met titel, jaar, rank, average rating, user count, expansion/base-game indicator en BGG link.
4. Gebruiker selecteert een exact resultaat.
5. App maakt of opent de lokale `game` record op basis van `bgg_id`.

Acceptatiecriteria:

- Vrije tekst alleen is nooit genoeg om een chat te starten.
- De geselecteerde BGG id is zichtbaar of inspecteerbaar.
- Search werkt zonder live BGG API zolang de CSV dump beschikbaar is.
- Ambigue titels tonen meerdere kandidaten.
- Expansions worden herkenbaar getoond en niet automatisch als base game gekozen.

### Flow 2: rulebook vinden en verwerken

1. App start rulebook discovery voor geselecteerd spel.
2. Candidate sources worden gevonden en gescoord.
3. Bij hoge confidence wordt kandidaat verwerkt; bij lage confidence gaat kandidaat naar admin review.
4. PDF wordt gedownload met veiligheidschecks.
5. PDF wordt opgeslagen in object storage.
6. Tekstextractie wordt uitgevoerd.
7. OCR wordt uitgevoerd als tekstextractie onvoldoende is.
8. Pages en chunks worden opgeslagen.
9. Full-text index en embeddings worden aangemaakt.
10. Game status wordt `ready_for_questions`.

Acceptatiecriteria:

- PDF groter dan ingestelde limiet wordt geweigerd of naar review gestuurd.
- Image-only PDF activeert OCR.
- Elke chunk heeft minstens `rulebook_id`, `page_start`, `page_end`, `source_url` en `text`.
- Rulebook zonder voldoende extractie/OCR mag niet naar `ready_for_questions`.

### Flow 3: vraag stellen

1. Gebruiker stelt een vraag in de chat.
2. Backend zoekt relevante chunks met hybrid retrieval.
3. Backend rerankt resultaten en past score threshold toe.
4. Als onvoldoende bewijs bestaat, antwoordt de bot dat het niet in de geladen regels staat.
5. Als voldoende bewijs bestaat, genereert de bot een kort antwoord met citaties.
6. UI toont antwoord, paginanummers en knoppen om passages te bekijken.

Acceptatiecriteria:

- Elk feitelijk antwoord heeft minimaal een paginacitatie.
- Antwoorden zonder relevante chunk zijn verboden.
- De bot gebruikt geen algemene kennis buiten de opgehaalde passages.
- De "Bekijk passage" actie opent de juiste PDF-pagina.

### Flow 4: admin review

1. Admin opent queue met rulebook candidates.
2. Admin ziet BGG metadata, candidate URL, source type, confidence, taal, editie en downloadstatus.
3. Admin keurt kandidaat goed, wijst af of markeert juridisch onzeker.
4. Goedgekeurde kandidaat start ingestion.

Acceptatiecriteria:

- Afgewezen kandidaten worden niet opnieuw automatisch gekozen zonder nieuwe signalen.
- Juridisch onzekere kandidaten blokkeren publieke beschikbaarheid.
- Admin-keuzes worden gelogd.

## 7. Functionele requirements

### BGG catalogus en integratie

- Systeem moet voor lokale MVP de BGG CSV dump kunnen laden en doorzoeken.
- Systeem moet minimaal deze CSV-kolommen ondersteunen: `id`, `name`, `yearpublished`, `rank`, `bayesaverage`, `average`, `usersrated`, `is_expansion`.
- Systeem moet later BGG API-calls server-side kunnen uitvoeren.
- Systeem moet bearer token/config secret ondersteunen via `BGG_API_TOKEN` wanneer live API wordt toegevoegd.
- Systeem mag `Vortlas` als BGG username/context gebruiken waar een endpoint user context nodig heeft, maar niet als authenticatievervanger.
- Systeem moet later rate limiting ondersteunen, initieel maximaal 1 request per 5 seconden per BGG endpoint queue.
- Systeem moet later BGG responses cachen.
- Systeem moet later BGG failures tonen als retrybare status, niet als lege zoekresultaten.

### Rulebook discovery

- Systeem moet candidate URLs kunnen vinden via publisher-first strategie.
- Systeem moet source type classificeren: official publisher, BGG signal, retailer/mirror, unknown.
- Systeem moet confidence score berekenen.
- Systeem moet expansion/edition keywords herkennen en lager scoren bij mismatch.
- Systeem moet manual review afdwingen onder confidence threshold.

### PDF ingestion

- Systeem moet PDFs downloaden met timeout, redirect limit, size limit en MIME/content sniffing.
- Systeem moet raw PDF bewaren in object storage.
- Systeem moet PDF metadata opslaan: hash, size, page count, source URL, access date.
- Systeem moet tekst per pagina extraheren.
- Systeem moet OCR fallback uitvoeren als extractie onder minimumdrempel zit.
- Systeem moet UTF-8 veilig zijn.

### Retrieval

- Systeem moet full-text retrieval uitvoeren.
- Systeem moet vector retrieval uitvoeren.
- Systeem moet resultaten combineren en reranken.
- Systeem moet metadata filters afdwingen op game, rulebook, language en edition.
- Systeem moet alleen chunks boven score threshold aan het answer model geven.

### Chatbot

- Systeem moet strict grounded answering afdwingen.
- Systeem moet structured output valideren.
- Systeem moet antwoord weigeren wanneer citations ontbreken.
- Systeem moet not-found antwoorden loggen.
- Systeem moet bronpassages tonen naast of onder het antwoord.

### Admin

- Systeem moet candidate review queue aanbieden.
- Systeem moet rulebook processing status tonen.
- Systeem moet bron/legal confidence kunnen opslaan.
- Systeem moet takedown/removal van rulebooks ondersteunen.

## 8. Niet-functionele requirements

### Betrouwbaarheid

- Geen chatantwoord zonder citeerbare bronpassage.
- Alle retrieval en answer events worden gelogd voor debugging.
- Ingestion jobs zijn retrybaar en idempotent op file hash/source URL.

### Performance

- Game search results binnen 2 seconden wanneer cache hit.
- Chatantwoord binnen 8 seconden voor ready rulebooks in MVP.
- Ingestion mag async zijn en langer duren, met duidelijke status.

### Security

- BGG token en model API keys alleen server-side.
- Geen raw API keys in frontend.
- Geen raw API keys in repo-, output- of documentatiebestanden.
- Admin routes beschermd met auth.
- Downloaders volgen geen onbeperkte redirects en blokkeren lokale/private IP targets.

### Compliance en legal

- Systeem bewaart bron-URL, access date en source type.
- Publieke beschikbaarheid van een PDF is niet automatisch genoeg voor public SaaS use.
- Systeem ondersteunt removal/takedown.
- BGG terms en eventuele commercial license moeten worden nageleefd voor launch.

## 9. Data model concept

Minimale tabellen/collections:

- `games`: `id`, `bgg_id`, `title`, `year`, `type`, `publishers`, `image_url`, `created_at`, `updated_at`.
- `rulebook_sources`: `id`, `game_id`, `url`, `source_type`, `language`, `edition_guess`, `confidence`, `legal_status`, `status`.
- `rulebooks`: `id`, `game_id`, `source_id`, `file_hash`, `storage_key`, `mime`, `size_bytes`, `page_count`, `processing_status`.
- `rulebook_pages`: `id`, `rulebook_id`, `page_number`, `text`, `ocr_used`, `extraction_confidence`, `page_image_key`.
- `rulebook_chunks`: `id`, `rulebook_id`, `page_start`, `page_end`, `section_heading`, `text`, `token_count`, `confidence`.
- `chunk_embeddings`: `chunk_id`, `embedding_model`, `dimensions`, `vector`.
- `questions`: `id`, `game_id`, `rulebook_id`, `user_question`, `answer`, `not_found`, `created_at`.
- `question_citations`: `question_id`, `chunk_id`, `page_start`, `page_end`, `quote`.
- `admin_reviews`: `id`, `source_id`, `reviewer_id`, `decision`, `notes`, `created_at`.

MVP-opslag is lokaal. Implementeer de datalaag via repositories zodat tabellen/collections later naar Convex gemapt kunnen worden. Voor CSV-ingest mogen ontbrekende velden zoals `publishers` en `image_url` leeg blijven tot live BGG API of een extra metadata source beschikbaar is.

## 10. Model en retrieval strategy

### MVP recommendation

- Prototype kan OpenAI File Search gebruiken voor snelle validatie.
- Lokale MVP gebruikt self-managed retrieval met lokale full-text/vector search.
- Answer model initieel OpenAI low-cost GPT model wanneer citation quality prioriteit heeft.
- DeepSeek v4-flash kan later als kostenoptimalisatie getest worden.
- Convex blijft een migratieoptie omdat het full-text search en vector search ondersteunt.

### Answer contract

Het model moet antwoorden in een schema dat minimaal bevat:

- `answer`
- `citations`
- `not_found_in_rules`
- `confidence`

Als `citations` leeg is bij een feitelijk antwoord, wordt het antwoord verworpen en vervangen door een not-found of retry.

## 11. UX requirements

### Game search page

- Zoekveld met resultatenlijst.
- Resultaat toont titel, jaar, type, publisher en BGG link.
- Duidelijke indicatie wanneer meerdere mogelijke spellen bestaan.

### Rulebook status page

- Toont selected game.
- Toont discovery status.
- Toont candidate source en confidence.
- Toont ingestion status: queued, downloading, extracting, OCR, indexing, ready, failed, review required.

### Chat page

- Chatvenster met vraaginvoer.
- Antwoord toont paginacitaties.
- Elke citatie heeft "Bekijk passage".
- Not-found antwoord is duidelijk en niet beschuldigend.
- UI toont welke rulebook-editie geladen is.

### Admin review

- Table/list van candidates.
- Candidate detail met source URL, confidence signals, BGG metadata, detected language, page count, extraction preview.
- Approve/reject/legal uncertain acties.

## 12. Success metrics

### MVP launch criteria

- 4 testgames succesvol verwerkt of correct geblokkeerd met review/OCR status.
- Minimaal 40-question eval set afgerond.
- Minimaal 90% correcte antwoorden met correcte citaties op answerable vragen.
- Minimaal 95% correcte not-found behavior op unanswerable vragen.
- 0 toegelaten antwoorden zonder citatie.
- BGG API approval/token en legal position zijn duidelijk voor private beta.

### Product metrics na beta

- Percentage rulebooks automatisch approved.
- Percentage rulebooks dat OCR nodig heeft.
- Citation correctness rate.
- Not-found rate.
- Gemiddelde chat latency.
- Gebruiker meldt foutieve citatie.
- Admin review throughput.

## 13. Milestones

### M0 - Research en planning

- Feasibility research.
- Rulebook testmatrix.
- Browser-readable report.
- PRD.
- Project state/TODO.

### M1 - Technical spike

- CSV catalog loader/search endpoint.
- BGG API client met token/caching later toevoegen voor verrijkte metadata.
- PDF ingestion prototype voor 4 testgames.
- OCR fallback spike.
- Chunking en page citation proof.

### M2 - MVP backend

- Database schema.
- Object storage.
- Discovery service.
- Ingestion worker.
- Retrieval service.
- QA service.

### M3 - MVP frontend

- Game search/select.
- Rulebook status.
- Chat UI.
- PDF passage viewer.
- Admin review UI.

### M4 - Evaluation en hardening

- 40-question eval suite.
- Citation validation.
- Security/download hardening.
- Legal/takedown flow.
- Private beta readiness.

## 14. Open decisions

- Definitieve UI-taal: Engels.
- Definitieve modelprovider voor MVP: OpenAI voor lokale MVP-tests.
- OCR provider: Tesseract baseline, cloud OCR, of beide.
- Hosting stack: lokaal voor MVP, later Vercel.
- Juridische aanpak: alleen publisher-approved sources, user-upload fallback, of private beta met beperkte catalogus.
- Live BGG API timing: later, na lokale CSV-based MVP.

## 15. Belangrijkste risico's

- BGG weigert of beperkt commerciele API-toegang.
- Publishers staan opslag/verwerking van rulebooks niet toe.
- Discovery koppelt verkeerd rulebook aan spel of editie.
- OCR introduceert tekstfouten die antwoordkwaliteit schaden.
- Model geeft antwoord buiten bronpassages.
- Paginacitatie verwijst naar verkeerde pagina door PDF layout/extractieproblemen.
- Kosten van File Search/storage worden te hoog bij grote catalogus.

## 16. Bronnen

- Research report: `outputs/board-game-rules-wizard-research.md`
- Testmatrix: `outputs/rulebook-test-matrix.md`
- Browser report: `outputs/board-game-rules-wizard-research.html`

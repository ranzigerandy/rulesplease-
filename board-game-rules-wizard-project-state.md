# Board Game Rules Wizard - Project State / TODO

Laatste update: 2026-07-15
Statuslegende: `[ ]` nog te doen, `[x]` klaar

Dit bestand is de projectstatus op taakniveau. Werk dit bestand bij wanneer een taak wordt afgerond, geblokkeerd of opgesplitst.

## Decision log

- [x] DL.1 BGG username/context vastgelegd als `Vortlas`.
- [x] DL.2 Vastgesteld dat BGG username geen auth-token vervangt; huidige live XML API calls geven `401 Unauthorized`.
- [x] DL.3 Live BGG API uitgesteld; lokale MVP gebruikt BGG CSV dump voor game search.
- [x] DL.4 OpenAI gekozen voor lokale MVP-tests via `OPENAI_API_KEY`; secret niet opslaan in repo/outputbestanden.
- [x] DL.5 Hostingkeuze MVP: lokaal.
- [x] DL.6 Later deployment target: Vercel.
- [x] DL.7 Database/storage MVP: lokaal, met migratiepad naar Convex.
- [x] DL.8 UI-taal vastgelegd als Engels.
- [x] DL.9 Eerste beta-catalogus nog niet vastgelegd; technische MVP gebruikt research-games.
- [x] DL.10 BGG CSV dump vastgelegd: `C:\Users\kdeme\Documents\Karel Demeersseman\Boardgame rules\boardgames_ranks_2026-07-02\boardgames_ranks.csv`.
- [x] DL.11 Convex wordt gefaseerd de centrale database, realtime-laag, vectorzoeklaag en cloudopslag.
- [x] DL.12 De frontend migreert naar Next.js App Router; de bestaande statische/Python-app blijft tijdelijk beschikbaar als rollback.
- [x] DL.13 Python blijft de ingestion-worker voor discovery, PDF-download, extractie en OCR en communiceert via beveiligde Convex worker-endpoints.
- [x] DL.14 Convex Auth met password-provider is de standaard; data-autorisatie wordt in alle Convex-functies server-side afgedwongen.
- [x] DL.15 Alleen geselecteerde spellen worden naar Convex gemigreerd; de volledige BGG CSV-catalogus blijft voorlopig lokaal.
- [x] DL.16 Clerk vervangt Convex Auth voor accountmanagement; Convex valideert Clerk-sessiontokens en gebruikt de Clerk user-ID voor alle gegevensisolatie. DL.14 is hiermee vervallen.

## M0 - Research en productdefinitie

- [x] M0.1 Feasibility research uitvoeren voor BGG API, rulebook discovery, PDF parsing, retrieval, modelkeuze en risico's.
- [x] M0.2 Testcases onderzoeken: Wingspan, Viticulture, Frutticola en SUMO.
- [x] M0.3 Rulebook testmatrix maken met bron, downloadstatus, extractiekwaliteit en feasibility.
- [x] M0.4 Browser-readable research report maken.
- [x] M0.5 PRD aanmaken.
- [x] M0.6 Project state/TODO bestand aanmaken.
- [ ] M0.7 Open decisions reviewen en resterende keuzes vastleggen.
- [ ] M0.8 Juridische uitgangspunten valideren voor rulebook opslag/verwerking.
- [ ] M0.9 BGG application/approval proces starten.

## M1 - Technical spike

### BGG API

- [ ] M1.1 BGG developer/application registratie afronden voor latere live API metadata.
- [ ] M1.2 BGG API token veilig configureren als server-side secret wanneer live API nodig wordt.
- [ ] M1.3 CSV catalog loader bouwen voor `boardgames_ranks.csv`.
- [ ] M1.4 CSV search endpoint bouwen.
- [ ] M1.5 CSV search ranking implementeren op naam, jaar, rank, usersrated en `is_expansion`.
- [ ] M1.6 Ambigue zoekcases testen: `Viticulture`, `SUMO`, expansion titles.
- [ ] M1.7 Later: BGG thing/detail endpoint spike bouwen voor verrijkte metadata.
- [ ] M1.7a Later: Rate limiting implementeren met initiele 5s guard voor live BGG API.
- [ ] M1.7b Later: Response caching testen voor live BGG search en thing details.

### PDF ingestion spike

- [ ] M1.8 PDF downloader bouwen met timeout, redirect limit, MIME check en max-size check.
- [ ] M1.9 Downloader testen met Wingspan Dropbox/folder scenario.
- [ ] M1.10 Downloader testen met Frutticola direct PDF.
- [ ] M1.11 Downloader testen met SUMO mirror PDF.
- [ ] M1.12 Downloader failure cases loggen: 403, non-PDF response, te groot bestand.
- [ ] M1.13 Text extraction spike bouwen met `pdfplumber`/`pypdf`.
- [ ] M1.14 OCR fallback spike bouwen voor image-only PDFs.
- [ ] M1.15 Viticulture OCR test uitvoeren.
- [ ] M1.16 UTF-8 test uitvoeren voor speciale tekens zoals `Dohyo`/`Dohyō`.

### Retrieval proof

- [ ] M1.17 Page-level chunking prototype bouwen.
- [ ] M1.18 Chunk metadata valideren: rulebook, page_start, page_end, source_url.
- [ ] M1.19 Full-text retrieval prototype bouwen.
- [ ] M1.20 Vector retrieval prototype bouwen.
- [ ] M1.21 Hybrid merge/rerank prototype bouwen.
- [ ] M1.22 Proof maken dat een antwoord een correcte PDF-pagina kan openen.

## M2 - Backend MVP

### Database en storage

- [ ] M2.1 Lokaal database schema ontwerpen met migratiepad naar Convex.
- [ ] M2.2 `games` tabel implementeren.
- [ ] M2.3 `rulebook_sources` tabel implementeren.
- [ ] M2.4 `rulebooks` tabel implementeren.
- [ ] M2.5 `rulebook_pages` tabel implementeren.
- [ ] M2.6 `rulebook_chunks` tabel implementeren.
- [ ] M2.7 `chunk_embeddings` tabel/vector index implementeren.
- [ ] M2.8 `questions` en `question_citations` tabellen implementeren.
- [ ] M2.9 Lokale filesystem storage configureren voor raw PDFs en page images.
- [ ] M2.9a Repository/storage interfaces ontwerpen zodat later Convex/cloud storage mogelijk blijft.

### Convex migratie

- [x] M2.C1 Hybride Convex/Next.js/Python-architectuur vastleggen.
- [x] M2.C2 Next.js/Convex-projectbasis en Clerk-authenticatie met Convex-tokenvalidatie configureren.
- [x] M2.C3 Convex-schema, indexen en gebruikersautorisatie implementeren.
- [x] M2.C4 Beveiligde ingestion-jobinterface en Python-workeradapter implementeren.
- [x] M2.C5 Idempotente import voor lokale state, chats, citaties en chunks implementeren.
- [x] M2.C6 Bibliotheek-, setup- en chatschermen naar Next.js porten.
- [ ] M2.C7 PDF's naar Convex Storage migreren en vector search activeren. (Schema, uploadpad en vectorzoekcode zijn gereed; bestaande PDF's en embeddings worden pas na de cloudkoppeling gemigreerd.)
- [ ] M2.C8 Cloud-developmentdeployment aan een blijvend Convex-account koppelen.
- [ ] M2.C9 Vercel-frontend en afzonderlijke Python-worker deployen.

### Services

- [ ] M2.10 `bgg-service` implementeren.
- [ ] M2.11 `discovery-service` implementeren.
- [ ] M2.12 Rulebook candidate scoring implementeren.
- [ ] M2.13 Manual review trigger implementeren bij lage confidence.
- [ ] M2.14 `ingestion-worker` implementeren.
- [ ] M2.15 OCR fallback integreren in ingestion worker.
- [ ] M2.16 Chunking en indexing integreren in ingestion worker.
- [ ] M2.17 `retrieval-service` implementeren.
- [ ] M2.18 `qa-service` implementeren met strict citations schema.
- [ ] M2.19 Antwoordvalidatie implementeren: geen citatie betekent reject/retry/not-found.
- [ ] M2.20 Takedown/removal flow op backendniveau implementeren.

### Security en betrouwbaarheid

- [ ] M2.21 Secrets alleen server-side beschikbaar maken.
- [ ] M2.22 Admin endpoints beschermen met auth.
- [ ] M2.23 Download SSRF-bescherming toevoegen voor lokale/private IP ranges.
- [ ] M2.24 Job retries idempotent maken op file hash/source URL.
- [ ] M2.25 Logging toevoegen voor discovery, ingestion, retrieval en QA.

## M3 - Frontend MVP

### User-facing UI

- [ ] M3.1 Game search page bouwen.
- [ ] M3.2 BGG resultaatkaart maken met titel, jaar, type, publisher en BGG link.
- [ ] M3.3 Game selection flow bouwen.
- [ ] M3.4 Rulebook discovery/status page bouwen.
- [ ] M3.5 Ingestion status states tonen: queued, downloading, extracting, OCR, indexing, ready, failed, review required.
- [ ] M3.6 Chat page bouwen.
- [ ] M3.7 Antwoordcomponent bouwen met paginacitaties.
- [ ] M3.8 Not-found antwoordstate ontwerpen en implementeren.
- [ ] M3.9 PDF viewer of PDF page opener integreren.
- [ ] M3.10 "Bekijk passage" actie koppelen aan page citation.
- [ ] M3.11 UI toont altijd geselecteerd spel en geladen rulebook-editie.

### Admin UI

- [ ] M3.12 Admin review queue bouwen.
- [ ] M3.13 Candidate detail view bouwen.
- [ ] M3.14 Confidence signals tonen.
- [ ] M3.15 PDF/extractie preview tonen.
- [ ] M3.16 Approve/reject/legal uncertain acties implementeren.
- [ ] M3.17 Admin decisions loggen en zichtbaar maken.

## M4 - Evaluation en QA

### Eval suite

- [ ] M4.1 Eval dataset ontwerpen met 10 vragen per testgame.
- [ ] M4.2 Wingspan evalvragen schrijven.
- [ ] M4.3 Viticulture evalvragen schrijven.
- [ ] M4.4 Frutticola evalvragen schrijven.
- [ ] M4.5 SUMO evalvragen schrijven.
- [ ] M4.6 Not-found vragen toevoegen per spel.
- [ ] M4.7 Eval runner bouwen.
- [ ] M4.8 Citation correctness scoring implementeren.
- [ ] M4.9 Refusal/not-found correctness scoring implementeren.

### Acceptance tests

- [ ] M4.10 Test dat geen antwoord zonder citatie wordt toegelaten.
- [ ] M4.11 Test dat verkeerde editie/expansion niet automatisch gekozen wordt.
- [ ] M4.12 Test dat image-only PDF OCR activeert.
- [ ] M4.13 Test dat te grote folder/zip download wordt geblokkeerd of gereviewd.
- [ ] M4.14 Test dat PDF viewer juiste pagina opent.
- [ ] M4.15 Test dat BGG API failure retrybare status toont.
- [ ] M4.16 Test dat admin-rejected source niet opnieuw automatisch gekozen wordt.

### Launch criteria

- [ ] M4.17 Minimaal 90% correcte antwoorden met correcte citaties op answerable evalvragen.
- [ ] M4.18 Minimaal 95% correcte not-found behavior op unanswerable evalvragen.
- [ ] M4.19 0 toegelaten antwoorden zonder citatie.
- [ ] M4.20 Private beta checklist afronden.

## M5 - Private beta voorbereiding

- [ ] M5.1 Private beta catalogus bepalen.
- [ ] M5.2 Legal/source status per beta-rulebook vastleggen.
- [ ] M5.3 Feedbackmechanisme toevoegen voor fout antwoord of foutieve citatie.
- [ ] M5.4 Admin procedure voor gemelde fouten definiëren.
- [ ] M5.5 Monitoring dashboard maken voor latency, failures, not-found rate en citation issues.
- [ ] M5.6 Privacy policy en terms draft maken.
- [ ] M5.7 BGG CSV/API attribution/licentievereisten verwerken in UI/documentatie.
- [ ] M5.8 Private beta release notes schrijven.

## Open decisions

- [x] D1 UI-taal kiezen: Engels.
- [x] D2 Definitieve modelprovider kiezen voor MVP: OpenAI for local MVP tests.
- [ ] D3 OCR-provider kiezen: Tesseract, cloud OCR of hybride.
- [x] D4 Hosting/infra kiezen: lokaal voor MVP, later Vercel.
- [ ] D5 Juridische aanpak kiezen voor rulebook opslag.
- [ ] D6 Confidence threshold bepalen voor automatische ingestion.
- [ ] D7 Max PDF/folder download size bepalen.
- [ ] D8 Beslissen of user-uploaded PDFs in MVP worden toegestaan.
- [x] D9 Database richting kiezen: lokaal eerst, Convex migratiepad openhouden.
- [x] D10 Tijdelijke game catalogus kiezen: lokale BGG CSV dump.

## Known risks to track

- [ ] R1 BGG API approval/licentie vertraagt of blokkeert launch.
- [ ] R2 Publisher/legal rechten voor rulebook verwerking zijn onvoldoende duidelijk.
- [ ] R3 Rulebook discovery kiest verkeerde editie of expansion.
- [ ] R4 OCR kwaliteit is onvoldoende voor betrouwbare antwoorden.
- [ ] R5 Model hallucineert ondanks retrieval constraints.
- [ ] R6 Citation verwijst naar verkeerde pagina.
- [ ] R7 File Search/storage/modelkosten worden te hoog bij catalogusgroei.
- [ ] R8 Mirrors verdwijnen of veranderen inhoud.

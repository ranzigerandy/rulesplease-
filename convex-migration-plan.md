# Rules Please! - Convex migration memory

Laatste update: 2026-07-15

## Besluit

Rules Please! migreert gefaseerd naar een hybride architectuur:

- Convex is de centrale database, realtime-laag, autorisatielaag, vectorzoeklaag en later bestandsopslag; Clerk beheert accounts en sessies.
- Next.js App Router in `web/` wordt de Vercel-klare frontend.
- Python blijft verantwoordelijk voor rulebook-discovery, downloaden, PDF-extractie en OCR.
- De bestaande lokale JSON-, PDF- en indexbestanden blijven tijdens de migratie onaangeroerd als rollback.

## Migratievolgorde

1. Convex-schema, Clerk-tokenvalidatie, functies en beveiligde worker-HTTP-routes.
2. Idempotente import van de bestaande lokale state en indexen.
3. Reactieve Next.js-schermen voor bibliotheek, verwerkingstatus en chat.
4. Python omschakelen van lokale state-schrijver naar Convex job-worker.
5. PDF's naar Convex Storage en chunks/embeddings naar Convex vector search.
6. Next.js naar Vercel en Python naar een afzonderlijke workeromgeving.
7. Oude opslag pas verwijderen nadat rollback en volledige end-to-end flow zijn geverifieerd.

## Vaste grenzen

- De volledige BGG CSV blijft voorlopig lokaal; alleen geselecteerde spellen gaan naar Convex.
- Iedere persoonlijke query en mutatie controleert de ingelogde gebruiker server-side.
- Worker-routes vereisen `RULES_PLEASE_WORKER_SECRET` en gebruiken leases en idempotency-keys.
- Permanente records bewaren Convex Storage-ID's, nooit tijdelijke download-URL's.
- Een inhoudelijk antwoord zonder geldige rulebook-citatie wordt niet als betrouwbaar antwoord opgeslagen.

## Deploymentstatus

Er is op deze machine nog geen Convex-login of gekoppelde deployment gevonden. De code kan lokaal worden gebouwd en met een tijdelijke anonieme backend worden getest, maar een blijvende cloud-developmentdeployment vereist eerst `npx convex login` in `web/`.

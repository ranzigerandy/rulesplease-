# Rules Please! — Google Play-launchchecklist (persoonlijk account)

Deze checklist is de actuele werkbron voor de Android-lancering. We vinken alleen iets af wanneer het effectief is uitgevoerd of aantoonbaar is bevestigd.

## Gekozen route

- [x] Publiceren via een persoonlijk Google Play Console-account gekozen — 2026-09-01
- [x] D-U-N-S en een organisatie-Payments-profiel zijn niet nodig voor deze Google Play-route
- [x] Persoonlijk Play Console-account is volledig geregistreerd en geverifieerd — bevestigd op 2026-09-01

## Voortgangslog

| Datum | Stap | Status | Bewijs / opmerking |
| --- | --- | --- | --- |
| 2026-09-01 | Persoonlijke Google Play-route gekozen | Klaar | Geen organisatieconversie nodig voor Android-publicatie. |
| 2026-09-01 | Accounttype, contact-e-mail en telefoon gecontroleerd | Klaar | Screenshot van Developer account ontvangen; accounttype is Personal en beide contactmethoden hebben een groene verificatiestatus. |
| 2026-09-01 | Geen openstaande Play Console-verificatietaken | Klaar | Bevestigd door accounteigenaar. |
| 2026-09-01 | Tweestapsverificatie voor eigenaar actief | Klaar | Bevestigd door accounteigenaar. |
| 2026-09-01 | Herstelmailadres, hersteltelefoon en back-upcodes ingesteld | Klaar | Bevestigd door accounteigenaar; codes zijn niet gedeeld. |
| 2026-09-01 | Publiek Rules Please-supportadres ingesteld | Klaar | Bevestigd door accounteigenaar. |
| 2026-09-01 | Tweede Play Console-beheerder toegevoegd | Klaar | Bevestigd door accounteigenaar. |
| 2026-09-01 | EAS-productionkeystore geïnspecteerd | Klaar | De SHA-256-vingerafdruk voor `com.rulesplease.app` is uit de bestaande EAS-keystore opgehaald. |
| 2026-09-01 | Android-verificatie-APK gebouwd | Klaar | EAS build `b3aa579f-1b83-4faf-a50f-f57558ff046d` is voltooid met de production-keystore. |
| 2026-09-01 | Package-nameverificatie afgerond | Klaar | `com.rulesplease.app` en de EAS-production signing key zijn door Google geverifieerd. |
| 2026-09-01 | Google Play-app aangemaakt | Klaar | Rules Please!-app bestaat in Play Console. |
| 2026-09-01 | Productievoorwaarde voor persoonlijk account bevestigd | Klaar | Dashboard vereist een gesloten test met minimaal 12 testers gedurende minimaal 14 dagen. |
| 2026-09-01 | Website-/privacy-URL-blocker vastgesteld | Opgelost op 2026-09-04 | `rulesplease.com`, `www` en `app` wijzen weer naar Vercel; `https://rulesplease.com/privacy` geeft HTTP 200. |
| 2026-09-01 | DNS-beheer bij Vimexx losgekoppeld van hostingpakket | Onderzoek nodig | Controleer eerst in DirectAdmin of de domein- en mailconfiguratie nog aanwezig is; voer geen DNS-reset uit. |
| 2026-09-01 | DirectAdmin mail-DNS gecontroleerd | Klaar | De oorspronkelijke zone is intact in DirectAdmin: MX, `smtp`/`pop`, DKIM, SPF en mailhosts zijn aanwezig. Herkoppel het domein aan ditzelfde hostingpakket om deze zone weer actief te maken. |
| 2026-09-01 | Vimexx-domein opnieuw gekoppeld aan het juiste hostingpakket | Klaar | Klantenpaneel bevestigt dat DNS weer door het hostingpakket wordt beheerd; mailzone is weer actief. |
| 2026-09-01 | Vercel-webrecords ingevoerd in DirectAdmin | Klaar op 2026-09-04 | Publieke DNS-resolutie bevestigt `@ → 76.76.21.21` en `www`/`app → cname.vercel-dns.com`. |
| 2026-09-01 | DirectAdmin domein en bestaande mailboxen gecontroleerd | Klaar | `rulesplease.com`, `feedback@rulesplease.com` en `info@rulesplease.com` bestaan nog; `support@rulesplease.com` ontbreekt en moet opnieuw worden aangemaakt. |
| 2026-09-01 | `support@rulesplease.com` opnieuw aangemaakt | Klaar | Mailbox zichtbaar en niet geschorst in DirectAdmin. |
| 2026-09-01 | Privacybeleid in dezelfde stijl als de landingspagina gepubliceerd | Klaar | Productiedeployment bevat `/privacy`; rechtstreeks op de publieke URL gecontroleerd met HTTP 200 op 2026-09-04. |
| 2026-09-04 | Privacy policy ingesteld in Google Play Console | Klaar | `https://rulesplease.com/privacy` is als privacybeleid opgeslagen. |
| 2026-09-04 | Vast Google Play-revieweraccount ingericht | Klaar | Aparte e-mail/wachtwoordaccount gemaakt; credentials worden uitsluitend in Play Console bewaard. |
| 2026-09-04 | App access en advertentieverklaring ingesteld | Klaar | Reviewercredentials en Engelstalige teststappen zijn opgeslagen; advertenties zijn als afwezig verklaard. |
| 2026-09-04 | Contentclassificatie ingevuld | Klaar | Volledige vragenlijst is afgerond; app bevat geen classificatierelevante inhoud die met het app-pakket wordt gedownload. |
| 2026-09-04 | Doelgroep ingesteld | Klaar | Alleen 13–15, 16–17 en 18+ geselecteerd; geen leeftijdsgroepen jonger dan 13. |
| 2026-09-04 | Publiek account-deletionformulier gebouwd | Klaar, e-mailtest open | `/delete-account` bevat een Engelstalig formulier naar `support@rulesplease.com`; verzending gebruikt server-side Resend-variabelen en moet na deployment met één echte test worden bevestigd. |

## 1. Persoonlijk Play Console-account beveiligen

- [ ] Open [Google Play Console](https://play.google.com/console/signup) met het Google-account dat de app duurzaam zal beheren.
- [ ] Betaal de eenmalige registratiekost als Google die nog vraagt.
- [x] Ga naar **Developer account → About you** en bevestig dat het accounttype **Personal** is — bevestigd op 2026-09-01.
- [x] Rond de gevraagde e-mail- en telefoonverificaties af — bevestigd op 2026-09-01.
- [x] Bevestig op het Play Console-dashboard dat er geen openstaande identiteits- of adresverificatie meer is — bevestigd op 2026-09-01.
- [x] Activeer tweestapsverificatie voor het eigenaar-Google-account — bevestigd op 2026-09-01.
- [x] Stel herstelmailadres, hersteltelefoon en back-upcodes in en bewaar die veilig — bevestigd op 2026-09-01.
- [x] Maak een publieke supportmail, `support@rulesplease.com` — opnieuw aangemaakt op 2026-09-01.
- [ ] Verifieer dat `support@rulesplease.com` extern mail kan ontvangen en versturen nadat de DNS-zone is hersteld.
- [x] Voeg onder **Users and permissions** minstens één vertrouwde tweede beheerder toe met tweestapsverificatie — bevestigd op 2026-09-01.
- [ ] Noteer privé wie toegang heeft, welk Google-account eigenaar is en welke recoverygegevens bestaan.

> Een persoonlijk account mag een commerciële app publiceren. Controleer vóór indiening in Play Console welke contactgegevens Google publiek zal tonen voor dit accounttype.

## 2. Vereisten voor nieuwe persoonlijke accounts

- [ ] Lees de taken op het Play Console-dashboard voor nieuwe persoonlijke accounts.
- [ ] Rond Android-apparaatverificatie af als het dashboard die vraagt.
- [x] Haal de SHA-256-vingerafdruk van de bestaande EAS-productionkeystore op voor `com.rulesplease.app` — bevestigd op 2026-09-01.
- [x] Registreer die SHA-256-vingerafdruk in **Verificatie van Android-ontwikkelaars** en wacht op Google-bevestiging — geverifieerd op 2026-09-01.
- [x] Plan closed testing met minstens 12 testers die minimaal 14 dagen deelnemen — bevestigd door het Play Console-dashboard op 2026-09-01.
- [ ] Bewaar de testergroep en uitnodigingslink; testers moeten de app effectief installeren en gebruiken.

## 3. Productieomgeving controleren

- [ ] Bevestig in Convex dat productie `dependable-fennec-742` is.
- [ ] Bevestig dat Railway naar dezelfde productie-Convex-deployment wijst.
- [ ] Bevestig dat web, mobiele productiebuild en Railway niet naar verschillende Convex-omgevingen wijzen.
- [ ] Controleer `EXPO_PUBLIC_CONVEX_URL=https://dependable-fennec-742.convex.cloud` in de mobiele productieconfiguratie.
- [ ] Controleer productie-Clerk publishable key, EAS-project-ID en catalogus-URL.
- [ ] Houd OpenAI-, Clerk-secret- en workerkeys uitsluitend server-side; alleen `EXPO_PUBLIC_*` mag in de mobiele build.
- [x] Richt een regulier revieweraccount met e-mail en wachtwoord in, met een vooraf geladen voorbeeldrulebook en voorbeeldchat — bevestigd op 2026-09-04.
- [ ] Test in productie: registratie/login, AI-consent, zoeken, PDF-upload, Railway-verwerking, vraag, citaat openen en accountverwijdering.

## 4. App aanmaken in Google Play Console

- [x] Ga naar **All apps → Create app** — aangemaakt op 2026-09-01.
- [x] App name: `Rules Please!`.
- [x] Default language: **English (United States)**.
- [x] Kies **App** en **Free**.
- [x] Bevestig dat versie 1.0 geen advertenties, abonnementen, in-app aankopen of externe betaalroute bevat.
- [x] Controleer na creatie dat de package name exact `com.rulesplease.app` is.
- [ ] Maak geen tweede Play-app met dezelfde package name.

## 5. Verplichte Play Console-informatie

- [x] **Privacy policy:** `https://rulesplease.com/privacy` — ingesteld in Play Console op 2026-09-04.
- [x] **App access:** login vereist; revieweraccount, wachtwoord en teststappen zijn ingesteld op 2026-09-04.
- [x] **Ads:** “No, my app does not contain ads” ingesteld op 2026-09-04.
- [x] **Content rating:** vragenlijst ingevuld voor 13+/Teen, generatieve AI, gebruikerscontent en rapportage — bevestigd op 2026-09-04.
- [x] **Target audience:** 13–15, 16–17 en 18+ geselecteerd; niet gericht op kinderen — bevestigd op 2026-09-04.
- [ ] **Data safety:** declareer uitsluitend data die de finale productiebuild werkelijk verwerkt: e-mail/account-ID, PDF's en links, vragen/chats/citaties, feedback/answer reports, eventuele push token/device-ID en feitelijk verzamelde diagnostiek.
- [ ] **Data safety:** verklaar geen advertenties en geen tracking, indien dat nog steeds klopt in de finale build.
- [ ] **Account deletion:** verwijs naar `https://app.rulesplease.com/delete-account` en controleer dat de in-app flow werkt.
- [ ] **Government apps, Financial features en News:** kies “No”, zolang de app inhoudelijk niet verandert.

## 6. Store listing en materiaal (Engels)

- [ ] Finaliseer naam: `Rules Please!`.
- [ ] Gebruik de korte beschrijving: `Ask board-game rules questions and check the exact cited rulebook page.`
- [ ] Finaliseer de volledige Engelse beschrijving in `store/google-play/en-US.md`.
- [ ] Maak een Play Store-icon: 512 × 512 px, PNG, geen transparantie en leesbaar op klein formaat.
- [ ] Maak een feature graphic: 1024 × 500 px, zonder misleidende claims.
- [ ] Maak minimaal vijf Android-telefoonscreenshots: recente chats, game zoeken, rulebook klaar, AI-antwoord met citaties en de originele PDF-pagina.
- [ ] Gebruik uitsluitend fictieve accountgegevens en een gecontroleerd voorbeeldspel in alle media.
- [ ] Controleer dat storetekst geen “beta”, “official”, “unlimited”, “perfect” of “foutloos” belooft.

## 7. Eerste Android-build

- [ ] Controleer dat de EAS-account die de build maakt duurzaam toegankelijk is voor eigenaar en back-upbeheerder.
- [ ] Controleer `mobile/eas.json` op het production-profiel.
- [ ] Bouw een Android App Bundle (AAB), geen APK: `cd mobile` gevolgd door `npx eas-cli build --platform android --profile production`.
- [ ] Controleer package `com.rulesplease.app`, version name `1.0.0`, een oplopende version code en productie-Convex/Clerk-configuratie.
- [ ] Controleer dat de build target SDK 36 gebruikt.
- [ ] Installeer de build op minstens twee Androidtoestellen vóór upload naar Play Console.

## 8. Internal testing

- [ ] Maak **Testing → Internal testing** aan en upload de eerste AAB.
- [ ] Nodig jezelf en technische testers uit.
- [ ] Test registratie/login, AI-consent, PDF-upload, Railway-verwerking, AI-vraag, citations, PDF-pagina openen, push toestaan/weigeren, logout, accountverwijdering, herinstallatie en sessieherstel.
- [ ] Los elke P0/P1-fout op vóór closed testing.

## 9. Closed testing

- [ ] Maak een closed-testtrack en nodig de geplande testers uit.
- [ ] Houd de test actief gedurende de termijn die Google voor dit persoonlijke account oplegt (plan: 12 testers / 14 dagen).
- [ ] Laat testers Google-login, e-mailcode, reviewerlogin, zoeken, eigen PDF, foutieve PDF, trage verwerking, citations, report answer, accountverwijdering en zwak netwerk testen.
- [ ] Controleer dagelijks Android Vitals, Clerk-loginfouten, Convex errors, Railway-health/retries/jobduur, supportmail en AI-meldingen.
- [ ] Houd een P0/P1-lijst bij en sluit elk blocker-ticket voor de release candidate.

## 10. Release candidate en productie

- [ ] Verhoog de Android version code en bouw een nieuwe production AAB.
- [ ] Herhaal de volledige productieflow en verifieer cross-user autorisatie, private PDF's, consent-intrekking, accountverwijdering en citations.
- [ ] Bevries storetekst, screenshots, privacy-antwoorden, reviewercredentials en release notes.
- [ ] Upload de finale AAB naar **Production → Create new release**.
- [ ] Voeg release notes toe en wacht op de Play pre-launch report.
- [ ] Kies **Managed publishing**.
- [ ] Dien de release in voor review.
- [ ] Na goedkeuring: 10% rollout, dan na minstens 24 uur zonder blocker 25%, 50% en 100%.
- [ ] Pauzeer bij native crashes, privacy-/autorisatieproblemen, loginproblemen of vastgelopen rulebookjobs.

## Bronnen en werkdocumenten

- [Google Play Console-signup](https://play.google.com/console/signup)
- [Google: Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [Google: Required developer-account information](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en)
- `store/google-play/en-US.md` — storemetadata
- `store/privacy-disclosures.md` — Data Safety-voorbereiding
- `store/review-notes.md` — reviewerinstructies
- `store/release-checklist.md` — overkoepelende Android/iOS-releasegate

## Werkwijze voor updates

Wanneer je een stap doorloopt, stuur je mij kort wat je ziet of een screenshot. Ik zet de stap op `[x]`, voeg datum en bewijs toe aan de voortgangslog en maak de eerstvolgende stap concreet. Niet-bevestigde stappen blijven bewust open.

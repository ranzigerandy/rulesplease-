# Rules Please! Android app

Native Expo/React Native client for the existing Clerk + Convex backend. The app is not a WebView wrapper.

## Local setup

1. Copy `.env.example` to `.env` and fill the public Clerk and EAS values. Keep the provided `tidy-heron-277` Convex URL while the PC worker is used: it is the same shared deployment as the web app. Never add OpenAI, Clerk secret, or worker keys.
2. From the repository root, run `npm install`.
3. Run `npm run dev:mobile`. Because PDF rendering and notifications use native modules, use an Expo development build rather than Expo Go.

## Validation

```powershell
npm run lint --workspace @rulesplease/mobile
npm run typecheck --workspace @rulesplease/mobile
npm run test --workspace @rulesplease/mobile
cd mobile
npx expo-doctor
npx expo prebuild --platform android --no-install
```

Maestro scenarios live in `.maestro/`. Supply `TEST_EMAIL` and `TEST_EMAIL_CODE` from a dedicated Clerk test account.

## EAS builds

```powershell
cd mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile development
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

The profiles generate a development APK, QA APK, and signed Play Store AAB. `com.rulesplease.app` and the `rulesplease://` scheme are fixed in `app.json`.

## Release checklist

- Configure Clerk's Convex JWT template and Google OAuth redirect for `rulesplease://`.
- Set all `EXPO_PUBLIC_*` variables in EAS for preview and production.
- For the current test phase, run `scripts/start-convex-worker.ps1` on the PC and verify `/health`. The Railway configuration is retained for the later hosted-worker migration.
- Run the Maestro flows on at least two physical Android phones and a tablet-sized emulator.
- Complete Play Data Safety: account identifiers, user-provided PDFs, app interactions, diagnostics and push tokens are processed for app functionality. PDF text and image-only pages can be sent to OpenAI for embeddings/OCR/answers; Convex stores account data and documents; Railway performs ingestion; Expo delivers push notifications.
- Publish first to Google Play Internal Testing. Block release on crashes, cross-user access, lost uploads, missing citations or stuck jobs.

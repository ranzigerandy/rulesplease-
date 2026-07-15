# Rules Please! web

Next.js App Router frontend, Clerk account management, and Convex backend for the Rules Please! rulebook assistant. The Python code in the repository root remains the ingestion worker and local rollback application.

## One-time setup

```powershell
npm install
npm install -g clerk
clerk auth login
clerk init --app app_3GXJcBWyBHgAtOs8JGz9ewnLqu8 --yes --no-skills
clerk env pull --app app_3GXJcBWyBHgAtOs8JGz9ewnLqu8 --instance dev
npx convex login
npm run convex:check
```

Copy the non-secret values from `.env.example` to `.env.local`. Generate strong worker and migration secrets, then set the server copies on Convex:

```powershell
npx convex env set RULES_PLEASE_WORKER_SECRET "<secret>"
npx convex env set RULES_PLEASE_MIGRATION_SECRET "<secret>"
npx convex env set OPENAI_API_KEY "<key>"
npx convex env set CLERK_FRONTEND_API_URL "https://model-termite-83.clerk.accounts.dev"
```

The Convex CLI writes the deployment URL to `.env.local`. Ensure the browser-facing value is named `NEXT_PUBLIC_CONVEX_URL`; the worker uses the corresponding `.convex.site` URL as `CONVEX_SITE_URL`.

The Clerk Frontend API proxy is optional. Leave `NEXT_PUBLIC_CLERK_PROXY_URL` unset for local development. When enabling the proxy on a deployed domain, set it to the absolute same-origin `/__clerk/` URL.

## Development

Run the legacy Python catalogue in one terminal:

```powershell
../start-local.ps1
```

Run Next.js and Convex in another:

```powershell
npm run dev
```

Run the worker from the repository root after setting `CONVEX_SITE_URL`, `RULES_PLEASE_WORKER_SECRET`, and `OPENAI_API_KEY`:

```powershell
python convex_worker.py
```

## Import existing local data

Create the owner in Clerk first and copy its `user_...` ID from the Clerk dashboard. Preview the migration, then run it:

```powershell
npm run import:local -- --owner-id user_... --dry-run
npm run import:local -- --owner-id user_...
```

The importer is idempotent and leaves `data/state.json`, PDFs, and local indexes untouched.

## Rollback

Set `NEXT_PUBLIC_RULES_BACKEND=local` and restart Next.js. The product page will route users to the unchanged Python application. Convex data is not deleted.

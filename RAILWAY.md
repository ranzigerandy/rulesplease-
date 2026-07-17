# Rules Please worker on Railway

Create one service from this repository and set these service variables:

- `CONVEX_SITE_URL`: the Convex HTTP actions URL (`https://<deployment>.convex.site`).
- `RULES_PLEASE_WORKER_SECRET`: exactly the same secret configured in Convex.
- `OPENAI_API_KEY`: used for embeddings and OCR.
- `RULES_PLEASE_UPLOAD_PDFS=1`.
- Optional model overrides: `OPENAI_EMBEDDING_MODEL`, `OPENAI_OCR_MODEL`, `OPENAI_ANSWER_MODEL`.

Railway builds the root `Dockerfile`, checks `/health`, restarts failed processes, and receives JSON logs for every claimed, completed, failed, or approval-waiting job. Keep `start_convex_worker.ps1` for local development only.

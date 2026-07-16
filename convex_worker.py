"""Lease-based Convex ingestion worker for Rules Please!.

The existing app_server module remains the source for discovery, downloading,
PDF extraction, chunking, and embeddings. This adapter only changes where job
state and processed chunks are stored.
"""

import argparse
import hashlib
import json
import os
import socket
import time
import urllib.error
import urllib.request

import app_server


LEASE_MS = 300_000


class RulebookIdentityReviewRequired(ValueError):
    pass


class WorkerApi:
    def __init__(self):
        self.site_url = os.environ.get("CONVEX_SITE_URL", "").rstrip("/")
        self.secret = os.environ.get("RULES_PLEASE_WORKER_SECRET", "")
        if not self.site_url or not self.secret:
            raise ValueError("CONVEX_SITE_URL and RULES_PLEASE_WORKER_SECRET are required")

    def post(self, path, payload):
        data = json.dumps(_without_none(payload)).encode("utf-8")
        request = urllib.request.Request(
            f"{self.site_url}{path}",
            data=data,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.secret}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Convex worker endpoint failed ({exc.code}): {detail[:500]}") from exc
        if isinstance(result, dict) and result.get("error"):
            raise RuntimeError(result["error"])
        return result

    def upload_pdf(self, pdf_path):
        upload_url = self.post("/worker/rulebooks/upload-url", {})["uploadUrl"]
        request = urllib.request.Request(
            upload_url,
            data=pdf_path.read_bytes(),
            method="POST",
            headers={"Content-Type": "application/pdf"},
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))["storageId"]


def _without_none(value):
    if isinstance(value, dict):
        return {key: _without_none(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [_without_none(item) for item in value]
    return value


def _source_candidates(game):
    known = app_server.RULEBOOK_SOURCES.get(game["id"])
    candidates = [known] if known else []
    candidates.extend(app_server.discover_rulebook_candidates(game))
    seen = set()
    for candidate in candidates:
        if not candidate or candidate["url"] in seen:
            continue
        seen.add(candidate["url"])
        yield candidate


def _heartbeat(api, job, phase, progress, message):
    api.post(
        "/worker/jobs/heartbeat",
        {
            "jobId": job["_id"],
            "leaseToken": job["leaseToken"],
            "phase": phase,
            "progress": progress,
            "statusMessage": message,
            "leaseMs": LEASE_MS,
        },
    )


def process_claim(api, claim):
    job = claim["job"]
    convex_game = claim["game"]
    bgg_id = int(convex_game["bggId"])
    game = app_server.GAMES_BY_ID.get(bgg_id) or {
        "id": bgg_id,
        "name": convex_game["name"],
        "year": convex_game.get("year"),
    }
    selected_source = None
    pdf_path = None
    pages = None
    last_error = None
    review_reasons = []
    review_candidate = None

    _heartbeat(api, job, "searching_rulebook", 8, "Looking for a matching English rulebook.")
    for candidate in _source_candidates(game):
        try:
            _heartbeat(
                api,
                job,
                "downloading_rulebook",
                30,
                f"Trying rulebook source: {candidate['url']}",
            )
            pdf_path = app_server.download_pdf(
                candidate,
                game,
                progress=lambda percent, message: _heartbeat(
                    api, job, "downloading_rulebook", percent, message
                ),
            )
            pages = app_server.extract_pages(
                pdf_path,
                progress=lambda percent, message: _heartbeat(
                    api, job, "extracting", max(45, min(70, percent)), message
                ),
            )
            identity = app_server.validate_rulebook_identity(game, candidate, pages)
            if not identity["approved"]:
                last_error = ValueError(identity["reason"])
                if identity["reviewRequired"]:
                    review_reasons.append(identity["reason"])
                    if review_candidate is None:
                        review_candidate = (
                            {
                                **candidate,
                                "edition": identity["edition"],
                                "confidence": identity["confidence"],
                            },
                            pdf_path,
                            pages,
                        )
                continue
            selected_source = {
                **candidate,
                "edition": identity["edition"],
                "confidence": identity["confidence"],
            }
            break
        except Exception as exc:  # continue through ranked candidates
            last_error = exc

    if not selected_source and review_candidate:
        selected_source, pdf_path, pages = review_candidate

    if not selected_source or not pdf_path or not pages:
        if review_reasons:
            raise RulebookIdentityReviewRequired(review_reasons[0])
        raise ValueError(f"No usable rulebook source found: {last_error or 'no candidates'}")

    api.post(
        "/worker/jobs/prepare",
        {
            "jobId": job["_id"],
            "leaseToken": job["leaseToken"],
            "source": {
                "url": selected_source["url"],
                "label": selected_source.get("label", f"{game['name']} rulebook"),
                "language": "en",
                "edition": selected_source.get("edition", "base game"),
                "confidence": selected_source.get("confidence", "auto"),
                "reviewStatus": "approved",
            },
        },
    )
    _heartbeat(api, job, "extracting", 72, "Rulebook identity verified. Building searchable pages.")
    chunks = app_server.chunk_pages(pages, selected_source)
    _heartbeat(api, job, "embedding", 92, "Creating semantic-search embeddings.")
    app_server.add_embeddings_to_chunks(
        chunks,
        progress=lambda percent, message: _heartbeat(api, job, "embedding", percent, message),
    )

    for offset in range(0, len(chunks), 25):
        batch = []
        for chunk in chunks[offset:offset + 25]:
            checksum = hashlib.sha256(
                f"{chunk['page']}\n{chunk['text']}".encode("utf-8")
            ).hexdigest()
            batch.append({**chunk, "checksum": checksum})
        api.post(
            "/worker/jobs/chunks",
            {
                "jobId": job["_id"],
                "leaseToken": job["leaseToken"],
                "chunks": batch,
            },
        )

    storage_id = None
    if os.environ.get("RULES_PLEASE_UPLOAD_PDFS") == "1":
        storage_id = api.upload_pdf(pdf_path)
    api.post(
        "/worker/jobs/complete",
        {
            "jobId": job["_id"],
            "leaseToken": job["leaseToken"],
            "result": {
                "pageCount": len(pages),
                "chunkCount": len(chunks),
                "extractedChars": sum(len(page["text"]) for page in pages),
                "embeddingModel": app_server.EMBEDDING_MODEL,
                "documentHash": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
                "localFileName": pdf_path.name,
                "storageId": storage_id,
            },
        },
    )
    print(f"Completed BGG {bgg_id}: {len(pages)} pages, {len(chunks)} chunks")


def main():
    parser = argparse.ArgumentParser(description="Run the Rules Please Convex worker")
    parser.add_argument("--once", action="store_true", help="Claim at most one job")
    parser.add_argument("--poll-seconds", type=float, default=3.0)
    args = parser.parse_args()

    app_server.ensure_dirs()
    app_server.load_catalog()
    api = WorkerApi()
    worker_id = os.environ.get("RULES_PLEASE_WORKER_ID", socket.gethostname())
    while True:
        claim = api.post(
            "/worker/jobs/claim",
            {"workerId": worker_id, "leaseMs": LEASE_MS},
        )
        if claim:
            job = claim["job"]
            try:
                process_claim(api, claim)
            except Exception as exc:
                review_required = isinstance(exc, RulebookIdentityReviewRequired) or "OCR" in str(exc)
                try:
                    api.post(
                        "/worker/jobs/fail",
                        {
                            "jobId": job["_id"],
                            "leaseToken": job["leaseToken"],
                            "error": str(exc),
                            "reviewRequired": review_required,
                        },
                    )
                finally:
                    print(f"Failed job {job['_id']}: {exc}")
        if args.once:
            return
        time.sleep(max(0.5, args.poll_seconds))


if __name__ == "__main__":
    main()

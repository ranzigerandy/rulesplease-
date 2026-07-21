"""Lease-based Convex ingestion worker for Rules Please!.

The existing app_server module remains the source for discovery, downloading,
PDF extraction, chunking, and embeddings. This adapter only changes where job
state and processed chunks are stored.
"""

import argparse
import hashlib
import json
import os
import re
import socket
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

import app_server


LEASE_MS = 300_000
HEALTH = {"status": "starting", "workerId": None, "lastJobAt": None, "lastError": None}


def log_event(event, **fields):
    print(json.dumps({"timestamp": time.time(), "event": event, **fields}, default=str), flush=True)


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_response(404)
            self.end_headers()
            return
        payload = json.dumps(HEALTH).encode("utf-8")
        self.send_response(200 if HEALTH["status"] in {"ready", "processing"} else 503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, _format, *_args):
        return


def start_health_server():
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), HealthHandler)
    Thread(target=server.serve_forever, name="health-server", daemon=True).start()
    log_event("health_server_started", port=port)


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

    def upload_file(self, file_path, content_type):
        upload_url = self.post("/worker/rulebooks/upload-url", {})["uploadUrl"]
        request = urllib.request.Request(
            upload_url,
            data=file_path.read_bytes(),
            method="POST",
            headers={"Content-Type": content_type},
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))["storageId"]

    def upload_pdf(self, pdf_path):
        return self.upload_file(pdf_path, "application/pdf")


def _without_none(value):
    if isinstance(value, dict):
        return {key: _without_none(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [_without_none(item) for item in value]
    return value


def _source_candidates(game, manual_source=None, excluded_urls=None):
    excluded_urls = set(excluded_urls or [])
    if manual_source:
        if manual_source["url"] not in excluded_urls:
            yield manual_source
        return
    known = app_server.RULEBOOK_SOURCES.get(game["id"])
    candidates = [known] if known else []
    candidates.extend(app_server.discover_rulebook_candidates(game))
    seen = set()
    for candidate in candidates:
        if not candidate or candidate["url"] in seen or candidate["url"] in excluded_urls:
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


def _preview_metadata(pdf_path, game, candidate):
    """Read only the opening pages needed for identity review, not the full book."""
    from pypdf import PdfReader

    reader = PdfReader(str(pdf_path))
    page_count = len(reader.pages)
    first_pages = []
    for index, page in enumerate(reader.pages[:3], start=1):
        first_pages.append({"page": index, "text": app_server.clean_text(page.extract_text() or "")})
    identity = app_server.validate_rulebook_identity(game, candidate, first_pages)
    document_hash = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    filename = pdf_path.name
    revision_match = re.search(r"(?:rev(?:ision)?|ver(?:sion)?|v)[-_ .]*(\d+(?:\.\d+)*)", filename, re.I)
    return {
        "identity": identity,
        "documentHash": document_hash,
        "pageCount": page_count,
        "fileSize": pdf_path.stat().st_size,
        "contentType": "application/pdf",
        "revision": revision_match.group(1) if revision_match else candidate.get("revision"),
    }


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
    manual_source = claim.get("manualSource")
    approved_source = claim.get("approvedSource")

    if not approved_source:
        candidates = list(
            _source_candidates(game, manual_source, claim.get("rejectedSourceUrls"))
        )[:5]
        if not candidates:
            raise ValueError("We could not find a new rulebook candidate for this game.")

        rejected_hashes = set(claim.get("rejectedDocumentHashes") or [])
        fallback = None
        checked_errors = []
        for rank, candidate in enumerate(candidates, start=1):
            try:
                _heartbeat(
                    api,
                    job,
                    "searching_rulebook",
                    min(24, 5 + rank * 3),
                    f"Checking rulebook candidate {rank} of {len(candidates)}.",
                )
                candidate_path = app_server.download_pdf(
                    candidate,
                    game,
                    force=True,
                    require_public_https=bool(manual_source),
                )
                metadata = _preview_metadata(candidate_path, game, candidate)
                # A URL or file deliberately supplied by the player can have
                # an inconclusive title match (for example SCOUT). Keep that
                # fact on the source record, but do not reject the import.
                if manual_source and not metadata["identity"]["approved"]:
                    identity = metadata["identity"]
                    metadata["identity"] = {
                        **identity,
                        "reviewRequired": True,
                        "confidence": "manual_review",
                        "reason": (
                            "We could not verify this imported rulebook automatically. "
                            "Please check the preview, game, and edition before approving it."
                        ),
                    }
                # Rejected hashes prevent the automatic search from cycling
                # back to a source the player declined. An explicitly uploaded
                # file is a new deliberate choice, so it must always reach its
                # preview—even when it is the same document as a prior try.
                if not manual_source and metadata["documentHash"] in rejected_hashes:
                    checked_errors.append(f"Candidate {rank} was already rejected by you.")
                    continue
                preview = (candidate, candidate_path, metadata, rank)
                if metadata["identity"]["approved"]:
                    fallback = preview
                    break
                if metadata["identity"]["reviewRequired"] and fallback is None:
                    fallback = preview
                else:
                    checked_errors.append(metadata["identity"]["reason"])
            except Exception as exc:
                checked_errors.append(str(exc))

        if fallback is None:
            detail = checked_errors[-1] if checked_errors else "no candidate passed the identity check"
            raise ValueError(
                f"We checked {len(candidates)} rulebook candidate(s), but none was usable. {detail}"
            )

        preview_candidate, preview_path, metadata, candidate_rank = fallback
        identity = metadata["identity"]
        preview_storage_id = job.get("sourceStorageId")
        if not preview_storage_id and os.environ.get("RULES_PLEASE_UPLOAD_PDFS") == "1":
            preview_storage_id = api.upload_pdf(preview_path)
        prepared = api.post(
            "/worker/jobs/prepare",
            {
                "jobId": job["_id"],
                "leaseToken": job["leaseToken"],
                "source": {
                    "url": preview_candidate["url"],
                    "label": preview_candidate.get("label", f"{game['name']} rulebook"),
                    "language": preview_candidate.get("language", "en"),
                    "edition": identity.get("edition") or preview_candidate.get("edition", "base game"),
                    "revision": metadata.get("revision"),
                    "confidence": identity.get("confidence") or preview_candidate.get("confidence", "auto"),
                    # A manually chosen file or URL is the user's explicit
                    # source selection. Automatic discoveries still require
                    # the visual approval screen before indexing.
                    "reviewStatus": "approved" if manual_source else "review_required",
                    "documentHash": metadata["documentHash"],
                    "pageCount": metadata["pageCount"],
                    "fileSize": metadata["fileSize"],
                    "contentType": metadata["contentType"],
                    "candidateRank": candidate_rank,
                    "storageId": preview_storage_id,
                },
            },
        )
        if prepared.get("alreadyIndexed"):
            api.post(
                "/worker/jobs/reuse",
                {"jobId": job["_id"], "leaseToken": job["leaseToken"]},
            )
            log_event("rulebook_reused", bggId=bgg_id, jobId=job["_id"])
            return
        if prepared["needsApproval"]:
            api.post(
                "/worker/jobs/request-approval",
                {"jobId": job["_id"], "leaseToken": job["leaseToken"]},
            )
            log_event("approval_requested", bggId=bgg_id, jobId=job["_id"])
            return
        approved_source = {
            **preview_candidate,
            "edition": identity.get("edition") or preview_candidate.get("edition", "base game"),
            "confidence": identity.get("confidence") or preview_candidate.get("confidence", "auto"),
        }
        pdf_path = preview_path

    _heartbeat(
        api,
        job,
        "searching_rulebook",
        8,
        "Checking your imported rulebook." if manual_source else "Looking for a matching English rulebook.",
    )
    for candidate in [approved_source]:
        try:
            _heartbeat(
                api,
                job,
                "downloading_rulebook",
                30,
                f"Trying rulebook source: {candidate['url']}",
            )
            if pdf_path is None:
                pdf_path = app_server.download_pdf(
                    candidate,
                    game,
                    force=True,
                    require_public_https=bool(manual_source),
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
                if manual_source:
                    # The player already reviewed this exact document on the
                    # preview screen. Preserve that explicit decision instead
                    # of rejecting a legitimate one-word or low-text title.
                    selected_source = {
                        **candidate,
                        "edition": identity["edition"],
                        "confidence": "manual_review",
                    }
                    break
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

    storage_id = (
        job.get("sourceStorageId")
        or (claim.get("rulebook") or {}).get("storageId")
    )
    if not storage_id and os.environ.get("RULES_PLEASE_UPLOAD_PDFS") == "1":
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
    log_event("job_completed", bggId=bgg_id, jobId=job["_id"], pages=len(pages), chunks=len(chunks))


def main():
    parser = argparse.ArgumentParser(description="Run the Rules Please Convex worker")
    parser.add_argument("--once", action="store_true", help="Claim at most one job")
    parser.add_argument("--poll-seconds", type=float, default=3.0)
    args = parser.parse_args()

    app_server.ensure_dirs()
    app_server.load_catalog()
    api = WorkerApi()
    worker_id = os.environ.get("RULES_PLEASE_WORKER_ID", socket.gethostname())
    HEALTH.update({"status": "ready", "workerId": worker_id})
    start_health_server()
    log_event("worker_ready", workerId=worker_id)
    while True:
        try:
            claim = api.post(
                "/worker/jobs/claim",
                {"workerId": worker_id, "leaseMs": LEASE_MS},
            )
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
            # A short network interruption (or a Convex edge restart) must not
            # take the long-running ingestion worker offline.
            HEALTH.update({"status": "ready", "lastError": str(exc)[:500]})
            log_event("claim_retry", error=str(exc))
            if args.once:
                raise
            time.sleep(max(3.0, args.poll_seconds))
            continue
        if claim:
            job = claim["job"]
            HEALTH.update({"status": "processing", "lastJobAt": time.time(), "lastError": None})
            log_event("job_claimed", jobId=job["_id"], workerId=worker_id)
            try:
                process_claim(api, claim)
                HEALTH["status"] = "ready"
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
                    HEALTH.update({"status": "ready", "lastError": str(exc)[:500]})
                    log_event("job_failed", jobId=job["_id"], error=str(exc))
        if args.once:
            return
        time.sleep(max(0.5, args.poll_seconds))


if __name__ == "__main__":
    main()

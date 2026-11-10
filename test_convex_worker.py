import os
import hashlib
import io
import unittest
import urllib.error
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import convex_worker


class FakeApi:
    def __init__(self):
        self.calls = []
        self.prepare_response = {"rulebookId": "rulebook-test", "needsApproval": False, "alreadyIndexed": False}

    def post(self, path, payload):
        self.calls.append((path, payload))
        if path == "/worker/jobs/prepare":
            return self.prepare_response
        return {"ok": True}


class ConvexWorkerFlowTests(unittest.TestCase):
    def test_fallback_preview_keeps_the_selected_candidates_bytes_and_language(self):
        api = FakeApi()
        api.prepare_response["needsApproval"] = True
        uploads = []
        api.upload_pdf = lambda path: uploads.append(path.read_bytes()) or "storage-test"
        candidates = [{"url": "https://example.com/a.pdf", "label": "A"}, {"url": "https://example.com/b.pdf", "label": "B"}]

        class Response(io.BytesIO):
            headers = {"Content-Type": "application/pdf"}

        def metadata(path, *_args):
            return {"identity": {"approved": False, "reviewRequired": True, "edition": "base game", "confidence": "review_required", "reason": "Review"}, "documentHash": hashlib.sha256(path.read_bytes()).hexdigest(), "pageCount": 1, "fileSize": path.stat().st_size, "contentType": "application/pdf", "language": "de"}

        with (
            TemporaryDirectory() as directory,
            patch.dict(os.environ, {"RULES_PLEASE_UPLOAD_PDFS": "1"}),
            patch.object(convex_worker, "_source_candidates", return_value=iter(candidates)),
            patch.object(convex_worker, "_preview_metadata", side_effect=metadata),
            patch.object(convex_worker.app_server, "rules_pdf_path", return_value=Path(directory) / "Kalypso rules.pdf"),
            patch("urllib.request.urlopen", side_effect=[Response(b"%PDF-A"), Response(b"%PDF-B")]),
        ):
            convex_worker.process_claim(api, {"job": {"_id": "job", "leaseToken": "lease"}, "game": {"bggId": 123, "name": "Kalypso"}})
        source = next(payload["source"] for path, payload in api.calls if path == "/worker/jobs/prepare")
        self.assertEqual(source["url"], candidates[0]["url"])
        self.assertEqual(uploads, [b"%PDF-A"])
        self.assertEqual(source["documentHash"], hashlib.sha256(uploads[0]).hexdigest())
        self.assertEqual(source["language"], "de")

    def test_changed_approved_pdf_is_not_indexed(self):
        api = FakeApi()
        with TemporaryDirectory() as directory:
            pdf = Path(directory) / "rules.pdf"
            pdf.write_bytes(b"%PDF-changed")
            with patch.object(convex_worker.app_server, "download_pdf", return_value=pdf):
                with self.assertRaisesRegex(ValueError, "changed since"):
                    convex_worker.process_claim(api, {"job": {"_id": "job", "leaseToken": "lease"}, "game": {"bggId": 123, "name": "Example"}, "approvedSource": {"url": "https://example.com/a.pdf", "documentHash": "previous-hash"}})
        self.assertFalse(any(path == "/worker/jobs/chunks" for path, _ in api.calls))

    def test_language_is_detected_from_text_not_assumed_english(self):
        german = "Jeder Spieler erhält zu Beginn des Spiels vier Karten. Der jüngste Spieler beginnt. Danach spielen alle Spieler im Uhrzeigersinn. Das Spiel endet wenn alle Karten aufgebraucht sind. Wer die meisten Punkte gesammelt hat gewinnt das Spiel."
        english = "Each player receives four cards at the beginning of the game. The youngest player starts and the other players take turns clockwise. The game ends when all cards have been used. The player with the most points wins the game."
        self.assertEqual(convex_worker.app_server.detect_rulebook_language([{"text": german}]), "de")
        self.assertEqual(convex_worker.app_server.detect_rulebook_language([{"text": english}]), "en")
        self.assertEqual(convex_worker.app_server.detect_rulebook_language([{"text": "Kalypso"}]), "und")

    def test_web_search_starts_only_after_a_bgg_download_fails(self):
        game = {"bggId": 456332, "name": "High Moon"}
        bgg = {"url": "https://boardgamegeek.com/file/download/460629", "label": "High Moon Rulebook - ENG"}
        web = {"url": "https://example.com/high-moon-rules.pdf", "label": "High Moon rulebook"}
        events = []

        def web_search(*args, **kwargs):
            events.append("web search")
            return [web]

        def download(candidate, *args, **kwargs):
            events.append(candidate["url"])
            if candidate == bgg:
                raise urllib.error.HTTPError(bgg["url"], 403, "Forbidden", {}, None)
            path = Path(kwargs["directory"]) / "rules.pdf"
            path.write_bytes(b"%PDF-test")
            return path

        api = FakeApi()
        api.prepare_response["needsApproval"] = True
        metadata = {
            "identity": {"approved": True, "edition": "base game", "confidence": "high"},
            "documentHash": convex_worker.hashlib.sha256(b"%PDF-test").hexdigest(),
            "pageCount": 8,
            "fileSize": 9,
            "contentType": "application/pdf",
        }
        with (
            patch.dict(os.environ, {"RULES_PLEASE_UPLOAD_PDFS": "0"}),
            patch.object(convex_worker.app_server, "RULEBOOK_SOURCES", {}),
            patch.object(convex_worker.app_server, "discover_bgg_rulebook_candidates", return_value=[bgg]),
            patch.object(convex_worker.app_server, "discover_rulebook_candidates", side_effect=web_search),
            patch.object(convex_worker.app_server, "download_pdf", side_effect=download),
            patch.object(convex_worker, "_preview_metadata", return_value=metadata),
        ):
            convex_worker.process_claim(api, {
                "job": {"_id": "job-test", "leaseToken": "lease-test"},
                "game": game,
            })

        self.assertEqual(events, [bgg["url"], "web search", web["url"]])
        prepared = next(payload for path, payload in api.calls if path == "/worker/jobs/prepare")
        self.assertEqual(prepared["source"]["url"], web["url"])

    def test_transient_convex_limit_error_is_retryable_even_when_mislabeled_unauthorized(self):
        api = convex_worker.WorkerApi.__new__(convex_worker.WorkerApi)
        api.site_url = "https://example.convex.site"
        api.secret = "test-secret"
        response = io.BytesIO(b'{"error":"Your request timed out performing too many system operations."}')
        error = urllib.error.HTTPError(
            "https://example.convex.site/worker/jobs/claim",
            401,
            "Unauthorized",
            {},
            response,
        )
        with patch("urllib.request.urlopen", side_effect=error):
            with self.assertRaises(convex_worker.WorkerApiError) as raised:
                api.post("/worker/jobs/claim", {"workerId": "test-worker"})
        self.assertTrue(raised.exception.retryable)

    def test_real_unauthorized_error_is_not_retryable(self):
        error = convex_worker.WorkerApiError(401, '{"error":"Unauthorized"}')
        self.assertFalse(error.retryable)

    def test_imported_uncertain_rulebook_indexes_without_a_second_confirmation(self):
        api = FakeApi()
        with TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "rules.pdf"
            pdf_path.write_bytes(b"%PDF-test")
            claim = {
                "job": {"_id": "job-test", "leaseToken": "lease-test"},
                "game": {"bggId": 123, "name": "SCOUT"},
                "rulebook": {},
                "manualSource": {"url": "https://example.com/scout.pdf", "label": "SCOUT imported rulebook"},
                "rejectedDocumentHashes": ["hash-test"],
            }
            metadata = {
                "identity": {
                    "approved": False,
                    "reviewRequired": False,
                    "edition": "base game",
                    "confidence": "rejected",
                    "reason": "The title could not be verified.",
                },
                "documentHash": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
                "pageCount": 12,
                "fileSize": 123,
                "contentType": "application/pdf",
                "revision": None,
            }
            pages = [{"page": 1, "text": "SCOUT game rules setup turn player points."}]
            chunks = [{
                "page": 1,
                "text": pages[0]["text"],
                "sourceUrl": claim["manualSource"]["url"],
                "sourceLabel": claim["manualSource"]["label"],
            }]
            with (
                patch.dict(os.environ, {"RULES_PLEASE_UPLOAD_PDFS": "0"}),
                patch.object(convex_worker.app_server, "GAMES_BY_ID", {}),
                patch.object(convex_worker.app_server, "download_pdf", return_value=pdf_path),
                patch.object(convex_worker, "_preview_metadata", return_value=metadata),
                patch.object(convex_worker.app_server, "extract_pages", return_value=pages),
                patch.object(convex_worker.app_server, "validate_rulebook_identity", return_value=metadata["identity"]),
                patch.object(convex_worker.app_server, "chunk_pages", return_value=chunks),
                patch.object(convex_worker.app_server, "add_embeddings_to_chunks"),
            ):
                convex_worker.process_claim(api, claim)

        prepared = next(payload for path, payload in api.calls if path == "/worker/jobs/prepare")
        self.assertEqual(prepared["source"]["confidence"], "manual_review")
        self.assertEqual(prepared["source"]["reviewStatus"], "approved")
        paths = [path for path, _ in api.calls]
        self.assertNotIn("/worker/jobs/request-approval", paths)
        self.assertIn("/worker/jobs/complete", paths)

    def test_approved_preview_continues_through_indexing_and_completion(self):
        api = FakeApi()
        with TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "rules.pdf"
            pdf_path.write_bytes(b"%PDF-test")
            claim = {
                "job": {"_id": "job-test", "leaseToken": "lease-test"},
                "game": {"bggId": 123, "name": "Example"},
                "rulebook": {},
                "approvedSource": {
                    "url": "https://example.com/rules.pdf",
                    "label": "Example rules",
                    "language": "en",
                    "edition": "base game",
                    "confidence": "verified",
                },
            }
            pages = [{"page": 1, "text": "Example rules setup turn player points game."}]
            chunks = [{
                "page": 1,
                "text": pages[0]["text"],
                "sourceUrl": claim["approvedSource"]["url"],
                "sourceLabel": claim["approvedSource"]["label"],
            }]
            verdict = {
                "approved": True,
                "reviewRequired": False,
                "edition": "base game",
                "confidence": "verified",
                "reason": "Verified",
            }
            with (
                patch.dict(os.environ, {"RULES_PLEASE_UPLOAD_PDFS": "0"}),
                patch.object(convex_worker.app_server, "GAMES_BY_ID", {}),
                patch.object(convex_worker.app_server, "download_pdf", return_value=pdf_path),
                patch.object(convex_worker.app_server, "extract_pages", return_value=pages),
                patch.object(convex_worker.app_server, "validate_rulebook_identity", return_value=verdict),
                patch.object(convex_worker.app_server, "chunk_pages", return_value=chunks),
                patch.object(convex_worker.app_server, "add_embeddings_to_chunks"),
            ):
                convex_worker.process_claim(api, claim)

        paths = [path for path, _ in api.calls]
        self.assertIn("/worker/jobs/prepare", paths)
        self.assertIn("/worker/jobs/chunks", paths)
        self.assertIn("/worker/jobs/complete", paths)


if __name__ == "__main__":
    unittest.main()

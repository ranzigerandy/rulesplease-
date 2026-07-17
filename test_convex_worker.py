import os
import unittest
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
    def test_imported_uncertain_rulebook_still_reaches_visual_approval(self):
        api = FakeApi()
        api.prepare_response = {"rulebookId": "rulebook-test", "needsApproval": True, "alreadyIndexed": False}
        with TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "rules.pdf"
            pdf_path.write_bytes(b"%PDF-test")
            claim = {
                "job": {"_id": "job-test", "leaseToken": "lease-test"},
                "game": {"bggId": 123, "name": "SCOUT"},
                "rulebook": {},
                "manualSource": {"url": "https://example.com/scout.pdf", "label": "SCOUT imported rulebook"},
            }
            metadata = {
                "identity": {
                    "approved": False,
                    "reviewRequired": False,
                    "edition": "base game",
                    "confidence": "rejected",
                    "reason": "The title could not be verified.",
                },
                "documentHash": "hash-test",
                "pageCount": 12,
                "fileSize": 123,
                "contentType": "application/pdf",
                "revision": None,
            }
            with (
                patch.dict(os.environ, {"RULES_PLEASE_UPLOAD_PDFS": "0"}),
                patch.object(convex_worker.app_server, "GAMES_BY_ID", {}),
                patch.object(convex_worker.app_server, "download_pdf", return_value=pdf_path),
                patch.object(convex_worker, "_preview_metadata", return_value=metadata),
            ):
                convex_worker.process_claim(api, claim)

        prepared = next(payload for path, payload in api.calls if path == "/worker/jobs/prepare")
        self.assertEqual(prepared["source"]["confidence"], "manual_review")
        self.assertIn("/worker/jobs/request-approval", [path for path, _ in api.calls])

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

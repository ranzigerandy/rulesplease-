import io
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

import app_server


class RulebookIdentityTests(unittest.TestCase):
    def setUp(self):
        self.game = {"id": 822, "name": "Carcassonne", "year": 2000}

    def test_rejects_unselected_winter_edition(self):
        verdict = app_server.validate_rulebook_identity(
            self.game,
            {
                "url": "https://example.com/carcassonne-winter-edition-rules.pdf",
                "label": "Carcassonne rules",
            },
            [{"text": "CARCASSONNE WINTER EDITION Rules for 2 to 5 players."}],
        )

        self.assertFalse(verdict["approved"])
        self.assertFalse(verdict["reviewRequired"])
        self.assertIn("winter edition", verdict["reason"].lower())

    def test_approves_verified_base_game_rulebook(self):
        verdict = app_server.validate_rulebook_identity(
            self.game,
            app_server.RULEBOOK_SOURCES[822],
            [{"text": "Welcome to Carcassonne! This rulebook explains setup, each player turn, and how to score points in the game."}],
        )

        self.assertTrue(verdict["approved"])
        self.assertEqual(verdict["edition"], "base game")

    def test_url_scoring_hard_rejects_wrong_edition(self):
        score = app_server.score_rulebook_candidate(
            "https://example.com/carcassonne-winter-edition-rules.pdf",
            self.game,
        )

        self.assertLess(score, 0)

    def test_rejects_a_same_title_bible_quiz_pdf(self):
        game = {"id": 415147, "name": "Spectacular", "year": 2024}
        verdict = app_server.validate_rulebook_identity(
            game,
            {
                "url": "https://example.com/Spectacular-Rules.pdf",
                "label": "Spectacular rules",
                "confidence": "auto",
            },
            [{"text": "Spectacular Rules. Quiz Officials. The quizmaster asks Bible quiz questions."}],
        )

        self.assertFalse(verdict["approved"])
        self.assertFalse(verdict["reviewRequired"])
        self.assertIn("content mismatch", verdict["reason"].lower())

    def test_approves_the_curated_spectacular_board_game_rulebook(self):
        game = {"id": 415147, "name": "Spectacular", "year": 2024}
        verdict = app_server.validate_rulebook_identity(
            game,
            app_server.RULEBOOK_SOURCES[415147],
            [{"text": "Spectacular by Chilifox Games. Components include animal tiles, dice, player boards, and scoring rules."}],
        )

        self.assertTrue(verdict["approved"])
        self.assertEqual(verdict["edition"], "base game")

    def test_html_result_pages_are_not_rulebook_candidates(self):
        game = {"id": 154125, "name": "Pocket Battles: Confederacy vs Union", "year": 2014}
        candidates = {}
        app_server.add_candidate(
            candidates,
            "https://example.com/pocket-battles-confederacy-vs-union-rules",
            game,
        )

        self.assertEqual(candidates, {})

    def test_manual_pdf_urls_reject_local_networks_and_plain_http(self):
        with self.assertRaisesRegex(ValueError, "public HTTPS"):
            app_server.validate_public_pdf_url("http://example.com/rules.pdf")
        with self.assertRaisesRegex(ValueError, "private or local"):
            app_server.validate_public_pdf_url("https://127.0.0.1/rules.pdf")

    def test_imported_viewer_url_resolves_the_pdf_link_and_keeps_it_for_preview(self):
        class Response(io.BytesIO):
            def __init__(self, payload, content_type):
                super().__init__(payload)
                self.headers = {"Content-Type": content_type, "Content-Length": str(len(payload))}

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                self.close()

        viewer = "https://example.com/scout-download"
        direct_pdf = "https://cdn.example.com/SCOUT-rules.pdf"
        opener = Mock()
        opener.open.side_effect = [
            Response(b"<html>Download SCOUT</html>", "text/html"),
            Response(b"%PDF-1.7\nrulebook", "application/pdf"),
        ]
        source = {"url": viewer, "label": "SCOUT imported rulebook"}

        with TemporaryDirectory() as directory:
            with (
                patch.object(app_server, "rules_pdf_path", return_value=Path(directory) / "SCOUT rules.pdf"),
                patch.object(app_server, "validate_public_pdf_url"),
                patch.object(app_server, "extract_pdf_links", return_value=[direct_pdf]),
                patch.object(app_server.urllib.request, "build_opener", return_value=opener),
            ):
                downloaded = app_server.download_pdf(
                    source, {"name": "SCOUT"}, force=True, require_public_https=True
                )
            self.assertEqual(source["url"], direct_pdf)
            self.assertEqual(downloaded.read_bytes(), b"%PDF-1.7\nrulebook")


if __name__ == "__main__":
    unittest.main()

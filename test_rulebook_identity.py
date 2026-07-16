import unittest

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


if __name__ == "__main__":
    unittest.main()

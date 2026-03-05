import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon import utils


class UtilsTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(utils.slugify("Coles Group"), "coles-group")

    def test_parse_date_supports_natural_language(self):
        parsed = utils.parse_date("6 April 2026")
        self.assertEqual(str(parsed), "2026-04-06")

    def test_parse_date_supports_iso_datetime(self):
        parsed = utils.parse_date("2026-03-29T23:59:00+11:00")
        self.assertEqual(str(parsed), "2026-03-29")

    def test_compute_status_known_window(self):
        status = utils.compute_status("2026-03-01", "2026-03-10", today=utils.parse_date("2026-03-05"))
        self.assertEqual(status, "open")

    def test_compute_status_upcoming_when_before_open_window(self):
        status = utils.compute_status("2026-03-10", "2026-04-12", today=utils.parse_date("2026-03-06"))
        self.assertEqual(status, "upcoming")

    def test_compute_status_upcoming_when_only_open_date_exists(self):
        status = utils.compute_status("2026-05-02", None, today=utils.parse_date("2026-04-07"))
        self.assertEqual(status, "upcoming")

    def test_compute_status_close_only(self):
        status = utils.compute_status(None, "2026-01-10", today=utils.parse_date("2026-01-11"))
        self.assertEqual(status, "closed")

    def test_compute_status_unknown(self):
        status = utils.compute_status(None, None, today=utils.parse_date("2026-03-05"))
        self.assertEqual(status, "unknown")


if __name__ == "__main__":
    unittest.main()

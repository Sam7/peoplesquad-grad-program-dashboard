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

    def test_compute_status_known_window(self):
        status = utils.compute_status("2026-03-01", "2026-03-10", today=utils.parse_date("2026-03-05"))
        self.assertEqual(status, "open")

    def test_compute_status_close_only(self):
        status = utils.compute_status(None, "2026-01-10", today=utils.parse_date("2026-01-11"))
        self.assertEqual(status, "closed")

    def test_compute_status_unknown(self):
        status = utils.compute_status(None, None, today=utils.parse_date("2026-03-05"))
        self.assertEqual(status, "unknown")


if __name__ == "__main__":
    unittest.main()

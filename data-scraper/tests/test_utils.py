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

    def test_parse_date_supports_month_year(self):
        parsed = utils.parse_date("August 2026")
        self.assertEqual(str(parsed), "2026-08-01")

    def test_parse_date_supports_month_only_using_current_year(self):
        parsed = utils.parse_date("August")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.month, 8)
        self.assertEqual(parsed.day, 1)
        self.assertEqual(parsed.year, utils.dt.date.today().year)

    def test_normalize_program_dates_exact_day(self):
        program = {
            "open_date": "2026-03-12",
            "close_date": "20 April 2026",
            "open_date_raw": None,
            "close_date_raw": None,
        }
        normalized = utils.normalize_program_dates(program, reference_date=utils.dt.date(2026, 3, 6))
        self.assertEqual(normalized["open_date"], "2026-03-12")
        self.assertEqual(normalized["close_date"], "2026-04-20")
        self.assertEqual(normalized["open_date_precision"], "exact_day")
        self.assertEqual(normalized["close_date_precision"], "exact_day")
        self.assertEqual(normalized["open_date_raw"], "2026-03-12")
        self.assertEqual(normalized["close_date_raw"], "20 April 2026")

    def test_normalize_program_dates_month_only_uses_current_year_boundaries(self):
        program = {
            "open_date": "July",
            "close_date": "August",
            "open_date_raw": None,
            "close_date_raw": None,
        }
        normalized = utils.normalize_program_dates(program, reference_date=utils.dt.date(2026, 3, 6))
        self.assertEqual(normalized["open_date"], "2026-07-01")
        self.assertEqual(normalized["close_date"], "2026-08-31")
        self.assertEqual(normalized["open_date_precision"], "month_assumed_current_year")
        self.assertEqual(normalized["close_date_precision"], "month_assumed_current_year")
        self.assertEqual(normalized["open_date_raw"], "July")
        self.assertEqual(normalized["close_date_raw"], "August")

    def test_normalize_program_dates_keeps_explicit_year(self):
        program = {
            "open_date": "July 2025",
            "close_date": "August 2025",
            "open_date_raw": None,
            "close_date_raw": None,
        }
        normalized = utils.normalize_program_dates(program, reference_date=utils.dt.date(2026, 3, 6))
        self.assertEqual(normalized["open_date"], "2025-07-01")
        self.assertEqual(normalized["close_date"], "2025-08-31")
        self.assertEqual(normalized["open_date_precision"], "month_year_normalized")
        self.assertEqual(normalized["close_date_precision"], "month_year_normalized")

    def test_normalize_program_dates_handles_missing_dates(self):
        program = {
            "open_date": None,
            "close_date": None,
        }
        normalized = utils.normalize_program_dates(program, reference_date=utils.dt.date(2026, 3, 6))
        self.assertIsNone(normalized["open_date"])
        self.assertIsNone(normalized["close_date"])
        self.assertEqual(normalized["open_date_precision"], "missing")
        self.assertEqual(normalized["close_date_precision"], "missing")
        self.assertIsNone(normalized["open_date_raw"])
        self.assertIsNone(normalized["close_date_raw"])

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

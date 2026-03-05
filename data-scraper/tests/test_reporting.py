import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.reporting import generate_build_report, generate_discovery_report, generate_report_from_data


class ReportingTests(unittest.TestCase):
    def test_generate_discovery_report_contains_counts(self):
        text = generate_discovery_report(
            qualified=[{"id": "a", "name": "A"}],
            excluded=[{"id": "b", "name": "B", "qualification": {"reason": "No program"}}],
            failures=[{"id": "c", "error": "timeout"}],
        )
        self.assertIn("Qualified: 1", text)
        self.assertIn("Excluded: 1", text)
        self.assertIn("Failures: 1", text)

    def test_generate_build_report_contains_missing_counts(self):
        detail = {
            "id": "a",
            "name": "A",
            "program": {"direct_apply_url": None, "close_date": None},
            "eligibility": {"work_rights": None},
            "logo_url": None,
        }
        text = generate_build_report(details=[detail], failures=[])
        self.assertIn("Missing direct apply URL: 1", text)
        self.assertIn("Missing close date: 1", text)
        self.assertIn("Missing logo: 1", text)

    def test_generate_report_from_data_reads_output_files(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            (base / "index.json").write_text(json.dumps({"companies": [{"id": "a"}]}), encoding="utf-8")
            companies = base / "companies"
            companies.mkdir(parents=True, exist_ok=True)
            (companies / "a.json").write_text(
                json.dumps({"id": "a", "name": "A", "program": {"direct_apply_url": None, "close_date": None}, "eligibility": {"work_rights": None}}),
                encoding="utf-8",
            )
            report_path = base / "report.md"
            generate_report_from_data(data_dir=base, out_path=report_path)
            self.assertTrue(report_path.exists())
            content = report_path.read_text(encoding="utf-8")
            self.assertIn("Build Report", content)


if __name__ == "__main__":
    unittest.main()

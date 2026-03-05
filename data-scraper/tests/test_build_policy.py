import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.build import build_company_details
from recon.prompts import PromptBundle


class FakeClient:
    def call_structured(self, **kwargs):
        return {
            "program": {"name": None, "overview_url": None, "direct_apply_url": None, "open_date": None, "close_date": None, "streams": [], "locations": [], "salary_text": None, "duration_text": None, "rotation_text": None},
            "eligibility": {"work_rights": None, "graduation_window": None, "disciplines": [], "minimum_requirements": []},
            "recruitment_process": {"stages": [], "tips": []},
            "section_provenance": {
                "program": {"confidence": "low", "notes": [], "sources": []},
                "eligibility": {"confidence": "low", "notes": [], "sources": []},
                "recruitment_process": {"confidence": "low", "notes": [], "sources": []},
                "commercial_context": {"confidence": "low", "notes": [], "sources": []}
            },
            "commercial_context": {"exec_themes": [], "profit_engine": None, "headwinds": None, "esg": None, "recent_pivot": None}
        }


class BuildPolicyTests(unittest.TestCase):
    def test_build_fails_record_without_official_domains(self):
        records = [{"id": "a", "name": "A", "entity_type": "company", "official_domains": [], "urls": {}, "classification": {}}]
        bundle = PromptBundle(system="s", user="u", schema={"type": "object"})
        details, failures = build_company_details(records=records, client=FakeClient(), program_bundle=bundle, commercial_bundle=bundle, workers=1)
        self.assertEqual(len(details), 0)
        self.assertEqual(len(failures), 1)


if __name__ == "__main__":
    unittest.main()

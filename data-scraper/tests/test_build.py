import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.build import build_index_entry, compose_company_detail, select_seed_records


class BuildTests(unittest.TestCase):
    def test_select_seed_records_approved_only(self):
        records = [
            {"id": "a", "review": {"status": "approved"}},
            {"id": "b", "review": {"status": "needs_review"}},
        ]
        selected = select_seed_records(records, approved_only=True, company_id=None)
        self.assertEqual([x["id"] for x in selected], ["a"])

    def test_select_seed_records_single_company(self):
        records = [
            {"id": "a", "review": {"status": "approved"}},
            {"id": "b", "review": {"status": "approved"}},
        ]
        selected = select_seed_records(records, approved_only=True, company_id="b")
        self.assertEqual([x["id"] for x in selected], ["b"])

    def test_compose_company_detail_shape(self):
        candidate = {
            "id": "coles-group",
            "name": "Coles Group",
            "entity_type": "company",
            "classification": {"industry_bucket": "Retail", "is_government": False, "government_level": "none"},
            "official_domains": ["colesgroup.com.au"],
            "urls": {"careers_url": "https://careers.example.com", "grad_program_url": None, "apply_url": None, "investor_relations_url": None},
            "branding": {"logo_candidates": ["https://colesgroup.com.au/logo.svg"]},
        }
        program = {
            "program": {
                "name": "Graduate Program",
                "overview_url": "https://careers.example.com/grad",
                "direct_apply_url": "https://careers.example.com/apply",
                "open_date": "2026-01-01",
                "close_date": "2099-01-01",
                "streams": ["Technology"],
                "locations": ["Melbourne"],
                "salary_text": None,
                "duration_text": "24 months",
                "rotation_text": "3 rotations"
            },
            "eligibility": {
                "work_rights": "Citizen or PR",
                "graduation_window": "2024-2026",
                "disciplines": ["IT"],
                "minimum_requirements": ["Bachelor degree"]
            },
            "recruitment_process": {
                "stages": [{"name": "Application", "details": None}],
                "tips": []
            },
            "section_provenance": {
                "program": {"confidence": "high", "notes": [], "sources": []},
                "eligibility": {"confidence": "medium", "notes": [], "sources": []},
                "recruitment_process": {"confidence": "medium", "notes": [], "sources": []}
            }
        }
        commercial = {
            "commercial_context": {
                "exec_themes": ["Productivity"],
                "profit_engine": "Retail and loyalty",
                "headwinds": "Inflation",
                "esg": "Net zero target",
                "recent_pivot": "Digital fulfillment"
            },
            "section_provenance": {
                "commercial_context": {"confidence": "medium", "notes": [], "sources": []}
            }
        }

        logo = {
            "local_path": "assets/logos/coles-group-peoplesquad-logo.webp",
            "source_url": "https://colesgroup.com.au/logo.svg",
            "mime_type": "image/webp",
            "filename": "coles-group-peoplesquad-logo.webp",
            "format": "webp",
            "source_width": 1024,
            "source_height": 512,
            "output_width": 512,
            "output_height": 512,
            "confidence": "high",
            "quality_score": 0.93,
            "selection_reason": "brand_logo",
            "retrieved_at": "2026-01-01T00:00:00+00:00",
            "notes": [],
        }
        detail = compose_company_detail(candidate, program, commercial, logo)
        self.assertEqual(detail["id"], "coles-group")
        self.assertIn("commercial_context", detail)
        self.assertIn("provenance", detail)
        self.assertEqual(detail["logo_url"], "assets/logos/coles-group-peoplesquad-logo.webp")
        self.assertIn("branding", detail)

        index = build_index_entry(detail)
        self.assertEqual(index["id"], "coles-group")
        self.assertEqual(index["apply"]["status"], "open")
        self.assertEqual(index["logo_url"], "assets/logos/coles-group-peoplesquad-logo.webp")


if __name__ == "__main__":
    unittest.main()

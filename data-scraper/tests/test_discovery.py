import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.discovery import discover_entities, load_seed_records
from recon.prompts import PromptBundle


class FakeClient:
    def __init__(self, payloads):
        self.payloads = payloads

    def call_structured(self, **kwargs):
        messages = kwargs["messages"]
        user = messages[1]["content"]
        for key, value in self.payloads.items():
            if key in user:
                return value
        raise RuntimeError("No payload for user message")


class DiscoveryTests(unittest.TestCase):
    def test_load_seed_records_merges_default_files(self):
        with tempfile.TemporaryDirectory() as td:
            inputs = Path(td)
            (inputs / "asx50_seed.json").write_text(json.dumps([{"id": "a"}]), encoding="utf-8")
            (inputs / "curated_majors.json").write_text(json.dumps([{"id": "b"}]), encoding="utf-8")
            seeds = load_seed_records(inputs)
        self.assertEqual([s["id"] for s in seeds], ["a", "b"])

    def test_discover_entities_filters_non_qualifiers(self):
        seeds = [
            {"id": "coles-group", "name": "Coles Group", "entity_type": "company"},
            {"id": "no-grad", "name": "No Grad", "entity_type": "company"},
        ]
        bundle = PromptBundle(system="sys", user="Company: {{company_name}}", schema={"type": "object"})
        client = FakeClient(
            {
                "Coles Group": {
                    "id": "coles-group",
                    "name": "Coles Group",
                    "entity_type": "company",
                    "classification": {
                        "industry_bucket": "Retail",
                        "is_government": False,
                        "government_level": "none"
                    },
                    "official_domains": ["colesgroup.com.au"],
                    "urls": {"careers_url": "https://example.com", "grad_program_url": None, "apply_url": None, "investor_relations_url": None},
                    "branding": {"logo_candidates": ["https://colesgroup.com.au/logo.svg"]},
                    "qualification": {"qualifies": True, "reason": "Has grad program", "confidence": "high"},
                    "provenance": {"sources": [], "notes": []}
                },
                "No Grad": {
                    "id": "no-grad",
                    "name": "No Grad",
                    "entity_type": "company",
                    "classification": {
                        "industry_bucket": "Other",
                        "is_government": False,
                        "government_level": "none"
                    },
                    "official_domains": ["nograd.com"],
                    "urls": {"careers_url": None, "grad_program_url": None, "apply_url": None, "investor_relations_url": None},
                    "branding": {"logo_candidates": []},
                    "qualification": {"qualifies": False, "reason": "No grad program", "confidence": "low"},
                    "provenance": {"sources": [], "notes": []}
                }
            }
        )

        qualified, excluded, failures = discover_entities(seeds=seeds, bundle=bundle, client=client, workers=1)

        self.assertEqual(len(qualified), 1)
        self.assertEqual(qualified[0]["review"]["status"], "needs_review")
        self.assertIn("branding", qualified[0])
        self.assertEqual(qualified[0]["branding"]["logo_candidates"], ["https://colesgroup.com.au/logo.svg"])
        self.assertEqual(len(excluded), 1)
        self.assertEqual(len(failures), 0)


if __name__ == "__main__":
    unittest.main()

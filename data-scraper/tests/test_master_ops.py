import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.master_ops import (
    parse_names_text,
    merge_candidate_payloads,
    seed_records_from_names,
)


class MasterOpsTests(unittest.TestCase):
    def test_parse_names_text_splits_semicolon_and_newline(self):
        names = parse_names_text("Acme Corp; Beta Ltd\nGamma Group")
        self.assertEqual(names, ["Acme Corp", "Beta Ltd", "Gamma Group"])

    def test_seed_records_from_names_slugifies_and_dedupes(self):
        names = ["Acme Corp", "  ", "acme corp", "Beta Ltd"]
        records = seed_records_from_names(names, entity_type="company", taxonomy_hint="")
        self.assertEqual([r["id"] for r in records], ["acme-corp", "beta-ltd"])
        self.assertEqual([r["name"] for r in records], ["Acme Corp", "Beta Ltd"])
        self.assertTrue(all(r["entity_type"] == "company" for r in records))

    def test_merge_candidate_payloads_keeps_existing_duplicate_and_adds_new(self):
        master = {
            "schema_version": "1.0",
            "generated_at": "2026-03-05T00:00:00+00:00",
            "build_mode": "balanced",
            "candidates": [
                {"id": "a", "name": "A Corp", "review": {"status": "approved", "notes": []}},
                {"id": "b", "name": "B Corp", "review": {"status": "needs_review", "notes": []}},
            ],
            "summary": {"qualified_count": 2, "excluded_count": 1, "failure_count": 0},
            "excluded": [{"id": "x"}],
            "failures": [],
        }
        incoming = {
            "schema_version": "1.0",
            "generated_at": "2026-03-06T00:00:00+00:00",
            "build_mode": "balanced",
            "candidates": [
                {"id": "b", "name": "B Corp New Name", "review": {"status": "approved", "notes": []}},
                {"id": "c", "name": "C Corp"},
            ],
            "summary": {"qualified_count": 2, "excluded_count": 0, "failure_count": 0},
            "excluded": [],
            "failures": [],
        }
        merged, report = merge_candidate_payloads(
            master_payload=master,
            incoming_payload=incoming,
            duplicate_policy="keep-existing",
            default_review_status="needs_review",
        )
        self.assertEqual([c["id"] for c in merged["candidates"]], ["a", "b", "c"])
        self.assertEqual(merged["candidates"][1]["name"], "B Corp")
        self.assertEqual(merged["candidates"][2]["review"]["status"], "needs_review")
        self.assertEqual(merged["summary"]["qualified_count"], 3)
        self.assertEqual(merged["excluded"], [{"id": "x"}])
        self.assertEqual(report["added_count"], 1)
        self.assertEqual(report["duplicate_kept_count"], 1)

    def test_merge_candidate_payloads_accepts_candidate_list_input(self):
        master = {"schema_version": "1.0", "generated_at": "x", "build_mode": "balanced", "candidates": [], "summary": {}}
        incoming = [{"id": "newco", "name": "NewCo"}]
        merged, report = merge_candidate_payloads(
            master_payload=master,
            incoming_payload=incoming,
            duplicate_policy="keep-existing",
            default_review_status="needs_review",
        )
        self.assertEqual([c["id"] for c in merged["candidates"]], ["newco"])
        self.assertEqual(merged["candidates"][0]["review"]["status"], "needs_review")
        self.assertEqual(report["added_count"], 1)


class MasterOpsCLIFunctionalTests(unittest.TestCase):
    def test_seed_from_names_and_merge_flow(self):
        from recon.cli import main

        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            seed_file = base / "slice-seed.json"
            incoming_file = base / "incoming-discovered.json"
            master_file = base / "master.json"

            master_file.write_text(
                json.dumps(
                    {
                        "schema_version": "1.0",
                        "generated_at": "2026-03-05T00:00:00+00:00",
                        "build_mode": "balanced",
                        "candidates": [{"id": "acme-corp", "name": "Acme Corp", "review": {"status": "approved", "notes": []}}],
                        "summary": {"qualified_count": 1, "excluded_count": 0, "failure_count": 0},
                        "excluded": [],
                        "failures": [],
                    }
                ),
                encoding="utf-8",
            )
            incoming_file.write_text(
                json.dumps(
                    {
                        "schema_version": "1.0",
                        "generated_at": "2026-03-06T00:00:00+00:00",
                        "build_mode": "balanced",
                        "candidates": [{"id": "beta-ltd", "name": "Beta Ltd"}],
                        "summary": {"qualified_count": 1, "excluded_count": 0, "failure_count": 0},
                        "excluded": [],
                        "failures": [],
                    }
                ),
                encoding="utf-8",
            )

            rc_seed = main(["seed-from-names", "--names", "Acme Corp; Beta Ltd", "--out", str(seed_file)])
            self.assertEqual(rc_seed, 0)
            self.assertTrue(seed_file.exists())

            rc_merge = main(["master-merge", "--master", str(master_file), "--incoming", str(incoming_file)])
            self.assertEqual(rc_merge, 0)
            merged = json.loads(master_file.read_text(encoding="utf-8"))
            self.assertEqual([c["id"] for c in merged["candidates"]], ["acme-corp", "beta-ltd"])


if __name__ == "__main__":
    unittest.main()

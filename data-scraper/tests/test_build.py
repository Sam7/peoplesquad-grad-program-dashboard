import sys
import tempfile
import unittest
import json
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.build import (
    build_company_details,
    build_index_entry,
    compose_company_detail,
    compute_build_fingerprint,
    select_records_for_processing,
    select_seed_records,
)
from recon.prompts import PromptBundle


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

    def test_select_records_for_processing_skips_completed_and_applies_limit(self):
        records = [
            {"id": "a", "name": "A", "official_domains": ["a.com"], "urls": {}, "classification": {}},
            {"id": "b", "name": "B", "official_domains": ["b.com"], "urls": {}, "classification": {}},
            {"id": "c", "name": "C", "official_domains": ["c.com"], "urls": {}, "classification": {}},
        ]
        program_bundle = PromptBundle(system="s", user="u", schema={"type": "object"})
        commercial_bundle = PromptBundle(system="s", user="u", schema={"type": "object"})
        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td) / "out"
            state_dir = out_dir / ".recon-state"
            (out_dir / "companies").mkdir(parents=True, exist_ok=True)
            (state_dir / "companies").mkdir(parents=True, exist_ok=True)
            (out_dir / "companies" / "a.json").write_text("{}", encoding="utf-8")
            fingerprint_a = compute_build_fingerprint(
                record=records[0],
                model="m",
                program_bundle=program_bundle,
                commercial_bundle=commercial_bundle,
                logo_settings={
                    "logo_public_prefix": "assets/logos",
                    "logo_filename_template": "{id}-peoplesquad-logo.webp",
                    "logo_max_size": 512,
                    "logo_min_source_size": 96,
                    "logo_format": "webp",
                    "skip_logo_download": False,
                },
            )
            (state_dir / "companies" / "a.json").write_text(
                '{"status":"completed","fingerprint":"' + fingerprint_a + '"}',
                encoding="utf-8",
            )
            to_process, skipped = select_records_for_processing(
                records=records,
                out_dir=out_dir,
                state_dir=state_dir,
                model="m",
                program_bundle=program_bundle,
                commercial_bundle=commercial_bundle,
                resume=True,
                force_rebuild=False,
                max_companies=1,
                logo_settings={
                    "logo_public_prefix": "assets/logos",
                    "logo_filename_template": "{id}-peoplesquad-logo.webp",
                    "logo_max_size": 512,
                    "logo_min_source_size": 96,
                    "logo_format": "webp",
                    "skip_logo_download": False,
                },
            )
            self.assertEqual([r["id"] for r in skipped], ["a"])
            self.assertEqual([r["id"] for r in to_process], ["b"])

    def test_select_records_for_processing_skips_legacy_existing_company_file(self):
        records = [
            {"id": "a", "name": "A", "official_domains": ["a.com"], "urls": {}, "classification": {}},
            {"id": "b", "name": "B", "official_domains": ["b.com"], "urls": {}, "classification": {}},
        ]
        program_bundle = PromptBundle(system="s", user="u", schema={"type": "object"})
        commercial_bundle = PromptBundle(system="s", user="u", schema={"type": "object"})
        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td) / "out"
            state_dir = out_dir / ".recon-state"
            (out_dir / "companies").mkdir(parents=True, exist_ok=True)
            (out_dir / "companies" / "a.json").write_text("{}", encoding="utf-8")
            to_process, skipped = select_records_for_processing(
                records=records,
                out_dir=out_dir,
                state_dir=state_dir,
                model="m",
                program_bundle=program_bundle,
                commercial_bundle=commercial_bundle,
                resume=True,
                force_rebuild=False,
                max_companies=None,
                logo_settings={
                    "logo_public_prefix": "assets/logos",
                    "logo_filename_template": "{id}-peoplesquad-logo.webp",
                    "logo_max_size": 512,
                    "logo_min_source_size": 96,
                    "logo_format": "webp",
                    "skip_logo_download": False,
                },
            )
            self.assertEqual([r["id"] for r in skipped], ["a"])
            self.assertEqual([r["id"] for r in to_process], ["b"])

    def test_build_company_details_reuses_program_checkpoint_after_failure(self):
        record = {
            "id": "a",
            "name": "A",
            "official_domains": ["a.com"],
            "urls": {},
            "classification": {},
            "branding": {"logo_candidates": []},
        }
        program_payload = {
            "program": {},
            "eligibility": {},
            "recruitment_process": {},
            "section_provenance": {"program": {}, "eligibility": {}, "recruitment_process": {}},
        }
        commercial_payload = {
            "commercial_context": {},
            "section_provenance": {"commercial_context": {}},
        }
        program_bundle = PromptBundle(system="s", user="u", schema={"type": "object"})
        commercial_bundle = PromptBundle(system="s", user="u", schema={"type": "object"})

        class _FailCommercialClient:
            def __init__(self):
                self.calls = []

            def call_structured(self, **kwargs):
                self.calls.append(kwargs["schema_name"])
                if kwargs["schema_name"] == "extract_program":
                    return program_payload
                raise RuntimeError("commercial failed")

        class _RecoverClient:
            def __init__(self):
                self.calls = []

            def call_structured(self, **kwargs):
                self.calls.append(kwargs["schema_name"])
                if kwargs["schema_name"] == "extract_program":
                    raise AssertionError("program should be loaded from checkpoint")
                return commercial_payload

        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td) / "out"
            fail_client = _FailCommercialClient()
            with mock.patch("recon.build.resolve_logo_asset", return_value=None):
                details1, failures1 = build_company_details(
                    records=[record],
                    client=fail_client,
                    program_bundle=program_bundle,
                    commercial_bundle=commercial_bundle,
                    workers=1,
                    out_dir=out_dir,
                    state_dir=out_dir / ".recon-state",
                    model="m",
                    resume=True,
                    force_rebuild=False,
                    logo_failure_mode="warn",
                    logo_output_dir=out_dir / "assets" / "logos",
                )
                self.assertEqual(details1, [])
                self.assertEqual(len(failures1), 1)
                self.assertEqual(fail_client.calls, ["extract_program", "extract_commercial"])

                recover_client = _RecoverClient()
                details2, failures2 = build_company_details(
                    records=[record],
                    client=recover_client,
                    program_bundle=program_bundle,
                    commercial_bundle=commercial_bundle,
                    workers=1,
                    out_dir=out_dir,
                    state_dir=out_dir / ".recon-state",
                    model="m",
                    resume=True,
                    force_rebuild=False,
                    logo_failure_mode="warn",
                    logo_output_dir=out_dir / "assets" / "logos",
                )
                self.assertEqual(failures2, [])
                self.assertEqual(len(details2), 1)
                self.assertEqual(recover_client.calls, ["extract_commercial"])

    def test_build_company_details_does_not_reuse_checkpoints_when_fingerprint_changes(self):
        record = {
            "id": "a",
            "name": "A",
            "official_domains": ["a.com"],
            "urls": {},
            "classification": {},
            "branding": {"logo_candidates": []},
        }
        old_program_payload = {
            "program": {"name": "Old"},
            "eligibility": {},
            "recruitment_process": {},
            "section_provenance": {"program": {}, "eligibility": {}, "recruitment_process": {}},
        }
        old_commercial_payload = {
            "commercial_context": {"profit_engine": "Old"},
            "section_provenance": {"commercial_context": {}},
        }
        new_program_payload = {
            "program": {"name": "New"},
            "eligibility": {},
            "recruitment_process": {},
            "section_provenance": {"program": {}, "eligibility": {}, "recruitment_process": {}},
        }
        new_commercial_payload = {
            "commercial_context": {"profit_engine": "New"},
            "section_provenance": {"commercial_context": {}},
        }
        old_program_bundle = PromptBundle(system="s", user="u-old", schema={"type": "object"})
        old_commercial_bundle = PromptBundle(system="s", user="u-old", schema={"type": "object"})
        new_program_bundle = PromptBundle(system="s", user="u-new", schema={"type": "object"})
        new_commercial_bundle = PromptBundle(system="s", user="u-new", schema={"type": "object"})

        class _RecordingClient:
            def __init__(self):
                self.calls = []

            def call_structured(self, **kwargs):
                self.calls.append(kwargs["schema_name"])
                if kwargs["schema_name"] == "extract_program":
                    return new_program_payload
                return new_commercial_payload

        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td) / "out"
            state_dir = out_dir / ".recon-state"
            (state_dir / "checkpoints" / "a").mkdir(parents=True, exist_ok=True)
            (state_dir / "companies").mkdir(parents=True, exist_ok=True)
            (out_dir / "companies").mkdir(parents=True, exist_ok=True)
            (state_dir / "checkpoints" / "a" / "program.json").write_text(
                '{"program":{"name":"Old"},"eligibility":{},"recruitment_process":{},"section_provenance":{"program":{},"eligibility":{},"recruitment_process":{}}}',
                encoding="utf-8",
            )
            (state_dir / "checkpoints" / "a" / "commercial.json").write_text(
                '{"commercial_context":{"profit_engine":"Old"},"section_provenance":{"commercial_context":{}}}',
                encoding="utf-8",
            )
            old_fingerprint = compute_build_fingerprint(
                record=record,
                model="m",
                program_bundle=old_program_bundle,
                commercial_bundle=old_commercial_bundle,
                logo_settings={
                    "logo_public_prefix": "assets/logos",
                    "logo_filename_template": "{id}-peoplesquad-logo.webp",
                    "logo_max_size": 512,
                    "logo_min_source_size": 96,
                    "logo_format": "webp",
                    "skip_logo_download": False,
                },
            )
            (state_dir / "companies" / "a.json").write_text(
                json.dumps(
                    {
                        "status": "completed",
                        "fingerprint": old_fingerprint,
                        "stages": {
                            "program": {"status": "completed"},
                            "commercial": {"status": "completed"},
                        },
                    }
                ),
                encoding="utf-8",
            )
            write_company = {
                "id": "a",
                "name": "A",
                "program": {"name": "Old"},
                "eligibility": {},
                "recruitment_process": {},
                "commercial_context": {"profit_engine": "Old"},
                "section_provenance": {
                    "program": {},
                    "eligibility": {},
                    "recruitment_process": {},
                    "commercial_context": {},
                },
                "provenance": {"updated_at": "2026-01-01T00:00:00+00:00", "sources": [], "notes": []},
            }
            (out_dir / "companies" / "a.json").write_text(json.dumps(write_company), encoding="utf-8")

            client = _RecordingClient()
            with mock.patch("recon.build.resolve_logo_asset", return_value=None):
                details, failures = build_company_details(
                    records=[record],
                    client=client,
                    program_bundle=new_program_bundle,
                    commercial_bundle=new_commercial_bundle,
                    workers=1,
                    out_dir=out_dir,
                    state_dir=state_dir,
                    model="m",
                    resume=True,
                    force_rebuild=False,
                    logo_failure_mode="warn",
                    logo_output_dir=out_dir / "assets" / "logos",
                )

            self.assertEqual(failures, [])
            self.assertEqual(len(details), 1)
            self.assertEqual(client.calls, ["extract_program", "extract_commercial"])
            self.assertEqual(details[0]["program"].get("name"), "New")
            self.assertEqual(details[0]["commercial_context"].get("profit_engine"), "New")


if __name__ == "__main__":
    unittest.main()

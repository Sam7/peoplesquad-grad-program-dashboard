from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from recon.models import SCHEMA_VERSION
from recon.prompts import PromptBundle, build_messages
from recon.utils import read_json, slugify, unique_str_list, utc_now_iso, write_json


def load_seed_records(inputs_dir: Path) -> list[dict[str, Any]]:
    asx_path = inputs_dir / "asx50_seed.json"
    curated_path = inputs_dir / "curated_majors.json"
    asx_records = read_json(asx_path)
    curated_records = read_json(curated_path)
    if not isinstance(asx_records, list) or not isinstance(curated_records, list):
        raise ValueError("Seed files must be JSON arrays.")
    return [*asx_records, *curated_records]


def _normalize_discovery_record(seed: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name") or seed.get("name") or "").strip()
    item_id = str(payload.get("id") or seed.get("id") or slugify(name)).strip()
    classification = payload.get("classification") or {}
    qualification = payload.get("qualification") or {}
    urls = payload.get("urls") or {}
    provenance = payload.get("provenance") or {}
    result = {
        "id": item_id,
        "name": name,
        "entity_type": payload.get("entity_type") or seed.get("entity_type") or "company",
        "classification": {
            "industry_bucket": classification.get("industry_bucket", "Other"),
            "is_government": bool(classification.get("is_government", False)),
            "government_level": classification.get("government_level", "none"),
        },
        "official_domains": unique_str_list(payload.get("official_domains") or []),
        "urls": {
            "careers_url": urls.get("careers_url"),
            "grad_program_url": urls.get("grad_program_url"),
            "apply_url": urls.get("apply_url"),
            "investor_relations_url": urls.get("investor_relations_url"),
        },
        "branding": {
            "logo_candidates": unique_str_list(((payload.get("branding") or {}).get("logo_candidates")) or []),
        },
        "qualification": {
            "qualifies": bool(qualification.get("qualifies", False)),
            "reason": str(qualification.get("reason") or ""),
            "confidence": str(qualification.get("confidence") or "low").lower(),
        },
        "review": {"status": "needs_review", "notes": []},
        "provenance": {
            "sources": provenance.get("sources") or [],
            "notes": provenance.get("notes") or [],
            "retrieved_at": utc_now_iso(),
        },
    }
    return result


def discover_entities(
    *,
    seeds: list[dict[str, Any]],
    bundle: PromptBundle,
    client: Any,
    workers: int = 4,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, str]]]:
    qualified: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []

    def run_one(seed: dict[str, Any]) -> dict[str, Any]:
        variables = {
            "company_name": str(seed.get("name", "")),
            "entity_type": str(seed.get("entity_type", "company")),
            "taxonomy_hint": str(seed.get("taxonomy_hint", "")),
        }
        messages = build_messages(bundle, variables)
        payload = client.call_structured(
            messages=messages,
            schema_name="discover_candidate",
            schema=bundle.schema,
            allowed_domains=None,
            phase="discover",
            trace_context={"company_id": str(seed.get("id") or "")},
        )
        return _normalize_discovery_record(seed, payload)

    max_workers = max(1, workers)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(run_one, seed): seed for seed in seeds}
        for future in as_completed(futures):
            seed = futures[future]
            try:
                record = future.result()
            except Exception as exc:
                failures.append(
                    {
                        "id": str(seed.get("id") or ""),
                        "name": str(seed.get("name") or ""),
                        "error": str(exc),
                    }
                )
                continue
            if record["qualification"]["qualifies"]:
                qualified.append(record)
            else:
                excluded.append(record)
    return qualified, excluded, failures


def write_discovery_output(
    *,
    out_path: Path,
    candidates: list[dict[str, Any]],
    excluded: list[dict[str, Any]],
    failures: list[dict[str, Any]],
) -> dict[str, Any]:
    payload = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": utc_now_iso(),
        "build_mode": "balanced",
        "candidates": candidates,
        "summary": {
            "qualified_count": len(candidates),
            "excluded_count": len(excluded),
            "failure_count": len(failures),
        },
        "excluded": excluded,
        "failures": failures,
    }
    write_json(out_path, payload)
    return payload

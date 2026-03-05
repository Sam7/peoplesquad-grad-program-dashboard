from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
from typing import Any

from recon.logo_resolver import resolve_logo_asset
from recon.models import SCHEMA_VERSION
from recon.prompts import PromptBundle, build_messages
from recon.utils import compute_status, slugify, utc_now_iso, write_json


def select_seed_records(
    records: list[dict[str, Any]], *, approved_only: bool, company_id: str | None
) -> list[dict[str, Any]]:
    selected = records
    if approved_only:
        selected = [r for r in selected if (r.get("review") or {}).get("status") == "approved"]
    if company_id:
        target = company_id.strip().lower()
        selected = [r for r in selected if str(r.get("id", "")).lower() == target]
    return selected


def _merge_sources(*sections: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for section in sections:
        for src in section.get("sources", []) or []:
            key = (str(src.get("title") or ""), str(src.get("url") or ""))
            if key in seen:
                continue
            seen.add(key)
            source = dict(src)
            source.setdefault("retrieved_at", utc_now_iso())
            out.append(source)
    return out


def compose_company_detail(
    candidate: dict[str, Any],
    program_payload: dict[str, Any],
    commercial_payload: dict[str, Any],
    logo: dict[str, Any] | None = None,
) -> dict[str, Any]:
    program = program_payload.get("program") or {}
    eligibility = program_payload.get("eligibility") or {}
    recruitment = program_payload.get("recruitment_process") or {}
    program_prov = (program_payload.get("section_provenance") or {}).get("program") or {}
    eligibility_prov = (program_payload.get("section_provenance") or {}).get("eligibility") or {}
    recruitment_prov = (program_payload.get("section_provenance") or {}).get("recruitment_process") or {}
    commercial = commercial_payload.get("commercial_context") or {}
    commercial_prov = (commercial_payload.get("section_provenance") or {}).get("commercial_context") or {}

    return {
        "schema_version": SCHEMA_VERSION,
        "id": candidate.get("id") or slugify(str(candidate.get("name", ""))),
        "name": candidate.get("name"),
        "entity_type": candidate.get("entity_type", "company"),
        "classification": candidate.get("classification") or {},
        "official_domains": candidate.get("official_domains") or [],
        "urls": candidate.get("urls") or {},
        "logo_url": (logo or {}).get("local_path"),
        "branding": {
            "logo_candidates": ((candidate.get("branding") or {}).get("logo_candidates")) or [],
            "logo": logo,
        },
        "program": program,
        "eligibility": eligibility,
        "recruitment_process": recruitment,
        "commercial_context": commercial,
        "section_provenance": {
            "program": program_prov,
            "eligibility": eligibility_prov,
            "recruitment_process": recruitment_prov,
            "commercial_context": commercial_prov,
        },
        "provenance": {
            "updated_at": utc_now_iso(),
            "sources": _merge_sources(program_prov, eligibility_prov, recruitment_prov, commercial_prov),
            "notes": [],
        },
    }


def build_index_entry(detail: dict[str, Any]) -> dict[str, Any]:
    program = detail.get("program") or {}
    eligibility = detail.get("eligibility") or {}
    status = compute_status(program.get("open_date"), program.get("close_date"))
    return {
        "id": detail.get("id"),
        "name": detail.get("name"),
        "entity_type": detail.get("entity_type"),
        "logo_url": detail.get("logo_url"),
        "career_url": (detail.get("urls") or {}).get("careers_url"),
        "apply": {
            "direct_apply_url": program.get("direct_apply_url"),
            "open_date": program.get("open_date"),
            "close_date": program.get("close_date"),
            "status": status,
        },
        "tags": {
            "streams": program.get("streams") or [],
            "eligibility": [eligibility.get("work_rights")] if eligibility.get("work_rights") else [],
            "industries": [((detail.get("classification") or {}).get("industry_bucket") or "Other")],
        },
        "updated_at": (detail.get("provenance") or {}).get("updated_at"),
        "confidence": ((detail.get("section_provenance") or {}).get("program") or {}).get("confidence", "low"),
    }


def build_prompt_variables(record: dict[str, Any]) -> dict[str, str]:
    return {
        "company_name": str(record.get("name", "")),
        "entity_type": str(record.get("entity_type", "company")),
        "official_domains_json": json.dumps(record.get("official_domains") or []),
        "known_urls_json": json.dumps(record.get("urls") or {}),
        "classification_json": json.dumps(record.get("classification") or {}),
    }


def _extract_one_company(
    *,
    record: dict[str, Any],
    client: Any,
    program_bundle: PromptBundle,
    commercial_bundle: PromptBundle,
    logo_output_dir: Path,
    logo_public_prefix: str,
    logo_filename_template: str,
    logo_timeout_seconds: int,
    skip_logo_download: bool,
    logo_min_source_size: int,
    logo_max_size: int,
    logo_output_format: str,
) -> dict[str, Any]:
    domains = record.get("official_domains") or []
    if not domains:
        raise ValueError("official_domains is required for extraction.")

    vars_common = build_prompt_variables(record)
    program_payload = client.call_structured(
        messages=build_messages(program_bundle, vars_common),
        schema_name="extract_program",
        schema=program_bundle.schema,
        allowed_domains=domains,
        phase="build",
        trace_context={"company_id": str(record.get("id") or "")},
    )
    commercial_payload = client.call_structured(
        messages=build_messages(commercial_bundle, vars_common),
        schema_name="extract_commercial",
        schema=commercial_bundle.schema,
        allowed_domains=domains,
        phase="build",
        trace_context={"company_id": str(record.get("id") or "")},
    )
    logo = resolve_logo_asset(
        company_id=str(record.get("id") or slugify(str(record.get("name") or ""))),
        company_name=str(record.get("name") or ""),
        official_domains=domains,
        logo_candidates=(((record.get("branding") or {}).get("logo_candidates")) or []),
        known_page_urls=[
            str(((record.get("urls") or {}).get("careers_url")) or ""),
            str(((record.get("urls") or {}).get("grad_program_url")) or ""),
            str(((record.get("urls") or {}).get("investor_relations_url")) or ""),
        ],
        output_dir=logo_output_dir,
        public_prefix=logo_public_prefix,
        filename_template=logo_filename_template,
        timeout_seconds=logo_timeout_seconds,
        skip_download=skip_logo_download,
        min_source_size=logo_min_source_size,
        max_size=logo_max_size,
        output_format=logo_output_format,
    )
    return compose_company_detail(record, program_payload, commercial_payload, logo)


def build_company_details(
    *,
    records: list[dict[str, Any]],
    client: Any,
    program_bundle: PromptBundle,
    commercial_bundle: PromptBundle,
    workers: int = 4,
    logo_output_dir: Path | None = None,
    logo_public_prefix: str = "assets/logos",
    logo_filename_template: str = "{id}-peoplesquad-logo.webp",
    logo_timeout_seconds: int = 20,
    skip_logo_download: bool = False,
    logo_min_source_size: int = 96,
    logo_max_size: int = 512,
    logo_output_format: str = "webp",
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    details: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    resolved_logo_output_dir = logo_output_dir or Path("data") / "assets" / "logos"
    with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        futures = {
            executor.submit(
                _extract_one_company,
                record=record,
                client=client,
                program_bundle=program_bundle,
                commercial_bundle=commercial_bundle,
                logo_output_dir=resolved_logo_output_dir,
                logo_public_prefix=logo_public_prefix,
                logo_filename_template=logo_filename_template,
                logo_timeout_seconds=logo_timeout_seconds,
                skip_logo_download=skip_logo_download,
                logo_min_source_size=logo_min_source_size,
                logo_max_size=logo_max_size,
                logo_output_format=logo_output_format,
            ): record
            for record in records
        }
        for future in as_completed(futures):
            record = futures[future]
            try:
                details.append(future.result())
            except Exception as exc:
                failures.append(
                    {
                        "id": str(record.get("id") or ""),
                        "name": str(record.get("name") or ""),
                        "error": str(exc),
                    }
                )
    return details, failures


def write_build_outputs(
    *,
    out_dir: Path,
    details: list[dict[str, Any]],
    failures: list[dict[str, Any]],
    model: str,
    approved_snapshot: list[dict[str, Any]],
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    companies_dir = out_dir / "companies"
    companies_dir.mkdir(parents=True, exist_ok=True)

    index_companies = []
    for detail in details:
        write_json(companies_dir / f"{detail['id']}.json", detail)
        index_companies.append(build_index_entry(detail))

    write_json(
        out_dir / "index.json",
        {
            "schema_version": SCHEMA_VERSION,
            "generated_at": utc_now_iso(),
            "companies": sorted(index_companies, key=lambda x: str(x.get("name", "")).lower()),
        },
    )
    write_json(
        out_dir / "build_meta.json",
        {
            "schema_version": SCHEMA_VERSION,
            "generated_at": utc_now_iso(),
            "model": model,
            "company_count": len(details),
            "failure_count": len(failures),
            "failures": failures,
        },
    )
    write_json(out_dir / "discovery" / "approved_seed_snapshot.json", approved_snapshot)

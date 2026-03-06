from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
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


def _json_hash(payload: Any) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _company_id(record: dict[str, Any]) -> str:
    return str(record.get("id") or slugify(str(record.get("name", ""))))


def _state_company_path(state_dir: Path, company_id: str) -> Path:
    return state_dir / "companies" / f"{company_id}.json"


def _state_checkpoint_path(state_dir: Path, company_id: str, stage: str) -> Path:
    return state_dir / "checkpoints" / company_id / f"{stage}.json"


def _load_json_if_exists(path: Path) -> Any | None:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def compute_build_fingerprint(
    *,
    record: dict[str, Any],
    model: str,
    program_bundle: PromptBundle,
    commercial_bundle: PromptBundle,
    logo_settings: dict[str, Any],
) -> str:
    payload = {
        "record": record,
        "model": model,
        "program_prompt": {
            "system": program_bundle.system,
            "user": program_bundle.user,
            "schema": program_bundle.schema,
        },
        "commercial_prompt": {
            "system": commercial_bundle.system,
            "user": commercial_bundle.user,
            "schema": commercial_bundle.schema,
        },
        "logo_settings": logo_settings,
        "schema_version": SCHEMA_VERSION,
    }
    return _json_hash(payload)


def select_records_for_processing(
    *,
    records: list[dict[str, Any]],
    out_dir: Path,
    state_dir: Path,
    model: str,
    program_bundle: PromptBundle,
    commercial_bundle: PromptBundle,
    resume: bool,
    force_rebuild: bool,
    max_companies: int | None,
    logo_settings: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if max_companies is not None and max_companies <= 0:
        raise ValueError("--max-companies must be greater than 0.")

    pending: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    companies_dir = out_dir / "companies"
    for record in records:
        if not resume or force_rebuild:
            pending.append(record)
            continue
        company_id = _company_id(record)
        fingerprint = compute_build_fingerprint(
            record=record,
            model=model,
            program_bundle=program_bundle,
            commercial_bundle=commercial_bundle,
            logo_settings=logo_settings,
        )
        state = _load_json_if_exists(_state_company_path(state_dir, company_id)) or {}
        company_file = companies_dir / f"{company_id}.json"
        if not state and company_file.exists():
            skipped.append(record)
            continue
        if (
            state.get("status") == "completed"
            and state.get("fingerprint") == fingerprint
            and company_file.exists()
        ):
            skipped.append(record)
            continue
        pending.append(record)
    if max_companies is not None:
        pending = pending[:max_companies]
    return pending, skipped


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
    out_dir: Path,
    state_dir: Path,
    model: str,
    fingerprint: str,
    resume: bool,
    force_rebuild: bool,
    logo_failure_mode: str,
    logo_output_dir: Path,
    logo_public_prefix: str,
    logo_filename_template: str,
    logo_timeout_seconds: int,
    skip_logo_download: bool,
    logo_min_source_size: int,
    logo_max_size: int,
    logo_output_format: str,
) -> dict[str, Any]:
    company_id = _company_id(record)
    domains = record.get("official_domains") or []
    if not domains:
        raise ValueError("official_domains is required for extraction.")
    companies_dir = out_dir / "companies"
    companies_dir.mkdir(parents=True, exist_ok=True)
    state_path = _state_company_path(state_dir, company_id)
    state = _load_json_if_exists(state_path) or {}
    previous_fingerprint = state.get("fingerprint")
    can_resume_stage_checkpoints = bool(
        resume and not force_rebuild and previous_fingerprint == fingerprint
    )
    state.update(
        {
            "company_id": company_id,
            "fingerprint": fingerprint,
            "model": model,
            "status": "in_progress",
            "stages": state.get("stages") or {},
        }
    )
    write_json(state_path, state)

    vars_common = build_prompt_variables(record)
    stage_errors: list[str] = []
    warnings: list[str] = []

    def stage_payload(
        *,
        stage: str,
        schema_name: str,
        schema: dict[str, Any],
        bundle: PromptBundle,
    ) -> dict[str, Any]:
        checkpoint = _state_checkpoint_path(state_dir, company_id, stage)
        current = _load_json_if_exists(state_path) or {}
        checkpoint_state = ((current.get("stages") or {}).get(stage)) or {}
        if (
            can_resume_stage_checkpoints
            and checkpoint_state.get("status") == "completed"
            and checkpoint.exists()
        ):
            payload = _load_json_if_exists(checkpoint)
            if isinstance(payload, dict):
                return payload
        try:
            payload = client.call_structured(
                messages=build_messages(bundle, vars_common),
                schema_name=schema_name,
                schema=schema,
                allowed_domains=domains,
                phase="build",
                trace_context={"company_id": company_id},
            )
            if not isinstance(payload, dict):
                raise RuntimeError(f"{schema_name} returned non-object payload.")
            write_json(checkpoint, payload)
            latest = _load_json_if_exists(state_path) or {}
            latest_stages = latest.get("stages") or {}
            latest_stages[stage] = {"status": "completed", "checkpoint": str(checkpoint)}
            latest["stages"] = latest_stages
            write_json(state_path, latest)
            return payload
        except Exception as exc:
            latest = _load_json_if_exists(state_path) or {}
            latest_stages = latest.get("stages") or {}
            latest_stages[stage] = {"status": "failed", "error": str(exc)}
            latest["status"] = "failed"
            latest["stages"] = latest_stages
            latest["last_error"] = str(exc)
            write_json(state_path, latest)
            raise

    program_payload = stage_payload(
        stage="program",
        schema_name="extract_program",
        schema=program_bundle.schema,
        bundle=program_bundle,
    )
    commercial_payload = stage_payload(
        stage="commercial",
        schema_name="extract_commercial",
        schema=commercial_bundle.schema,
        bundle=commercial_bundle,
    )

    logo: dict[str, Any] | None = None
    try:
        logo = resolve_logo_asset(
            company_id=company_id,
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
        latest = _load_json_if_exists(state_path) or {}
        latest_stages = latest.get("stages") or {}
        latest_stages["logo"] = {"status": "completed"}
        latest["stages"] = latest_stages
        write_json(state_path, latest)
    except Exception as exc:
        if logo_failure_mode == "fail":
            latest = _load_json_if_exists(state_path) or {}
            latest_stages = latest.get("stages") or {}
            latest_stages["logo"] = {"status": "failed", "error": str(exc)}
            latest["status"] = "failed"
            latest["stages"] = latest_stages
            latest["last_error"] = str(exc)
            write_json(state_path, latest)
            raise
        warnings.append(f"logo: {exc}")
        stage_errors.append(str(exc))
        latest = _load_json_if_exists(state_path) or {}
        latest_stages = latest.get("stages") or {}
        latest_stages["logo"] = {"status": "warning", "error": str(exc)}
        latest["stages"] = latest_stages
        write_json(state_path, latest)

    detail = compose_company_detail(record, program_payload, commercial_payload, logo)
    if warnings:
        provenance = detail.get("provenance") or {}
        notes = provenance.get("notes") or []
        provenance["notes"] = notes + warnings
        detail["provenance"] = provenance
    write_json(companies_dir / f"{company_id}.json", detail)
    latest = _load_json_if_exists(state_path) or {}
    latest["status"] = "completed"
    latest["output_path"] = str(companies_dir / f"{company_id}.json")
    latest["stage_errors"] = stage_errors
    write_json(state_path, latest)
    return detail


def build_company_details(
    *,
    records: list[dict[str, Any]],
    client: Any,
    program_bundle: PromptBundle,
    commercial_bundle: PromptBundle,
    out_dir: Path = Path("data"),
    state_dir: Path = Path("data") / ".recon-state",
    model: str = "unknown",
    resume: bool = True,
    force_rebuild: bool = False,
    logo_failure_mode: str = "warn",
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
    logo_settings = {
        "logo_public_prefix": logo_public_prefix,
        "logo_filename_template": logo_filename_template,
        "logo_max_size": logo_max_size,
        "logo_min_source_size": logo_min_source_size,
        "logo_format": logo_output_format,
        "skip_logo_download": skip_logo_download,
    }
    with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        futures = {
            executor.submit(
                _extract_one_company,
                record=record,
                client=client,
                program_bundle=program_bundle,
                commercial_bundle=commercial_bundle,
                out_dir=out_dir,
                state_dir=state_dir,
                model=model,
                fingerprint=compute_build_fingerprint(
                    record=record,
                    model=model,
                    program_bundle=program_bundle,
                    commercial_bundle=commercial_bundle,
                    logo_settings=logo_settings,
                ),
                resume=resume,
                force_rebuild=force_rebuild,
                logo_failure_mode=logo_failure_mode,
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
    selected_count: int | None = None,
    skipped_count: int | None = None,
    scheduled_count: int | None = None,
    requested_max_companies: int | None = None,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    companies_dir = out_dir / "companies"
    companies_dir.mkdir(parents=True, exist_ok=True)

    for detail in details:
        write_json(companies_dir / f"{detail['id']}.json", detail)

    all_details: list[dict[str, Any]] = []
    for path in sorted(companies_dir.glob("*.json")):
        payload = _load_json_if_exists(path)
        if isinstance(payload, dict):
            all_details.append(payload)

    index_companies = [build_index_entry(detail) for detail in all_details]

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
            "company_count": len(all_details),
            "failure_count": len(failures),
            "failures": failures,
            "selected_count": selected_count,
            "skipped_count": skipped_count,
            "scheduled_count": scheduled_count,
            "requested_max_companies": requested_max_companies,
        },
    )
    write_json(out_dir / "discovery" / "approved_seed_snapshot.json", approved_snapshot)

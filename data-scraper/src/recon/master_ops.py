from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

from recon.models import REVIEW_STATUS_VALUES, SCHEMA_VERSION
from recon.utils import slugify, utc_now_iso


def parse_names_text(text: str) -> list[str]:
    names: list[str] = []
    for line in text.splitlines():
        line_txt = line.strip()
        if not line_txt or line_txt.startswith("#"):
            continue
        for part in line_txt.split(";"):
            txt = part.strip()
            if not txt:
                continue
            names.append(txt)
    return names


def load_names_file(path: Path) -> list[str]:
    return parse_names_text(path.read_text(encoding="utf-8"))


def seed_records_from_names(
    names: list[str], *, entity_type: str = "company", taxonomy_hint: str = ""
) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for raw in names:
        name = str(raw).strip()
        if not name:
            continue
        item_id = slugify(name)
        key = item_id.lower()
        if key in seen_ids:
            continue
        out.append(
            {
                "id": item_id,
                "name": name,
                "entity_type": entity_type,
                "taxonomy_hint": taxonomy_hint,
            }
        )
        seen_ids.add(key)
    return out


def _candidate_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        candidates = payload.get("candidates")
        if isinstance(candidates, list):
            return [item for item in candidates if isinstance(item, dict)]
        raise ValueError("Expected payload with a 'candidates' list.")
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    raise ValueError("Unsupported payload type; expected object or array.")


def _normalize_review(record: dict[str, Any], *, default_review_status: str) -> None:
    review = record.get("review")
    status = default_review_status
    notes: list[Any] = []
    if isinstance(review, dict):
        raw_status = str(review.get("status") or "").strip()
        if raw_status in REVIEW_STATUS_VALUES:
            status = raw_status
        raw_notes = review.get("notes")
        if isinstance(raw_notes, list):
            notes = raw_notes
    record["review"] = {"status": status, "notes": notes}


def _normalize_candidate_for_master(
    candidate: dict[str, Any], *, default_review_status: str
) -> dict[str, Any]:
    out = deepcopy(candidate)
    name = str(out.get("name") or "").strip()
    item_id = str(out.get("id") or slugify(name)).strip()
    if not item_id:
        raise ValueError("Candidate is missing id/name and cannot be normalized.")
    if not name:
        name = item_id
    out["id"] = item_id
    out["name"] = name
    _normalize_review(out, default_review_status=default_review_status)
    return out


def merge_candidate_payloads(
    *,
    master_payload: Any,
    incoming_payload: Any,
    duplicate_policy: str = "keep-existing",
    default_review_status: str = "needs_review",
) -> tuple[dict[str, Any], dict[str, int]]:
    if duplicate_policy != "keep-existing":
        raise ValueError("Only duplicate_policy='keep-existing' is currently supported.")
    if default_review_status not in REVIEW_STATUS_VALUES:
        raise ValueError(
            f"default_review_status must be one of {REVIEW_STATUS_VALUES}, got: {default_review_status}"
        )

    if isinstance(master_payload, dict):
        merged_payload = deepcopy(master_payload)
    else:
        merged_payload = {
            "schema_version": SCHEMA_VERSION,
            "generated_at": utc_now_iso(),
            "build_mode": "balanced",
            "candidates": _candidate_list(master_payload),
            "summary": {},
            "excluded": [],
            "failures": [],
        }

    master_candidates_raw = _candidate_list(merged_payload)
    master_candidates: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    duplicate_master_ids = 0
    for candidate in master_candidates_raw:
        normalized = _normalize_candidate_for_master(
            candidate,
            default_review_status=default_review_status,
        )
        key = normalized["id"].lower()
        if key in seen_ids:
            duplicate_master_ids += 1
            continue
        seen_ids.add(key)
        master_candidates.append(normalized)

    added_count = 0
    duplicate_kept_count = 0
    for incoming in _candidate_list(incoming_payload):
        normalized = _normalize_candidate_for_master(
            incoming,
            default_review_status=default_review_status,
        )
        key = normalized["id"].lower()
        if key in seen_ids:
            duplicate_kept_count += 1
            continue
        seen_ids.add(key)
        master_candidates.append(normalized)
        added_count += 1

    merged_payload["schema_version"] = merged_payload.get("schema_version") or SCHEMA_VERSION
    merged_payload["generated_at"] = utc_now_iso()
    merged_payload["build_mode"] = merged_payload.get("build_mode") or "balanced"
    merged_payload["candidates"] = master_candidates

    excluded = merged_payload.get("excluded")
    failures = merged_payload.get("failures")
    summary = merged_payload.get("summary")
    if not isinstance(summary, dict):
        summary = {}
    summary["qualified_count"] = len(master_candidates)
    summary["excluded_count"] = len(excluded) if isinstance(excluded, list) else int(
        summary.get("excluded_count") or 0
    )
    summary["failure_count"] = len(failures) if isinstance(failures, list) else int(
        summary.get("failure_count") or 0
    )
    merged_payload["summary"] = summary
    if not isinstance(merged_payload.get("excluded"), list):
        merged_payload["excluded"] = []
    if not isinstance(merged_payload.get("failures"), list):
        merged_payload["failures"] = []

    report = {
        "added_count": added_count,
        "duplicate_kept_count": duplicate_kept_count,
        "duplicate_master_pruned_count": duplicate_master_ids,
        "final_count": len(master_candidates),
    }
    return merged_payload, report

from __future__ import annotations

from pathlib import Path
from typing import Any

from recon.utils import read_json


def generate_discovery_report(
    *,
    qualified: list[dict[str, Any]],
    excluded: list[dict[str, Any]],
    failures: list[dict[str, Any]],
) -> str:
    lines = [
        "# Discovery Report",
        "",
        f"- Qualified: {len(qualified)}",
        f"- Excluded: {len(excluded)}",
        f"- Failures: {len(failures)}",
        "",
        "## Excluded",
    ]
    if excluded:
        for item in excluded:
            reason = ((item.get("qualification") or {}).get("reason")) or "No reason provided."
            lines.append(f"- `{item.get('id', '')}`: {reason}")
    else:
        lines.append("- None")

    lines.append("")
    lines.append("## Failures")
    if failures:
        for item in failures:
            lines.append(f"- `{item.get('id', '')}`: {item.get('error', 'Unknown error')}")
    else:
        lines.append("- None")
    lines.append("")
    return "\n".join(lines)


def _missing_counts(details: list[dict[str, Any]]) -> dict[str, int]:
    missing_apply = 0
    missing_close = 0
    missing_work_rights = 0
    missing_logo = 0
    for detail in details:
        program = detail.get("program") or {}
        eligibility = detail.get("eligibility") or {}
        if not program.get("direct_apply_url"):
            missing_apply += 1
        if not program.get("close_date"):
            missing_close += 1
        if not eligibility.get("work_rights"):
            missing_work_rights += 1
        if not detail.get("logo_url"):
            missing_logo += 1
    return {
        "missing_apply": missing_apply,
        "missing_close": missing_close,
        "missing_work_rights": missing_work_rights,
        "missing_logo": missing_logo,
    }


def generate_build_report(*, details: list[dict[str, Any]], failures: list[dict[str, Any]]) -> str:
    missing = _missing_counts(details)
    lines = [
        "# Build Report",
        "",
        f"- Companies built: {len(details)}",
        f"- Failures: {len(failures)}",
        "",
        "## Missing Data",
        f"- Missing direct apply URL: {missing['missing_apply']}",
        f"- Missing close date: {missing['missing_close']}",
        f"- Missing work rights: {missing['missing_work_rights']}",
        f"- Missing logo: {missing['missing_logo']}",
        "",
        "## Failures",
    ]
    if failures:
        for item in failures:
            lines.append(f"- `{item.get('id', '')}`: {item.get('error', 'Unknown error')}")
    else:
        lines.append("- None")
    lines.append("")
    return "\n".join(lines)


def generate_report_from_data(*, data_dir: Path, out_path: Path) -> None:
    companies_dir = data_dir / "companies"
    details = [read_json(path) for path in sorted(companies_dir.glob("*.json"))]
    failures: list[dict[str, Any]] = []
    build_meta = data_dir / "build_meta.json"
    if build_meta.exists():
        meta = read_json(build_meta)
        failures = (meta.get("failures") or []) if isinstance(meta, dict) else []
    report = generate_build_report(details=details, failures=failures)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(report, encoding="utf-8")

from __future__ import annotations

import calendar
import datetime as dt
import json
import re
from pathlib import Path
from typing import Any

_MONTH_NAME_TO_NUMBER = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}

_MONTH_YEAR_PATTERN = re.compile(r"^([A-Za-z.]+)\s+(\d{4})$")
_MONTH_ONLY_PATTERN = re.compile(r"^([A-Za-z.]+)$")


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def slugify(value: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return clean.strip("-") or "item"


def _normalize_month_token(value: str) -> str:
    return value.strip().lower().rstrip(".")


def _parse_month(value: str) -> int | None:
    return _MONTH_NAME_TO_NUMBER.get(_normalize_month_token(value))


def _parse_exact_date(cleaned: str) -> dt.date | None:
    try:
        return dt.date.fromisoformat(cleaned)
    except ValueError:
        pass

    # Support ISO datetime variants such as 2026-03-29T23:59:00+11:00 / Z.
    iso_candidate = cleaned.replace("Z", "+00:00")
    try:
        return dt.datetime.fromisoformat(iso_candidate).date()
    except ValueError:
        pass

    # Support natural language dates used by source pages.
    for fmt in ("%d %B %Y", "%d %b %Y"):
        try:
            return dt.datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue

    return None


def _parse_month_year(cleaned: str) -> tuple[int, int] | None:
    match = _MONTH_YEAR_PATTERN.match(cleaned)
    if not match:
        return None
    month_token, year_raw = match.groups()
    month = _parse_month(month_token)
    if month is None:
        return None
    return int(year_raw), month


def _parse_month_only(cleaned: str) -> int | None:
    match = _MONTH_ONLY_PATTERN.match(cleaned)
    if not match:
        return None
    return _parse_month(match.group(1))


def parse_date(date_str: str | None) -> dt.date | None:
    if not date_str:
        return None
    cleaned = date_str.strip()
    if not cleaned:
        return None

    exact = _parse_exact_date(cleaned)
    if exact:
        return exact

    month_year = _parse_month_year(cleaned)
    if month_year:
        year, month = month_year
        return dt.date(year, month, 1)

    month = _parse_month_only(cleaned)
    if month:
        return dt.date(dt.date.today().year, month, 1)

    return None


def compute_status(open_date: str | None, close_date: str | None, *, today: dt.date | None = None) -> str:
    ref = today or dt.date.today()
    open_d = parse_date(open_date)
    close_d = parse_date(close_date)
    if open_d and close_d:
        if ref < open_d:
            return "upcoming"
        if ref > close_d:
            return "closed"
        return "open"
    if open_d:
        return "upcoming" if ref < open_d else "open"
    if close_d:
        return "open" if ref <= close_d else "closed"
    return "unknown"


def _last_day_of_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _normalize_single_program_date(
    *,
    date_value: str | None,
    raw_value: str | None,
    reference_date: dt.date,
    is_close_date: bool,
) -> tuple[str | None, str, str | None]:
    raw_candidate = (raw_value or "").strip() or (date_value or "").strip() or None
    if raw_candidate is None:
        return None, "missing", None

    candidates = [raw_candidate]
    date_candidate = (date_value or "").strip()
    if date_candidate and date_candidate != raw_candidate:
        candidates.append(date_candidate)

    for candidate in candidates:
        exact = _parse_exact_date(candidate)
        if exact:
            return exact.isoformat(), "exact_day", raw_candidate

        month_year = _parse_month_year(candidate)
        if month_year:
            year, month = month_year
            day = _last_day_of_month(year, month) if is_close_date else 1
            return dt.date(year, month, day).isoformat(), "month_year_normalized", raw_candidate

        month = _parse_month_only(candidate)
        if month:
            year = reference_date.year
            day = _last_day_of_month(year, month) if is_close_date else 1
            return dt.date(year, month, day).isoformat(), "month_assumed_current_year", raw_candidate

    return None, "unparseable", raw_candidate


def normalize_program_dates(
    program: dict[str, Any], *, reference_date: dt.date | None = None
) -> dict[str, Any]:
    normalized = dict(program)
    ref = reference_date or dt.date.today()

    open_date, open_precision, open_raw = _normalize_single_program_date(
        date_value=program.get("open_date"),
        raw_value=program.get("open_date_raw"),
        reference_date=ref,
        is_close_date=False,
    )
    close_date, close_precision, close_raw = _normalize_single_program_date(
        date_value=program.get("close_date"),
        raw_value=program.get("close_date_raw"),
        reference_date=ref,
        is_close_date=True,
    )

    normalized["open_date"] = open_date
    normalized["close_date"] = close_date
    normalized["open_date_precision"] = open_precision
    normalized["close_date_precision"] = close_precision
    normalized["open_date_raw"] = open_raw
    normalized["close_date_raw"] = close_raw
    return normalized


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def unique_str_list(values: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        txt = str(value).strip()
        if not txt:
            continue
        if txt in seen:
            continue
        out.append(txt)
        seen.add(txt)
    return out

from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from typing import Any


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def slugify(value: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return clean.strip("-") or "item"


def parse_date(date_str: str | None) -> dt.date | None:
    if not date_str:
        return None
    cleaned = date_str.strip()
    if not cleaned:
        return None

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

from __future__ import annotations

import mimetypes
import re
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_host(url: str) -> str:
    return (urlparse(url).hostname or "").strip().lower()


def _normalize_domain(domain: str) -> str:
    return domain.strip().lower().lstrip(".")


def is_official_logo_url(url: str, official_domains: list[str]) -> bool:
    host = _normalize_host(url)
    if not host:
        return False
    for domain in official_domains:
        norm = _normalize_domain(domain)
        if not norm:
            continue
        if host == norm or host.endswith(f".{norm}"):
            return True
    return False


def _is_favicon_like_url(url: str) -> bool:
    path = (urlparse(url).path or "").lower()
    tokens = [
        "favicon",
        "apple-touch-icon",
        "apple-icon",
        "android-chrome",
        "android-icon",
        "mstile",
        "site.webmanifest",
        "icon-",
        "/icons/",
    ]
    return any(token in path for token in tokens)


def _has_brand_logo_signal(url: str) -> bool:
    path = (urlparse(url).path or "").lower()
    return any(token in path for token in ["logo", "brand", "wordmark", "logotype"])


def _extension_score(url: str) -> int:
    path = (urlparse(url).path or "").lower()
    if path.endswith(".svg"):
        return 30
    if path.endswith(".webp"):
        return 18
    if path.endswith(".png"):
        return 15
    if path.endswith(".jpg") or path.endswith(".jpeg"):
        return 12
    if path.endswith(".ico"):
        return -50
    return 5


def _candidate_score(url: str) -> int:
    score = _extension_score(url)
    if _has_brand_logo_signal(url):
        score += 40
    if _is_favicon_like_url(url):
        score -= 200
    return score


def _extract_logo_candidates_with_reason(base_url: str, html: str) -> list[tuple[str, str]]:
    patterns = [
        (
            "fallback_og_image",
            r'<meta[^>]+(?:property|name)=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        ),
        (
            "brand_logo",
            r'<img[^>]+(?:class|id)=["\'][^"\']*(?:logo|brand|wordmark)[^"\']*["\'][^>]+src=["\']([^"\']+)["\']',
        ),
        ("fallback_icon", r'<link[^>]+rel=["\'][^"\']*icon[^"\']*["\'][^>]+href=["\']([^"\']+)["\']'),
    ]
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for reason, pattern in patterns:
        for match in re.finditer(pattern, html, flags=re.IGNORECASE):
            src = (match.group(1) or "").strip()
            if not src:
                continue
            absolute = urljoin(base_url, src)
            if absolute in seen:
                continue
            seen.add(absolute)
            out.append((absolute, reason))
    return out


def extract_logo_candidates_from_html(base_url: str, html: str) -> list[str]:
    return [url for url, _ in _extract_logo_candidates_with_reason(base_url, html)]


def select_best_logo_candidate(candidates: list[str], official_domains: list[str]) -> str | None:
    official = [c for c in candidates if is_official_logo_url(c, official_domains)]
    if not official:
        return None
    ranked = sorted(official, key=lambda x: (_candidate_score(x), len(x)), reverse=True)
    return ranked[0]


def build_logo_filename(company_id: str, extension: str, filename_template: str) -> str:
    ext = extension.lower().lstrip(".") or "webp"
    return filename_template.format(id=company_id, ext=ext)


def _default_fetcher(url: str, timeout_seconds: int) -> tuple[bytes, str | None]:
    request = Request(url, headers={"User-Agent": "PeopleSquadRecon/0.1"})
    with urlopen(request, timeout=timeout_seconds) as resp:  # nosec B310
        data = resp.read()
        content_type = resp.headers.get("Content-Type")
    return data, content_type


def _decode_image(data: bytes, mime_type: str | None, source_url: str):
    from PIL import Image

    mime = (mime_type or "").lower()
    is_svg = "image/svg+xml" in mime or (urlparse(source_url).path or "").lower().endswith(".svg")

    if is_svg:
        try:
            import cairosvg

            png_bytes = cairosvg.svg2png(bytestring=data)
            image = Image.open(BytesIO(png_bytes))
            image.load()
            return image.convert("RGBA")
        except Exception:
            pass

    image = Image.open(BytesIO(data))
    image.load()
    return image.convert("RGBA")


def _normalize_to_square(image, max_size: int):
    from PIL import Image

    resized = image.copy()
    resampling = getattr(Image, "Resampling", Image)
    if resized.width == 0 or resized.height == 0:
        raise ValueError("Invalid logo dimensions.")
    scale = min(max_size / resized.width, max_size / resized.height)
    new_width = max(1, int(round(resized.width * scale)))
    new_height = max(1, int(round(resized.height * scale)))
    resized = resized.resize((new_width, new_height), resampling.LANCZOS)
    canvas = Image.new("RGBA", (max_size, max_size), (0, 0, 0, 0))
    x = (max_size - resized.width) // 2
    y = (max_size - resized.height) // 2
    canvas.paste(resized, (x, y), resized if resized.mode in ("RGBA", "LA") else None)
    return canvas


def _quality_score(source_w: int, source_h: int, source_url: str, reason: str) -> float:
    score = 0.5
    if reason == "brand_logo" or _has_brand_logo_signal(source_url):
        score += 0.25
    if min(source_w, source_h) >= 512:
        score += 0.2
    elif min(source_w, source_h) >= 256:
        score += 0.15
    elif min(source_w, source_h) >= 128:
        score += 0.1
    if (urlparse(source_url).path or "").lower().endswith(".svg"):
        score += 0.05
    if _is_favicon_like_url(source_url):
        score -= 0.5
    return max(0.0, min(1.0, round(score, 2)))


def resolve_logo_asset(
    *,
    company_id: str,
    company_name: str,
    official_domains: list[str],
    logo_candidates: list[str],
    known_page_urls: list[str] | None = None,
    output_dir: Path,
    public_prefix: str,
    filename_template: str,
    timeout_seconds: int = 20,
    fetcher: Callable[[str, int], tuple[bytes, str | None]] | None = None,
    skip_download: bool = False,
    min_source_size: int = 96,
    max_size: int = 512,
    output_format: str = "webp",
) -> dict | None:
    fetch = fetcher or _default_fetcher
    candidate_pairs: list[tuple[str, str]] = [(url, "discover") for url in logo_candidates]

    if known_page_urls:
        for page_url in known_page_urls:
            if not page_url or not is_official_logo_url(page_url, official_domains):
                continue
            try:
                content, content_type = fetch(page_url, timeout_seconds)
            except Exception:
                continue
            content_lower = content[:2048].lower()
            if (content_type or "").lower().startswith("text/html") or b"<html" in content_lower:
                html = content.decode("utf-8", errors="ignore")
                candidate_pairs.extend(_extract_logo_candidates_with_reason(page_url, html))

    dedup: dict[str, str] = {}
    for url, reason in candidate_pairs:
        if url not in dedup:
            dedup[url] = reason
    ranked = sorted(dedup.keys(), key=lambda u: (_candidate_score(u), len(u)), reverse=True)

    for source_url in ranked:
        if not is_official_logo_url(source_url, official_domains):
            continue
        try:
            data, mime_type = fetch(source_url, timeout_seconds)
            image = _decode_image(data, mime_type, source_url)
        except Exception:
            continue

        source_w, source_h = image.width, image.height
        if min(source_w, source_h) < min_source_size:
            continue

        if skip_download:
            reason = dedup.get(source_url, "discover")
            return {
                "local_path": None,
                "source_url": source_url,
                "mime_type": mime_type,
                "filename": None,
                "format": output_format,
                "source_width": source_w,
                "source_height": source_h,
                "output_width": max_size,
                "output_height": max_size,
                "confidence": "medium",
                "quality_score": _quality_score(source_w, source_h, source_url, reason),
                "selection_reason": reason,
                "retrieved_at": _utc_now_iso(),
                "notes": ["Logo download skipped by CLI flag."],
            }

        normalized = _normalize_to_square(image, max_size)
        filename = build_logo_filename(company_id, output_format, filename_template)
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / filename
        normalized.save(out_path, format=output_format.upper(), lossless=True, quality=85, method=6)

        prefix = public_prefix.strip().rstrip("/")
        local_path = f"{prefix}/{filename}" if prefix else filename
        reason = dedup.get(source_url, "discover")
        return {
            "local_path": local_path,
            "source_url": source_url,
            "mime_type": f"image/{output_format}",
            "filename": filename,
            "format": output_format,
            "source_width": source_w,
            "source_height": source_h,
            "output_width": max_size,
            "output_height": max_size,
            "confidence": "high" if _quality_score(source_w, source_h, source_url, reason) >= 0.8 else "medium",
            "quality_score": _quality_score(source_w, source_h, source_url, reason),
            "selection_reason": reason,
            "retrieved_at": _utc_now_iso(),
            "notes": [],
        }
    return None

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import re
import threading
import time
from time import perf_counter
from typing import Any

from openai import OpenAI

from recon.config import OpenAISettings
from recon.usage import UsageEvent, UsageTracker


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(cleaned[start : end + 1])


def _utc_now_compact() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")


def _slug_component(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip().lower())
    return cleaned.strip("-") or "unknown"


def _to_serializable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _to_serializable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_serializable(v) for v in value]
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        try:
            return _to_serializable(model_dump())
        except Exception:
            pass
    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        try:
            return _to_serializable(to_dict())
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        try:
            return _to_serializable(vars(value))
        except Exception:
            pass
    return repr(value)


def _is_retryable_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None)
    if isinstance(status_code, int):
        if status_code == 429:
            return True
        if status_code >= 500:
            return True
        return False
    message = str(exc).lower()
    if "timeout" in message:
        return True
    if "connection" in message:
        return True
    if "temporar" in message:
        return True
    if "no response output returned by model" in message:
        return True
    if isinstance(exc, json.JSONDecodeError):
        return True
    return False


class OpenAIWebSearchClient:
    def __init__(
        self,
        api_key: str,
        settings: OpenAISettings,
        usage_tracker: UsageTracker | None = None,
        request_archive_dir: Path | None = None,
        request_archive_enabled: bool = False,
    ):
        self._settings = settings
        self._client = OpenAI(api_key=api_key, timeout=settings.request_timeout_seconds)
        self._usage_tracker = usage_tracker
        self._request_archive_dir = request_archive_dir
        self._request_archive_enabled = bool(request_archive_enabled and request_archive_dir)
        self._archive_lock = threading.Lock()
        self._archive_sequence = 0

    def set_usage_tracker(self, tracker: UsageTracker | None) -> None:
        self._usage_tracker = tracker

    @staticmethod
    def _coerce_get(obj: Any, key: str, default: Any = None) -> Any:
        if obj is None:
            return default
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    @classmethod
    def _extract_usage_parts(cls, response: Any) -> tuple[int, int, int]:
        usage = cls._coerce_get(response, "usage", None)
        input_tokens = int(cls._coerce_get(usage, "input_tokens", 0) or 0)
        output_tokens = int(cls._coerce_get(usage, "output_tokens", 0) or 0)
        details = cls._coerce_get(usage, "input_tokens_details", None)
        cached_tokens = int(cls._coerce_get(details, "cached_tokens", 0) or 0)
        return input_tokens, cached_tokens, output_tokens

    @staticmethod
    def _count_web_search_calls(response: Any) -> int:
        output_items = getattr(response, "output", None) or []
        count = 0
        for item in output_items:
            if isinstance(item, dict):
                item_type = item.get("type")
            else:
                item_type = getattr(item, "type", None)
            if item_type == "web_search_call":
                count += 1
        return count

    def _archive_attempt_dir(
        self,
        *,
        phase: str | None,
        company_id: str | None,
        schema_name: str,
        attempt: int,
    ) -> Path | None:
        if not self._request_archive_enabled or not self._request_archive_dir:
            return None
        with self._archive_lock:
            self._archive_sequence += 1
            seq = self._archive_sequence
        folder_name = (
            f"{_utc_now_compact()}-seq{seq:06d}-"
            f"{_slug_component(phase or 'unknown')}-"
            f"{_slug_component(company_id or 'unknown')}-"
            f"{_slug_component(schema_name)}-attempt{attempt}"
        )
        target = self._request_archive_dir / folder_name
        target.mkdir(parents=True, exist_ok=True)
        return target

    @staticmethod
    def _archive_write(path: Path | None, filename: str, payload: Any) -> None:
        if not path:
            return
        try:
            file_path = path / filename
            file_path.write_text(
                json.dumps(_to_serializable(payload), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            # Archive should never break the core extraction flow.
            return

    def call_structured(
        self,
        *,
        messages: list[dict[str, str]],
        schema_name: str,
        schema: dict[str, Any],
        allowed_domains: list[str] | None = None,
        phase: str | None = None,
        trace_context: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        tool: dict[str, Any] = {
            "type": "web_search",
            "search_context_size": self._settings.search_context_size,
            "external_web_access": self._settings.external_web_access,
        }
        if allowed_domains:
            tool["filters"] = {"allowed_domains": allowed_domains}

        attempt = 0
        while True:
            attempt += 1
            company_id = (trace_context or {}).get("company_id")
            request_payload: dict[str, Any] = {
                "model": self._settings.model,
                "input": messages,
                "tools": [tool],
                "tool_choice": "auto",
                "max_output_tokens": self._settings.max_output_tokens,
                "max_tool_calls": self._settings.max_tool_calls,
                "store": False,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": schema_name,
                        "schema": schema,
                        "strict": True,
                    }
                },
            }
            archive_dir = self._archive_attempt_dir(
                phase=phase,
                company_id=company_id,
                schema_name=schema_name,
                attempt=attempt,
            )
            self._archive_write(
                archive_dir,
                "request.json",
                {
                    **request_payload,
                    "_meta": {
                        "phase": phase,
                        "company_id": company_id,
                        "schema_name": schema_name,
                        "attempt": attempt,
                    },
                },
            )
            try:
                started = perf_counter()
                response = self._client.responses.create(**request_payload)
                self._archive_write(archive_dir, "response.json", response)
                duration_ms = int((perf_counter() - started) * 1000)
                input_tokens, cached_input_tokens, output_tokens = self._extract_usage_parts(response)
                web_search_calls = self._count_web_search_calls(response)
                if self._usage_tracker:
                    self._usage_tracker.record(
                        UsageEvent(
                            phase=phase or "unknown",
                            company_id=company_id,
                            schema_name=schema_name,
                            model=self._settings.model,
                            input_tokens=input_tokens,
                            cached_input_tokens=cached_input_tokens,
                            output_tokens=output_tokens,
                            web_search_call_count=web_search_calls,
                            duration_ms=duration_ms,
                            attempt=attempt,
                        )
                    )
                output = getattr(response, "output_text", None)
                if not output:
                    chunks: list[str] = []
                    for item in getattr(response, "output", []) or []:
                        if getattr(item, "type", None) != "message":
                            continue
                        for content in getattr(item, "content", []) or []:
                            if getattr(content, "type", None) == "output_text":
                                chunks.append(getattr(content, "text", ""))
                    output = "\n".join(chunks).strip()
                if not output:
                    raise RuntimeError("No response output returned by model.")
                result_payload = _extract_json(output)
                self._archive_write(
                    archive_dir,
                    "result.json",
                    {
                        **result_payload,
                        "_meta": {
                            "output_text": output,
                        },
                    },
                )
                return result_payload
            except Exception as exc:
                retryable = _is_retryable_error(exc)
                self._archive_write(
                    archive_dir,
                    "error.json",
                    {
                        "phase": phase,
                        "company_id": company_id,
                        "schema_name": schema_name,
                        "attempt": attempt,
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "retryable": retryable,
                    },
                )
                if self._usage_tracker and hasattr(self._usage_tracker, "record_attempt_error"):
                    self._usage_tracker.record_attempt_error(
                        phase=phase or "unknown",
                        company_id=company_id,
                        schema_name=schema_name,
                        model=self._settings.model,
                        attempt=attempt,
                        error_type=type(exc).__name__,
                        error_message=str(exc),
                        retryable=retryable,
                    )
                if attempt > self._settings.retries or not retryable:
                    raise
                time.sleep(min(2**attempt, 8))

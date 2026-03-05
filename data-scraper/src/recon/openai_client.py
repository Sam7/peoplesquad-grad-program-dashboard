from __future__ import annotations

import json
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


class OpenAIWebSearchClient:
    def __init__(self, api_key: str, settings: OpenAISettings, usage_tracker: UsageTracker | None = None):
        self._settings = settings
        self._client = OpenAI(api_key=api_key, timeout=settings.request_timeout_seconds)
        self._usage_tracker = usage_tracker

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
            try:
                started = perf_counter()
                response = self._client.responses.create(
                    model=self._settings.model,
                    input=messages,
                    tools=[tool],
                    tool_choice="auto",
                    max_output_tokens=self._settings.max_output_tokens,
                    max_tool_calls=self._settings.max_tool_calls,
                    store=False,
                    text={
                        "format": {
                            "type": "json_schema",
                            "name": schema_name,
                            "schema": schema,
                            "strict": True,
                        }
                    },
                )
                duration_ms = int((perf_counter() - started) * 1000)
                input_tokens, cached_input_tokens, output_tokens = self._extract_usage_parts(response)
                web_search_calls = self._count_web_search_calls(response)
                if self._usage_tracker:
                    company_id = (trace_context or {}).get("company_id")
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
                return _extract_json(output)
            except Exception:
                if attempt > self._settings.retries:
                    raise
                time.sleep(min(2**attempt, 8))

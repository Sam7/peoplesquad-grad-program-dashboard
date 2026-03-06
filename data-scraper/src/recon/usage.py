from __future__ import annotations

import json
import sys
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import TextIO


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


@dataclass(frozen=True)
class PricingConfig:
    input_per_1m: float = 1.75
    cached_input_per_1m: float = 0.175
    output_per_1m: float = 14.0
    web_search_per_1k_calls: float = 10.0
    currency: str = "USD"


@dataclass(frozen=True)
class UsageEvent:
    phase: str
    company_id: str | None
    schema_name: str
    model: str
    input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    web_search_call_count: int
    duration_ms: int
    attempt: int


def calculate_costs(event: UsageEvent, pricing: PricingConfig) -> dict[str, float | int]:
    cached_input_tokens = max(int(event.cached_input_tokens), 0)
    input_tokens = max(int(event.input_tokens), 0)
    output_tokens = max(int(event.output_tokens), 0)
    web_calls = max(int(event.web_search_call_count), 0)

    non_cached_input_tokens = max(input_tokens - cached_input_tokens, 0)

    cost_input = Decimal(non_cached_input_tokens) * Decimal(str(pricing.input_per_1m)) / Decimal(1_000_000)
    cost_cached_input = Decimal(cached_input_tokens) * Decimal(str(pricing.cached_input_per_1m)) / Decimal(1_000_000)
    cost_output = Decimal(output_tokens) * Decimal(str(pricing.output_per_1m)) / Decimal(1_000_000)
    cost_web_search = Decimal(web_calls) * Decimal(str(pricing.web_search_per_1k_calls)) / Decimal(1_000)
    total = cost_input + cost_cached_input + cost_output + cost_web_search

    return {
        "input_tokens": input_tokens,
        "cached_input_tokens": cached_input_tokens,
        "non_cached_input_tokens": non_cached_input_tokens,
        "output_tokens": output_tokens,
        "web_search_call_count": web_calls,
        "cost_input_usd": float(cost_input),
        "cost_cached_input_usd": float(cost_cached_input),
        "cost_output_usd": float(cost_output),
        "cost_web_search_usd": float(cost_web_search),
        "cost_total_usd": float(total),
    }


class UsageTracker:
    def __init__(
        self,
        *,
        pricing: PricingConfig,
        log_path: Path,
        console_enabled: bool = True,
        console_stream: TextIO | None = None,
    ):
        self._pricing = pricing
        self._log_path = log_path
        self._console_enabled = console_enabled
        self._console_stream = console_stream or sys.stdout
        self._lock = threading.Lock()
        self._sequence = 0
        self._totals: dict[str, float | int] = {
            "input_tokens": 0,
            "cached_input_tokens": 0,
            "non_cached_input_tokens": 0,
            "output_tokens": 0,
            "web_search_call_count": 0,
            "cost_input_usd": 0.0,
            "cost_cached_input_usd": 0.0,
            "cost_output_usd": 0.0,
            "cost_web_search_usd": 0.0,
            "cost_total_usd": 0.0,
            "api_call_count": 0,
        }

    @property
    def log_path(self) -> Path:
        return self._log_path

    def _append_record(self, payload: dict) -> None:
        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        with self._log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")

    def record(self, event: UsageEvent) -> dict:
        costs = calculate_costs(event, self._pricing)
        with self._lock:
            self._sequence += 1
            seq = self._sequence
            self._totals["api_call_count"] = int(self._totals["api_call_count"]) + 1
            for key in [
                "input_tokens",
                "cached_input_tokens",
                "non_cached_input_tokens",
                "output_tokens",
                "web_search_call_count",
            ]:
                self._totals[key] = int(self._totals[key]) + int(costs[key])
            for key in [
                "cost_input_usd",
                "cost_cached_input_usd",
                "cost_output_usd",
                "cost_web_search_usd",
                "cost_total_usd",
            ]:
                self._totals[key] = float(self._totals[key]) + float(costs[key])

            record = {
                "record_type": "call",
                "timestamp_utc": _utc_now_iso(),
                "sequence": seq,
                "phase": event.phase,
                "company_id": event.company_id,
                "schema_name": event.schema_name,
                "model": event.model,
                "attempt": event.attempt,
                "duration_ms": event.duration_ms,
                **costs,
                "cumulative_usd": float(self._totals["cost_total_usd"]),
                "currency": self._pricing.currency,
            }
            self._append_record(record)
            if self._console_enabled:
                self._console_stream.write(
                    (
                        f"[usage] #{seq} {event.phase}/{event.schema_name} "
                        f"company={event.company_id or '-'} in={costs['input_tokens']} "
                        f"cached={costs['cached_input_tokens']} out={costs['output_tokens']} "
                        f"web={costs['web_search_call_count']} "
                        f"call={costs['cost_total_usd']:.6f} {self._pricing.currency} "
                        f"total={float(self._totals['cost_total_usd']):.6f} {self._pricing.currency}\n"
                    )
                )
                self._console_stream.flush()
            return record

    def record_attempt_error(
        self,
        *,
        phase: str,
        company_id: str | None,
        schema_name: str,
        model: str,
        attempt: int,
        error_type: str,
        error_message: str,
        retryable: bool,
    ) -> dict:
        with self._lock:
            self._sequence += 1
            seq = self._sequence
            record = {
                "record_type": "attempt_error",
                "timestamp_utc": _utc_now_iso(),
                "sequence": seq,
                "phase": phase,
                "company_id": company_id,
                "schema_name": schema_name,
                "model": model,
                "attempt": attempt,
                "error_type": error_type,
                "error_message": error_message,
                "retryable": retryable,
            }
            self._append_record(record)
            if self._console_enabled:
                self._console_stream.write(
                    (
                        f"[usage] error #{seq} {phase}/{schema_name} company={company_id or '-'} "
                        f"attempt={attempt} retryable={retryable} type={error_type} "
                        f"msg={error_message}\n"
                    )
                )
                self._console_stream.flush()
            return record

    def finalize(self) -> dict:
        with self._lock:
            summary = {
                "record_type": "summary",
                "timestamp_utc": _utc_now_iso(),
                **self._totals,
                "currency": self._pricing.currency,
            }
            self._append_record(summary)
            return summary

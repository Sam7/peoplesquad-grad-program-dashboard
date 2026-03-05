from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class OpenAISettings:
    model: str = "gpt-5.2-2025-12-11"
    search_context_size: str = "medium"
    external_web_access: bool = True
    max_output_tokens: int = 10000
    max_tool_calls: int = 20
    request_timeout_seconds: int = 3000
    retries: int = 1


def require_api_key() -> str:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")
    return api_key

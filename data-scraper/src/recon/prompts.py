from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


PLACEHOLDER_PATTERN = re.compile(r"{{\s*([a-zA-Z0-9_]+)\s*}}")
FENCED_JSON_PATTERN = re.compile(r"```json\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)


@dataclass(frozen=True)
class PromptBundle:
    system: str
    user: str
    schema: dict


def render_template(template: str, variables: dict[str, str]) -> str:
    missing: list[str] = []

    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in variables:
            missing.append(key)
            return match.group(0)
        return variables[key]

    rendered = PLACEHOLDER_PATTERN.sub(replace, template)
    if missing:
        uniq = sorted(set(missing))
        raise ValueError(f"Missing prompt template values: {', '.join(uniq)}")
    return rendered


def extract_fenced_json(markdown: str) -> dict:
    match = FENCED_JSON_PATTERN.search(markdown)
    if not match:
        raise ValueError("No fenced json block found in schema markdown.")
    return json.loads(match.group(1))


def load_prompt_bundle(prompts_dir: Path, name: str) -> PromptBundle:
    step_dir = prompts_dir / name
    system = (step_dir / "system.md").read_text(encoding="utf-8").strip()
    user = (step_dir / "user.md").read_text(encoding="utf-8").strip()
    schema_md = (step_dir / "schema.md").read_text(encoding="utf-8")
    schema = extract_fenced_json(schema_md)
    return PromptBundle(system=system, user=user, schema=schema)


def build_messages(bundle: PromptBundle, variables: dict[str, str]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": render_template(bundle.system, variables)},
        {"role": "user", "content": render_template(bundle.user, variables)},
    ]

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.config import OpenAISettings
from recon.openai_client import OpenAIWebSearchClient


class _FakeResponses:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            output_text='{"ok": true}',
            usage=SimpleNamespace(
                input_tokens=100,
                output_tokens=20,
                input_tokens_details=SimpleNamespace(cached_tokens=15),
            ),
            output=[
                SimpleNamespace(type="web_search_call"),
                SimpleNamespace(type="message"),
                SimpleNamespace(type="web_search_call"),
            ],
        )


class _FakeOpenAI:
    def __init__(self):
        self.responses = _FakeResponses()


class _FakeTracker:
    def __init__(self):
        self.events = []

    def record(self, event):
        self.events.append(event)


class OpenAIUsageTests(unittest.TestCase):
    def test_call_structured_emits_usage_event(self):
        settings = OpenAISettings()
        client = OpenAIWebSearchClient(api_key="test", settings=settings)
        fake = _FakeOpenAI()
        client._client = fake  # noqa: SLF001 - test seam
        tracker = _FakeTracker()
        client.set_usage_tracker(tracker)
        payload = client.call_structured(
            messages=[{"role": "system", "content": "s"}, {"role": "user", "content": "u"}],
            schema_name="test_schema",
            schema={"type": "object"},
            allowed_domains=["example.com"],
            phase="build",
            trace_context={"company_id": "coles-group"},
        )
        self.assertEqual(payload["ok"], True)
        self.assertEqual(len(tracker.events), 1)
        event = tracker.events[0]
        self.assertEqual(event.phase, "build")
        self.assertEqual(event.company_id, "coles-group")
        self.assertEqual(event.schema_name, "test_schema")
        self.assertEqual(event.input_tokens, 100)
        self.assertEqual(event.cached_input_tokens, 15)
        self.assertEqual(event.output_tokens, 20)
        self.assertEqual(event.web_search_call_count, 2)


if __name__ == "__main__":
    unittest.main()

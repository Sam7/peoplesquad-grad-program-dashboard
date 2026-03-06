import sys
import tempfile
import unittest
import json
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

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

    def test_call_structured_does_not_retry_non_retryable_status_error(self):
        class _StatusError(Exception):
            def __init__(self, status_code: int):
                super().__init__(f"status={status_code}")
                self.status_code = status_code

        class _FailResponses:
            def __init__(self):
                self.calls = 0

            def create(self, **kwargs):
                self.calls += 1
                raise _StatusError(400)

        settings = OpenAISettings(retries=3)
        client = OpenAIWebSearchClient(api_key="test", settings=settings)
        fake = SimpleNamespace(responses=_FailResponses())
        client._client = fake  # noqa: SLF001 - test seam
        with mock.patch("recon.openai_client.time.sleep") as sleeper:
            with self.assertRaises(_StatusError):
                client.call_structured(
                    messages=[{"role": "system", "content": "s"}, {"role": "user", "content": "u"}],
                    schema_name="test_schema",
                    schema={"type": "object"},
                )
        self.assertEqual(fake.responses.calls, 1)
        sleeper.assert_not_called()

    def test_call_structured_archives_request_response_and_result(self):
        with tempfile.TemporaryDirectory() as td:
            archive_dir = Path(td) / "archives"
            settings = OpenAISettings()
            client = OpenAIWebSearchClient(
                api_key="test",
                settings=settings,
                request_archive_dir=archive_dir,
                request_archive_enabled=True,
            )
            fake = _FakeOpenAI()
            client._client = fake  # noqa: SLF001 - test seam
            payload = client.call_structured(
                messages=[{"role": "system", "content": "s"}, {"role": "user", "content": "u"}],
                schema_name="test_schema",
                schema={"type": "object"},
                phase="build",
                trace_context={"company_id": "coles-group"},
            )
            self.assertEqual(payload, {"ok": True})
            request_dirs = [p for p in archive_dir.iterdir() if p.is_dir()]
            self.assertEqual(len(request_dirs), 1)
            request_dir = request_dirs[0]
            req = json.loads((request_dir / "request.json").read_text(encoding="utf-8"))
            resp = json.loads((request_dir / "response.json").read_text(encoding="utf-8"))
            result = json.loads((request_dir / "result.json").read_text(encoding="utf-8"))
            self.assertEqual(req["input"][0]["content"], "s")
            self.assertIn("output", resp)
            self.assertEqual(result["ok"], True)

    def test_call_structured_archives_error_body_on_failure(self):
        class _StatusError(Exception):
            def __init__(self, status_code: int):
                super().__init__(f"status={status_code}")
                self.status_code = status_code

        class _FailResponses:
            def create(self, **kwargs):
                raise _StatusError(400)

        with tempfile.TemporaryDirectory() as td:
            archive_dir = Path(td) / "archives"
            settings = OpenAISettings(retries=0)
            client = OpenAIWebSearchClient(
                api_key="test",
                settings=settings,
                request_archive_dir=archive_dir,
                request_archive_enabled=True,
            )
            client._client = SimpleNamespace(responses=_FailResponses())  # noqa: SLF001 - test seam
            with self.assertRaises(_StatusError):
                client.call_structured(
                    messages=[{"role": "system", "content": "s"}, {"role": "user", "content": "u"}],
                    schema_name="test_schema",
                    schema={"type": "object"},
                    phase="build",
                    trace_context={"company_id": "coles-group"},
                )
            request_dirs = [p for p in archive_dir.iterdir() if p.is_dir()]
            self.assertEqual(len(request_dirs), 1)
            request_dir = request_dirs[0]
            error_payload = json.loads((request_dir / "error.json").read_text(encoding="utf-8"))
            self.assertEqual(error_payload["error_type"], "_StatusError")
            self.assertEqual(error_payload["retryable"], False)


if __name__ == "__main__":
    unittest.main()

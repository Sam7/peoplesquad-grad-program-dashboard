import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.usage import PricingConfig, UsageEvent, UsageTracker, calculate_costs


class UsageTests(unittest.TestCase):
    def test_calculate_costs_splits_cached_and_non_cached(self):
        pricing = PricingConfig(
            input_per_1m=1.75,
            cached_input_per_1m=0.175,
            output_per_1m=14.0,
            web_search_per_1k_calls=10.0,
        )
        event = UsageEvent(
            phase="build",
            company_id="coles-group",
            schema_name="extract_program",
            model="gpt-5.2-2025-12-11",
            input_tokens=1000,
            cached_input_tokens=200,
            output_tokens=100,
            web_search_call_count=2,
            duration_ms=1000,
            attempt=1,
        )
        costs = calculate_costs(event, pricing)
        self.assertEqual(costs["non_cached_input_tokens"], 800)
        self.assertAlmostEqual(costs["cost_input_usd"], 0.0014, places=10)
        self.assertAlmostEqual(costs["cost_cached_input_usd"], 0.000035, places=10)
        self.assertAlmostEqual(costs["cost_output_usd"], 0.0014, places=10)
        self.assertAlmostEqual(costs["cost_web_search_usd"], 0.02, places=10)
        self.assertAlmostEqual(costs["cost_total_usd"], 0.022835, places=10)

    def test_calculate_costs_clamps_when_cached_gt_input(self):
        pricing = PricingConfig()
        event = UsageEvent(
            phase="discover",
            company_id=None,
            schema_name="discover_candidate",
            model="gpt-5.2-2025-12-11",
            input_tokens=10,
            cached_input_tokens=20,
            output_tokens=0,
            web_search_call_count=0,
            duration_ms=10,
            attempt=1,
        )
        costs = calculate_costs(event, pricing)
        self.assertEqual(costs["non_cached_input_tokens"], 0)

    def test_tracker_writes_jsonl_and_summary(self):
        pricing = PricingConfig()
        with tempfile.TemporaryDirectory() as td:
            log_path = Path(td) / "usage.jsonl"
            console = io.StringIO()
            tracker = UsageTracker(pricing=pricing, log_path=log_path, console_enabled=True, console_stream=console)
            tracker.record(
                UsageEvent(
                    phase="build",
                    company_id="coles",
                    schema_name="extract_program",
                    model="gpt-5.2-2025-12-11",
                    input_tokens=100,
                    cached_input_tokens=10,
                    output_tokens=20,
                    web_search_call_count=1,
                    duration_ms=100,
                    attempt=1,
                )
            )
            summary = tracker.finalize()
            self.assertEqual(summary["api_call_count"], 1)
            self.assertTrue(log_path.exists())
            lines = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(lines[0]["record_type"], "call")
            self.assertEqual(lines[-1]["record_type"], "summary")
            self.assertIn("cost_total_usd", lines[0])
            self.assertIn("cumulative_usd", lines[0])
            self.assertIn("USD", console.getvalue())


if __name__ == "__main__":
    unittest.main()

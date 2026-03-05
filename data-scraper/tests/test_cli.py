import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.cli import build_parser, main, run_build
from recon.prompts import PromptBundle


class CLITests(unittest.TestCase):
    def test_parser_has_expected_subcommands(self):
        parser = build_parser()
        subparsers_action = next(a for a in parser._actions if getattr(a, "choices", None))
        self.assertIn("discover", subparsers_action.choices)
        self.assertIn("build", subparsers_action.choices)
        self.assertIn("report", subparsers_action.choices)

    def test_main_dispatches_discover(self):
        with mock.patch("recon.cli.run_discover") as run_discover:
            run_discover.return_value = 0
            rc = main(["discover", "--out", "x.json"])
            self.assertEqual(rc, 0)
            run_discover.assert_called_once()

    def test_discover_parser_has_usage_flags(self):
        parser = build_parser()
        args = parser.parse_args(["discover", "--usage-log", "usage.jsonl"])
        self.assertEqual(str(args.usage_log), "usage.jsonl")
        self.assertEqual(args.price_input_per_1m, 1.75)
        self.assertEqual(args.price_cached_input_per_1m, 0.175)
        self.assertEqual(args.price_output_per_1m, 14.0)
        self.assertEqual(args.price_web_search_per_1k_calls, 10.0)

    def test_build_parser_has_no_usage_console_flag(self):
        parser = build_parser()
        args = parser.parse_args(["build", "--no-usage-console"])
        self.assertTrue(args.no_usage_console)

    def test_build_parser_has_logo_flags(self):
        parser = build_parser()
        args = parser.parse_args(["build", "--logo-dir", "data/assets/logos"])
        self.assertEqual(args.logo_dir, Path("data/assets/logos"))
        self.assertEqual(args.logo_filename_template, "{id}-peoplesquad-logo.webp")
        self.assertEqual(args.logo_public_prefix, "assets/logos")
        self.assertEqual(args.logo_max_size, 512)
        self.assertEqual(args.logo_min_source_size, 96)

    def test_run_build_defaults_logo_dir_under_out(self):
        parser = build_parser()
        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td) / "out"
            report_out = out_dir / "report.md"
            args = parser.parse_args(["build", "--seed", "seed.json", "--out", str(out_dir), "--report-out", str(report_out)])
            bundle = PromptBundle(system="s", user="u", schema={"type": "object"})
            tracker = mock.Mock()
            tracker.finalize.return_value = {
                "api_call_count": 0,
                "input_tokens": 0,
                "cached_input_tokens": 0,
                "output_tokens": 0,
                "cost_total_usd": 0.0,
                "currency": "USD",
            }
            with (
                mock.patch("recon.cli._load_seed_file") as load_seed,
                mock.patch("recon.cli.require_api_key") as require_api_key,
                mock.patch("recon.cli.OpenAIWebSearchClient") as client_cls,
                mock.patch("recon.cli.load_prompt_bundle") as load_prompt_bundle,
                mock.patch("recon.cli.build_company_details") as build_company_details,
                mock.patch("recon.cli.write_build_outputs"),
                mock.patch("recon.cli.generate_build_report") as generate_build_report,
                mock.patch("recon.cli.UsageTracker", return_value=tracker),
            ):
                load_seed.return_value = [{"id": "a", "review": {"status": "approved"}}]
                require_api_key.return_value = "k"
                load_prompt_bundle.return_value = bundle
                build_company_details.return_value = ([], [])
                generate_build_report.return_value = "# Build Report"
                rc = run_build(args)
                self.assertEqual(rc, 0)
                kwargs = build_company_details.call_args.kwargs
                self.assertEqual(kwargs["logo_output_dir"], out_dir / "assets" / "logos")


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from recon.build import (
    build_company_details,
    select_records_for_processing,
    select_seed_records,
    write_build_outputs,
)
from recon.config import OpenAISettings, require_api_key
from recon.discovery import discover_entities, load_seed_records, write_discovery_output
from recon.master_ops import (
    load_names_file,
    merge_candidate_payloads,
    parse_names_text,
    seed_records_from_names,
)
from recon.models import REVIEW_STATUS_VALUES
from recon.openai_client import OpenAIWebSearchClient
from recon.prompts import load_prompt_bundle
from recon.reporting import generate_discovery_report, generate_report_from_data
from recon.usage import PricingConfig, UsageTracker
from recon.utils import read_json, write_json


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _settings_from_args(args: argparse.Namespace) -> OpenAISettings:
    retries = args.retries if getattr(args, "retries", None) is not None else OpenAISettings.retries
    timeout = (
        args.request_timeout_seconds
        if getattr(args, "request_timeout_seconds", None) is not None
        else OpenAISettings.request_timeout_seconds
    )
    return OpenAISettings(
        model=args.model,
        search_context_size=args.search_context,
        external_web_access=(not args.offline),
        max_output_tokens=args.max_output_tokens,
        max_tool_calls=args.max_tool_calls,
        request_timeout_seconds=timeout,
        retries=retries,
    )


def _pricing_from_args(args: argparse.Namespace) -> PricingConfig:
    return PricingConfig(
        input_per_1m=args.price_input_per_1m,
        cached_input_per_1m=args.price_cached_input_per_1m,
        output_per_1m=args.price_output_per_1m,
        web_search_per_1k_calls=args.price_web_search_per_1k_calls,
        currency=args.currency,
    )


def _default_usage_log_path(args: argparse.Namespace, phase: str) -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    if phase == "discover":
        base = args.out.parent
        return base / f"discover-usage-{ts}.jsonl"
    base = args.out / "logs"
    return base / f"build-usage-{ts}.jsonl"


def _add_usage_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--usage-log", type=Path, default=None)
    parser.add_argument("--no-usage-console", action="store_true")
    parser.add_argument("--price-input-per-1m", type=float, default=1.75)
    parser.add_argument("--price-cached-input-per-1m", type=float, default=0.175)
    parser.add_argument("--price-output-per-1m", type=float, default=14.0)
    parser.add_argument("--price-web-search-per-1k-calls", type=float, default=10.0)
    parser.add_argument("--currency", default="USD")


def _add_openai_runtime_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--retries", type=int, default=None)
    parser.add_argument("--request-timeout-seconds", type=int, default=None)
    parser.add_argument("--request-archive-dir", type=Path, default=None)
    parser.add_argument("--request-archive", action=argparse.BooleanOptionalAction, default=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="PeopleSquad two-phase grad program recon CLI.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    discover = subparsers.add_parser("discover", help="Discover qualifying employers and programs.")
    discover.add_argument("--out", type=Path, default=PROJECT_ROOT / "data" / "discovery" / "discovered_candidates.json")
    discover.add_argument("--report-out", type=Path, default=PROJECT_ROOT / "data" / "discovery" / "discovery_report.md")
    discover.add_argument("--inputs-dir", type=Path, default=PROJECT_ROOT / "inputs")
    discover.add_argument("--seed", type=Path, default=None, help="Optional single seed JSON file.")
    discover.add_argument("--prompts-dir", type=Path, default=PROJECT_ROOT / "prompts")
    discover.add_argument("--workers", type=int, default=4)
    discover.add_argument("--model", default="gpt-5.2-2025-12-11")
    discover.add_argument("--search-context", default="medium", choices=["low", "medium", "high"])
    discover.add_argument("--offline", action="store_true")
    discover.add_argument("--max-output-tokens", type=int, default=1800)
    discover.add_argument("--max-tool-calls", type=int, default=6)
    _add_openai_runtime_args(discover)
    _add_usage_args(discover)

    build = subparsers.add_parser("build", help="Extract full detail records for approved employers.")
    build.add_argument("--seed", type=Path, default=PROJECT_ROOT / "data" / "discovery" / "discovered_candidates.json")
    build.add_argument("--out", type=Path, default=PROJECT_ROOT / "data")
    build.add_argument("--report-out", type=Path, default=PROJECT_ROOT / "data" / "report.md")
    build.add_argument("--prompts-dir", type=Path, default=PROJECT_ROOT / "prompts")
    build.add_argument("--workers", type=int, default=4)
    build.add_argument("--company", type=str, default=None, help="Optional company id to build.")
    build.add_argument("--include-unreviewed", action="store_true", help="Include needs_review records.")
    build.add_argument("--model", default="gpt-5.2-2025-12-11")
    build.add_argument("--search-context", default="medium", choices=["low", "medium", "high"])
    build.add_argument("--offline", action="store_true")
    build.add_argument("--max-output-tokens", type=int, default=10000)
    build.add_argument("--max-tool-calls", type=int, default=8)
    build.add_argument("--logo-dir", type=Path, default=None)
    build.add_argument("--logo-filename-template", default="{id}-peoplesquad-logo.webp")
    build.add_argument("--logo-public-prefix", default="assets/logos")
    build.add_argument("--skip-logo-download", action="store_true")
    build.add_argument("--logo-timeout-seconds", type=int, default=20)
    build.add_argument("--logo-max-size", type=int, default=512)
    build.add_argument("--logo-min-source-size", type=int, default=96)
    build.add_argument("--logo-format", default="webp")
    build.add_argument("--logo-failure-mode", choices=["warn", "fail"], default="warn")
    build.add_argument("--max-companies", type=int, default=None)
    build.add_argument("--force-rebuild", action="store_true")
    build.add_argument("--state-dir", type=Path, default=None)
    build.add_argument("--resume", action=argparse.BooleanOptionalAction, default=True)
    _add_openai_runtime_args(build)
    _add_usage_args(build)

    report = subparsers.add_parser("report", help="Generate a markdown report from output data.")
    report.add_argument("--data-dir", type=Path, default=PROJECT_ROOT / "data")
    report.add_argument("--out", type=Path, default=PROJECT_ROOT / "data" / "report.md")

    seed_from_names = subparsers.add_parser(
        "seed-from-names",
        help="Convert plain-text company names into a discovery seed JSON array.",
    )
    seed_from_names.add_argument("--names", default=None, help="Company names separated by ';' or newlines.")
    seed_from_names.add_argument("--names-file", type=Path, default=None)
    seed_from_names.add_argument("--out", type=Path, required=True)
    seed_from_names.add_argument("--entity-type", default="company")
    seed_from_names.add_argument("--taxonomy-hint", default="")

    master_merge = subparsers.add_parser(
        "master-merge",
        help="Merge incoming discovered candidates into the master candidates file.",
    )
    master_merge.add_argument("--master", type=Path, required=True)
    master_merge.add_argument("--incoming", type=Path, required=True)
    master_merge.add_argument("--out", type=Path, default=None)
    master_merge.add_argument("--duplicate-policy", choices=["keep-existing"], default="keep-existing")
    master_merge.add_argument("--default-review-status", choices=REVIEW_STATUS_VALUES, default="needs_review")
    return parser


def _load_seed_file(seed_path: Path) -> list[dict[str, Any]]:
    payload = read_json(seed_path)
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        candidates = payload.get("candidates")
        if isinstance(candidates, list):
            return candidates
    raise ValueError(f"Unsupported seed payload format: {seed_path}")


def run_discover(args: argparse.Namespace) -> int:
    seeds = _load_seed_file(args.seed) if args.seed else load_seed_records(args.inputs_dir)
    bundle = load_prompt_bundle(args.prompts_dir, "discover")
    settings = _settings_from_args(args)
    pricing = _pricing_from_args(args)
    usage_log = args.usage_log or _default_usage_log_path(args, "discover")
    tracker = UsageTracker(
        pricing=pricing,
        log_path=usage_log,
        console_enabled=(not args.no_usage_console),
    )
    archive_dir = args.request_archive_dir or (usage_log.parent / "openai-requests" / usage_log.stem)
    api_key = require_api_key()
    client = OpenAIWebSearchClient(
        api_key,
        settings,
        usage_tracker=tracker,
        request_archive_dir=archive_dir,
        request_archive_enabled=args.request_archive,
    )
    print(f"usage log: {usage_log}")
    try:
        qualified, excluded, failures = discover_entities(
            seeds=seeds,
            bundle=bundle,
            client=client,
            workers=args.workers,
        )
        write_discovery_output(out_path=args.out, candidates=qualified, excluded=excluded, failures=failures)
        report = generate_discovery_report(qualified=qualified, excluded=excluded, failures=failures)
        args.report_out.parent.mkdir(parents=True, exist_ok=True)
        args.report_out.write_text(report, encoding="utf-8")
        print(f"discovered={len(qualified)} excluded={len(excluded)} failures={len(failures)}")
        print(f"wrote: {args.out}")
        print(f"wrote: {args.report_out}")
        return 0
    finally:
        summary = tracker.finalize()
        print(
            f"usage total: calls={summary['api_call_count']} "
            f"input={summary['input_tokens']} cached={summary['cached_input_tokens']} "
            f"output={summary['output_tokens']} total={summary['cost_total_usd']:.6f} {summary['currency']}"
        )
        print(f"wrote: {usage_log}")


def run_build(args: argparse.Namespace) -> int:
    seed_records = _load_seed_file(args.seed)
    approved_only = not args.include_unreviewed
    selected = select_seed_records(seed_records, approved_only=approved_only, company_id=args.company)
    if not selected:
        raise RuntimeError("No records selected for build. Check review.status and --company filters.")

    settings = _settings_from_args(args)
    pricing = _pricing_from_args(args)
    usage_log = args.usage_log or _default_usage_log_path(args, "build")
    tracker = UsageTracker(
        pricing=pricing,
        log_path=usage_log,
        console_enabled=(not args.no_usage_console),
    )
    archive_dir = args.request_archive_dir or (usage_log.parent / "openai-requests" / usage_log.stem)
    api_key = require_api_key()
    client = OpenAIWebSearchClient(
        api_key,
        settings,
        usage_tracker=tracker,
        request_archive_dir=archive_dir,
        request_archive_enabled=args.request_archive,
    )
    program_bundle = load_prompt_bundle(args.prompts_dir, "extract_program")
    commercial_bundle = load_prompt_bundle(args.prompts_dir, "extract_commercial")
    print(f"usage log: {usage_log}")
    resolved_logo_dir = args.logo_dir or (args.out / "assets" / "logos")
    state_dir = args.state_dir or (args.out / ".recon-state")
    logo_settings = {
        "logo_public_prefix": args.logo_public_prefix,
        "logo_filename_template": args.logo_filename_template,
        "logo_max_size": args.logo_max_size,
        "logo_min_source_size": args.logo_min_source_size,
        "logo_format": args.logo_format,
        "skip_logo_download": args.skip_logo_download,
    }
    to_process, skipped = select_records_for_processing(
        records=selected,
        out_dir=args.out,
        state_dir=state_dir,
        model=settings.model,
        program_bundle=program_bundle,
        commercial_bundle=commercial_bundle,
        resume=args.resume,
        force_rebuild=args.force_rebuild,
        max_companies=args.max_companies,
        logo_settings=logo_settings,
    )
    if not to_process:
        print("No companies scheduled for build (all selected records already completed and compatible).")
        to_process = []
    try:
        details, failures = build_company_details(
            records=to_process,
            client=client,
            program_bundle=program_bundle,
            commercial_bundle=commercial_bundle,
            out_dir=args.out,
            state_dir=state_dir,
            model=settings.model,
            resume=args.resume,
            force_rebuild=args.force_rebuild,
            logo_failure_mode=args.logo_failure_mode,
            workers=args.workers,
            logo_output_dir=resolved_logo_dir,
            logo_public_prefix=args.logo_public_prefix,
            logo_filename_template=args.logo_filename_template,
            logo_timeout_seconds=args.logo_timeout_seconds,
            skip_logo_download=args.skip_logo_download,
            logo_min_source_size=args.logo_min_source_size,
            logo_max_size=args.logo_max_size,
            logo_output_format=args.logo_format,
        )
        write_build_outputs(
            out_dir=args.out,
            details=details,
            failures=failures,
            model=settings.model,
            approved_snapshot=selected,
            selected_count=len(selected),
            skipped_count=len(skipped),
            scheduled_count=len(to_process),
            requested_max_companies=args.max_companies,
        )
        generate_report_from_data(data_dir=args.out, out_path=args.report_out)
        print(f"built={len(details)} failures={len(failures)}")
        print(f"wrote: {args.out}")
        print(f"wrote: {args.report_out}")
        return 0
    finally:
        summary = tracker.finalize()
        print(
            f"usage total: calls={summary['api_call_count']} "
            f"input={summary['input_tokens']} cached={summary['cached_input_tokens']} "
            f"output={summary['output_tokens']} total={summary['cost_total_usd']:.6f} {summary['currency']}"
        )
        print(f"wrote: {usage_log}")


def run_report(args: argparse.Namespace) -> int:
    generate_report_from_data(data_dir=args.data_dir, out_path=args.out)
    print(f"wrote: {args.out}")
    return 0


def run_seed_from_names(args: argparse.Namespace) -> int:
    has_names_arg = bool(str(args.names or "").strip())
    has_names_file = args.names_file is not None
    if has_names_arg == has_names_file:
        raise ValueError("Provide exactly one input source: either --names or --names-file.")

    if has_names_arg:
        names = parse_names_text(str(args.names))
    else:
        names = load_names_file(args.names_file)

    if not names:
        raise ValueError("No company names were found after parsing input.")

    records = seed_records_from_names(
        names,
        entity_type=args.entity_type,
        taxonomy_hint=args.taxonomy_hint,
    )
    write_json(args.out, records)
    print(f"seed_records={len(records)} source_names={len(names)}")
    print(f"wrote: {args.out}")
    return 0


def run_master_merge(args: argparse.Namespace) -> int:
    master_payload = read_json(args.master)
    incoming_payload = read_json(args.incoming)
    merged, report = merge_candidate_payloads(
        master_payload=master_payload,
        incoming_payload=incoming_payload,
        duplicate_policy=args.duplicate_policy,
        default_review_status=args.default_review_status,
    )
    out_path = args.out or args.master
    write_json(out_path, merged)
    print(
        f"merged: added={report['added_count']} duplicates_kept={report['duplicate_kept_count']} "
        f"master_dupe_pruned={report['duplicate_master_pruned_count']} total={report['final_count']}"
    )
    print(f"wrote: {out_path}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "discover":
            return run_discover(args)
        if args.command == "build":
            return run_build(args)
        if args.command == "report":
            return run_report(args)
        if args.command == "seed-from-names":
            return run_seed_from_names(args)
        if args.command == "master-merge":
            return run_master_merge(args)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    return 0

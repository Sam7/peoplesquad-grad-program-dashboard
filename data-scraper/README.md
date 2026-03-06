# PeopleSquad Recon CLI

Two-phase CLI pipeline for discovering and extracting Australian graduate program data.

## Install

```bash
cd data-scraper
python -m pip install -e .
```

Set API key:

```bash
export OPENAI_API_KEY=...
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="..."
```

## Commands

Recommended permanent paths for the current 56-company master run:

```bash
SEED=data/discovery/master/master_candidates_56.json
RUN_DIR=data/runs/top-56
```

Discovery:

```bash
recon discover --out data/discovery/discovered_candidates.json
```

Add new companies from a plain-text names file:

```bash
# 1) Convert inline names string -> discovery seed records (semicolon or newline separators)
recon seed-from-names \
  --names "Acme Corp; Beta Ltd; Gamma Group" \
  --out data/discovery/slices/incoming-20260306-seed.json

# 2) Discover candidates for that new slice
recon discover \
  --seed data/discovery/slices/incoming-20260306-seed.json \
  --out data/discovery/slices/incoming-20260306-discovered.json \
  --report-out data/discovery/slices/incoming-20260306-discovered-report.md

# 3) Merge discovered candidates into master (keep existing IDs)
recon master-merge \
  --master data/discovery/master/master_candidates_56.json \
  --incoming data/discovery/slices/incoming-20260306-discovered.json
```

File-input fallback:

```bash
recon seed-from-names \
  --names-file data/discovery/slices/incoming-20260306-names.txt \
  --out data/discovery/slices/incoming-20260306-seed.json
```

`master-merge` defaults:
- duplicates: keep existing master record (`--duplicate-policy keep-existing`)
- new records review status: `needs_review` (`--default-review-status needs_review`)

Build approved records:

```bash
recon build --seed data/discovery/master/master_candidates_56.json --out data/runs/top-56 --include-unreviewed
```

Build in batches (for example, 1 or 10 more compatible-pending companies):

```bash
recon build --seed data/discovery/master/master_candidates_56.json --out data/runs/top-56 --include-unreviewed --max-companies 10
```

Build one company:

```bash
recon build --seed data/discovery/master/master_candidates_56.json --company coles-group --out data/runs/top-56 --include-unreviewed
```

Build with explicit logo asset configuration:

```bash
recon build \
  --seed data/discovery/master/master_candidates_56.json \
  --out data/runs/top-56 \
  --include-unreviewed \
  --logo-dir data/assets/logos \
  --logo-filename-template "{id}-peoplesquad-logo.webp" \
  --logo-public-prefix assets/logos \
  --logo-max-size 512 \
  --logo-min-source-size 96 \
  --logo-format webp
```

Generate report:

```bash
recon report --data-dir data/runs/top-56 --out data/runs/top-56/report.md
```

Usage and cost telemetry:

```bash
recon build \
  --seed data/discovery/master/master_candidates_56.json \
  --company coles-group \
  --out data/runs/top-56 \
  --include-unreviewed \
  --usage-log data/runs/top-56/logs/coles-usage.jsonl
```

Override USD rates if needed:

```bash
recon build \
  --seed data/discovery/master/master_candidates_56.json \
  --out data/runs/top-56 \
  --include-unreviewed \
  --price-input-per-1m 1.75 \
  --price-cached-input-per-1m 0.175 \
  --price-output-per-1m 14.0 \
  --price-web-search-per-1k-calls 10.0
```

Resume and rebuild controls:

```bash
# Default: resume enabled (skip compatible completed companies)
recon build --seed data/discovery/master/master_candidates_56.json --out data/runs/top-56 --include-unreviewed --max-companies 1

# Disable resume and rebuild everything selected
recon build --seed data/discovery/master/master_candidates_56.json --out data/runs/top-56 --include-unreviewed --no-resume --force-rebuild
```

Runtime retry/timeouts:

```bash
recon build \
  --seed data/discovery/master/master_candidates_56.json \
  --out data/runs/top-56 \
  --include-unreviewed \
  --retries 1 \
  --request-timeout-seconds 300
```

Archive full OpenAI request/response bodies:

```bash
recon build \
  --seed data/discovery/master/master_candidates_56.json \
  --out data/runs/top-56 \
  --include-unreviewed \
  --request-archive-dir data/runs/top-56/logs/openai-requests \
  --request-archive
```

Each API attempt is written into its own timestamped folder with:
- `request.json` (full call body)
- `response.json` (full serialized SDK response)
- `result.json` (parsed JSON result when successful)
- `error.json` (error metadata when failed)

## Notes

- Discovery writes records as `review.status = "needs_review"` by default.
- Mark records as `approved` in the seed file before `build`.
- Extraction only uses official domains and official pages.
- Unknown values are emitted as `null` / empty arrays with provenance notes.
- Each OpenAI call logs tokens and USD spend to console (compact) and JSONL log file.
- Company logos are extracted from official domains only and downloaded as local WebP assets.
- Logo assets are normalized to square format and capped to 512x512 pixels.

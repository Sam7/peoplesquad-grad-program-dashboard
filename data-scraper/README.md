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

Discovery:

```bash
recon discover --out data/discovery/discovered_candidates.json
```

Build approved records:

```bash
recon build --seed data/discovery/discovered_candidates.json --out data
```

Build one company:

```bash
recon build --seed data/discovery/discovered_candidates.json --company coles-group --out data
```

Build with explicit logo asset configuration:

```bash
recon build \
  --seed data/discovery/discovered_candidates.json \
  --out data \
  --logo-dir data/assets/logos \
  --logo-filename-template "{id}-peoplesquad-logo.webp" \
  --logo-public-prefix assets/logos \
  --logo-max-size 512 \
  --logo-min-source-size 96 \
  --logo-format webp
```

Generate report:

```bash
recon report --data-dir data --out data/report.md
```

Usage and cost telemetry:

```bash
recon build \
  --seed data/discovery/discovered_candidates.json \
  --company coles-group \
  --out data \
  --usage-log data/logs/coles-usage.jsonl
```

Override USD rates if needed:

```bash
recon build \
  --seed data/discovery/discovered_candidates.json \
  --out data \
  --price-input-per-1m 1.75 \
  --price-cached-input-per-1m 0.175 \
  --price-output-per-1m 14.0 \
  --price-web-search-per-1k-calls 10.0
```

## Notes

- Discovery writes records as `review.status = "needs_review"` by default.
- Mark records as `approved` in the seed file before `build`.
- Extraction only uses official domains and official pages.
- Unknown values are emitted as `null` / empty arrays with provenance notes.
- Each OpenAI call logs tokens and USD spend to console (compact) and JSONL log file.
- Company logos are extracted from official domains only and downloaded as local WebP assets.
- Logo assets are normalized to square format and capped to 512x512 pixels.

# PeopleSquad Graduate Program Dashboard

A mobile-first, static React dashboard to help students compare graduate programs and track application progress.

The app is designed for a no-backend deployment model and focuses on speed, clarity, and shareable URL state.

## Product Context

This repository powers a student-facing "company intelligence canvas" for graduate applications.  
It combines scraped company data with a responsive UI to help users:

- compare opportunities quickly
- spot urgent application deadlines
- move between list and detail views without losing context
- track personal progress per company (`saved -> applied -> interviewing -> offer/rejected`)

## What This Repo Contains

- `src/`: Frontend application (Vite + React + TypeScript)
- `public/data/`: Runtime dataset used by the app
- `public/assets/brand/`: Brand assets used by the frontend (including PeopleSquad logo)
- `scripts/sync-scraper-data.mjs`: Build-time data sync from scraper output into `public/data`
- `data-scraper/`: Python scraping pipeline and source prompts/schemas
- `docs/`: Vision, brand guidance, and requirements

## Architecture (High Level)

- **No backend at runtime**: App loads static JSON from `public/data`.
- **URL-driven UX**: List filters and view mode live in query params; selected company lives in route path.
- **Mobile-first layout**: Tight header + persistent bottom CTA with responsive detail navigation.
- **Desktop layout**: Split list/detail canvas with quick company switching.
- **Personal progress tracking**: Cookie-based state (`ps_company_progress`), no login required.
- **Theme support**: `system | dark | light` preference persisted in local storage (`ps_theme`).

## Prerequisites

- Node.js `>= 20.18.0`
- npm `>= 10`
- Optional (only for scraper workflows): Python `3.12+`

## Install and Setup

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open the local URL printed by Vite (usually `http://localhost:5173`).

Notes:
- `npm run build` automatically runs `prebuild` first, which syncs data into `public/data`.
- If you are running e2e tests for the first time, install browser binaries:

```bash
npx playwright install
```

## Key UI Behavior

- **Search View**: Free-text company search + focused filters (open now, closing soon, work rights, stream, sort).
- **Board View**: Companies grouped by progress stage with drag-and-drop movement.
- **Detail View**: Utility header + critical program/commercial cards + sources.
- **Deadline urgency**: Relative date copy and urgency styling for near close dates.
- **Shareable state**: URL keeps filters and active listing view.

## Environment Variables

Frontend uses Vite env vars (`.env` / `.env.local`):

- `VITE_PEOPLESQUAD_URL`
  - Default: `https://peoplesquad.com.au`
  - Used for header/mobile CTA external link.

Example `.env.local`:

```bash
VITE_PEOPLESQUAD_URL=https://peoplesquad.com.au
```

## Data Flow and Build Process

### Runtime data model

The frontend expects:

- `public/data/index.json` for list/filter rendering
- `public/data/companies/{id}.json` for detail pages
- `public/data/assets/logos/*` for local logo assets when present

### How data gets into `public/data`

On `npm run build`, the following script runs automatically:

- `scripts/sync-scraper-data.mjs`

It currently merges data from these scraper outputs:

- `data-scraper/data/e2e-three/coles`
- `data-scraper/data/e2e-three/bhp`
- `data-scraper/data/e2e-three/xero`

If you change scraper output locations, update `scripts/sync-scraper-data.mjs`.

## Commands

- `npm run dev`: Start local dev server
- `npm run test`: Run unit/integration tests (Vitest)
- `npm run test:e2e`: Run Playwright end-to-end tests
- `npm run build`: Sync data + type-check + production build
- `npm run preview`: Serve production build locally

## Testing

- Unit/integration: Vitest + React Testing Library
- E2E: Playwright (desktop Chromium + mobile Chrome emulation)

Current tests cover:
- data sync pipeline
- date parsing/status logic
- filtering/sorting/query-param behavior
- progress cookie behavior and transition logic
- app-level list/detail URL flows
- board drag-and-drop progression flows
- desktop/mobile e2e navigation path

## Routes and URL Behavior

- List view: `/`
- Detail view: `/company/:companyId`

Filters are reflected in query params (for share links and browser back/forward), including:

- `q` (name search)
- `open` (`1`)
- `soon` (`1`)
- `soonDays` (integer; defaults to `7`)
- `stream` (repeatable)
- `workRights` (`all`, `citizen_pr`, `visa_ok`, `unknown`)
- `sort` (`deadline`, `name`)
- `view` (`search`, `board`)

## Personal Progress State

Progress is intentionally client-only:

- Cookie key: `ps_company_progress`
- States: `saved`, `applied`, `interviewing`, `offer`, `rejected`
- No account and no server persistence
- Clearing browser cookies resets tracked progress

## Deployment (Vercel)

This project is static-host friendly.

Recommended Vercel settings:

- Build command: `npm run build`
- Output directory: `dist`
- Optional env var: `VITE_PEOPLESQUAD_URL`

Because data is bundled from local files at build time, no runtime server/API is required.

## Scraper Context (Optional)

If you need to refresh or expand source data, use the Python CLI in `data-scraper/`.

Reference docs:
- `data-scraper/README.md`
- `docs/requirements/Initial-build.md`

Typical scraper flow (from `data-scraper/`):

```bash
recon discover --out data/discovery/discovered_candidates.json
recon build --seed data/discovery/discovered_candidates.json --out data
recon report --out data/report.md
```

Then wire the frontend sync script to the generated output directories you want to publish.

## Important Technical Notes

- Dates from scraper data can be mixed formats (ISO, ISO datetime, natural language). The frontend normalizes these for status/countdown logic.
- Missing data is expected and rendered explicitly as `Not published`/`Unknown`.
- Progress tracking is intentionally cookie-only (no backend/local account state).
- BHP currently has no local logo asset in the selected seed output; UI handles missing logos gracefully.

## Squad Recon (Grad Employer Dashboard) — Requirements (v1)

### 0) Scope decisions (locked)

* **Employer set:** “Top grad employers” (not strictly ASX). Start with ASX top ~15 + major banks, consulting, big tech, major govt programs, large retailers, key multinationals with strong AU grad pipelines.
* **Sources:** **Official only** (company careers pages, official PDFs, official program pages, official annual report/results pages/transcripts where available on their site).
* **Coverage:** It’s acceptable to show **Unknown / Not published** per field. Must show provenance + last updated.
* **Cadence:** No scheduled job required. Provide a **CLI** that can be run manually to (re)generate JSON.
* **No auth:** No login. Optional local-only state via **localStorage** (or cookies) is fine but not required.
* **PeopleSquad branding:** subtle header branding + 1–2 callouts/CTAs (defer detailed placement for now).

---

## 1) Product Intent

A fast, single-page dashboard for students to:

* browse/select a grad employer,
* see key program facts + eligibility + dates at a glance,
* jump to official apply link,
* optionally understand “what the company cares about right now” via short, sourced summaries from official reports.

---

## 2) MVP UX / IA Requirements

### 2.1 Navigation & Layout

**MVP should work as a “single-screen browse”**:

* **Left panel (or top on mobile):** employer list with minimal summary (open/close status, close date if known).
* **Main panel:** “Company Canvas” (selected employer details).

**Search/Filter**

* Search by employer name.
* Filters:

  * `Open now` (if open/close known)
  * `Closing soon` (<= N days; default 7)
  * `Eligibility tags` (Citizen/PR, discipline tags if present)
  * `Stream tags` (Tech, Business, Finance, etc. if present)

**Empty states**

* No selection → show “Pick an employer” and a short explanation.
* Missing data → show “Not published” and a “Sources” section.

### 2.2 Canvas Sections

**A) Utility Header**

* Employer name + logo
* Primary CTA: **Direct Apply** (official URL)
* Application status chip (computed):

  * `Open`, `Closed`, `Unknown`
* Dates (if known):

  * Open date
  * Close date
  * Countdown (close - today)
* Eligibility tags (short pills)
* Salary display:

  * show only if sourced (else “Not published”)
* “Updated” timestamp + confidence badge

**B) Essential Program Facts (student-facing)**
5 cards (content may be missing; show placeholders):

1. Recruitment archetype (short descriptor)
2. Rotation / program structure
3. Support / mentorship structure
4. Conversion / progression strategy (“what happens after”)
5. Success signals (what they reward)

**C) Critical Commercial Context (official-source summaries)**
5 cards:

1. Exec repeating themes / priorities
2. Profit engine (business model summary)
3. Market headwinds / risks
4. ESG / strategic commitments (only if prominent)
5. Recent pivot / major initiative

**D) Sources & Provenance (mandatory)**

* List of sources used (title + url + retrieved date)
* “Field-level provenance” if feasible (at least section-level)
* Confidence notes / limitations

---

## 3) Functional Requirements (Frontend)

### 3.1 Data loading

* Loads a **small index JSON** first (fast list render).
* Lazy-loads employer detail JSON on selection.
* No backend required at runtime.

### 3.2 Rendering rules

* Every field supports: `value | Not published | Unknown`.
* Dates must render in **AU-friendly format** (e.g., `12 Mar 2026`).
* Countdown only if close date exists and is in future.
* “Open/Closed” logic:

  * If open_date & close_date exist: open iff now in range.
  * If only close_date exists: treat as open unless close passed (with “assumed” note).
  * Else: status unknown.

### 3.3 Search & filtering

* Client-side search (string match).
* Filtering uses tags and computed status.

### 3.4 Optional local state (nice-to-have)

* Local-only “My status” per employer (Not started / Applied / Interviewing / Offer).
* Stored in localStorage. No sync. No account.

### 3.5 Branding & CTAs (MVP light)

* Header includes:

  * PeopleSquad logo + tool name (“Graduate Program Dashboard”)
  * Tagline + link to PeopleSquad course landing page
* No banners/popups.

---

## 4) Functional Requirements (Scraper CLI)

### 4.1 CLI goals

* One command to build JSON dataset:

  * `recon build --out ./data`
* Support a controlled employer list input:

  * `recon build --seed employers_seed.json`
* Support building single employer:

  * `recon build --company coles`
* Provide a human-readable report:

  * `recon report --out report.md` (field availability + warnings)

### 4.2 Inputs

* `employers_seed.json` contains:

  * employer id
  * official careers base URL(s)
  * known grad program page URL(s) if available
  * optional hints (selectors / patterns)

### 4.3 Source policy

* Only fetch from:

  * careers pages
  * official PDFs on company domain
  * official investor relations pages on company domain
* No GradAustralia/seek/etc.
* If blocked/unclear, record **Unknown** and warn in report.

### 4.4 Extracted data requirements

Tiered extraction:

* **Tier 1 (must attempt):**

  * Direct apply URL
  * Open/close dates (or at least close)
  * Eligibility constraints (citizenship/work rights; graduation window; disciplines)
  * Streams / locations (if listed)
  * Hiring stages list (if described)
  * Source list + retrieval timestamps
* **Tier 2 (attempt):**

  * Salary range (rare; only if explicit)
  * Program duration/rotation specifics
* **Tier 3 (derived summaries; official documents only):**

  * Exec themes / priorities
  * Headwinds / risks
  * Strategic initiatives
  * Profit engine summary

### 4.5 Provenance + confidence

* Every “section” must include:

  * `sources[]` (url, title, type, retrieved_at)
  * `confidence` (High/Med/Low)
  * `notes` explaining gaps
* If field-level provenance is too heavy initially:

  * require at least section-level provenance.

### 4.6 Output structure

* `data/index.json` (list view, minimal)
* `data/companies/{id}.json` (full detail)
* `data/schema_version.json` (or embedded version)
* `data/build_meta.json` (build time, CLI version, warnings summary)

---

## 5) Non-Functional Requirements

* **Speed:** index.json <= ~200–400KB for ~50–100 employers (keep list fields minimal).
* **Resilience:** CLI should not fail the entire build because one employer breaks; continue and log.
* **Maintainability:** adapter-based parsing per employer/source-type; tests via stored fixtures.
* **Transparency:** always show sources + “not published” instead of guessing.
* **Legal/compliance hygiene:** respect reasonable rate limits; identify user agent; avoid bypassing restrictions.

---

## 6) Data Fields (recommended set)

### 6.1 Employer identity

* id, name, logo_url
* industry tags
* headquarters/primary AU locations (if stated)
* official careers URL

### 6.2 Program availability

* open_date, close_date (nullable)
* status (computed or stored)
* direct_apply_url
* program_streams[] (Tech/Finance/etc.)
* locations[] (cities/states)

### 6.3 Eligibility

* work_rights (Citizen/PR only etc.)
* graduation_window (e.g., “2024–2026 graduates”)
* degree_disciplines[] (if listed)
* minimum_requirements (free text, short)

### 6.4 Recruitment process

* stages[] (e.g., Psychometric, Video, AC, Panel)
* tips (optional short bullets sourced from their own page)

### 6.5 Student-facing “5 essential facts”

* archetype
* rotation_logic
* support_hierarchy
* conversion_strategy
* success_signal

### 6.6 Commercial context “5 critical fields”

* exec_themes
* profit_engine
* headwinds
* esg
* recent_pivot

### 6.7 Provenance

* sources[] + retrieved timestamps
* confidence + notes

---

# Proposed JSON Schema (practical, not overly academic)

## A) `data/index.json` (list view)

Minimal fields for fast rendering and filtering.

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-03-05T00:00:00Z",
  "companies": [
    {
      "id": "coles",
      "name": "Coles Group",
      "logo_url": "https://.../coles.svg",
      "career_url": "https://...",

      "apply": {
        "direct_apply_url": "https://...",
        "open_date": "2026-02-01",
        "close_date": "2026-03-10",
        "status": "open"
      },

      "tags": {
        "streams": ["Finance", "Tech"],
        "eligibility": ["Citizen/PR only"],
        "industries": ["Retail"]
      },

      "updated_at": "2026-03-05T00:00:00Z",
      "confidence": "medium"
    }
  ]
}
```

## B) `data/companies/{id}.json` (detail view)

Full canvas payload.

```json
{
  "schema_version": "1.0",
  "id": "coles",
  "name": "Coles Group",
  "logo_url": "https://.../coles.svg",
  "career_url": "https://...",
  "summary": {
    "one_liner": "Australian retailer with major supermarket and liquor operations.",
    "industries": ["Retail"],
    "keywords": ["Operations", "Supply chain", "Value"]
  },

  "program": {
    "name": "Graduate Program",
    "streams": [
      { "name": "Finance", "notes": null },
      { "name": "Technology", "notes": null }
    ],
    "locations": ["Melbourne", "Sydney"],
    "dates": {
      "open_date": "2026-02-01",
      "close_date": "2026-03-10",
      "status": "open",
      "timezone": "Australia/Melbourne"
    },
    "links": {
      "direct_apply_url": "https://...",
      "program_overview_url": "https://..."
    },
    "salary": {
      "range": { "min": 72000, "max": 78000, "currency": "AUD" },
      "super_included": false,
      "source_note": "If explicitly stated, store exact phrasing in notes.",
      "notes": null
    }
  },

  "eligibility": {
    "work_rights": "Citizen/PR only",
    "graduation_window": "2024–2026 graduates",
    "disciplines": ["Business", "IT", "Commerce"],
    "minimum_requirements": [
      "Eligible to work full-time in Australia",
      "Completed or completing a relevant degree"
    ],
    "notes": "Use 'Not published' / null if absent."
  },

  "recruitment_process": {
    "stages": [
      { "name": "Online application", "details": null },
      { "name": "Psychometric testing", "details": null },
      { "name": "Video interview", "details": null },
      { "name": "Assessment centre", "details": null },
      { "name": "Final interview", "details": null }
    ],
    "candidate_tips": [
      "Short sourced tips only if on official page."
    ]
  },

  "canvas": {
    "essential_program_facts": [
      {
        "key": "recruitment_archetype",
        "title": "Recruitment Archetype",
        "value": "Adaptable Generalist",
        "subtitle": "High EQ, agile learning",
        "confidence": "medium",
        "notes": "Derived from official wording; keep short."
      },
      {
        "key": "rotation_logic",
        "title": "Rotation Logic",
        "value": "Fluid",
        "subtitle": "3 rotations × 8 months",
        "confidence": "low",
        "notes": "If not explicitly stated, mark low and explain."
      },
      {
        "key": "support_hierarchy",
        "title": "Support Hierarchy",
        "value": "Triangle",
        "subtitle": "Buddy → Manager → Sponsor",
        "confidence": "low",
        "notes": null
      },
      {
        "key": "conversion_strategy",
        "title": "Conversion Strategy",
        "value": "Future Leaders",
        "subtitle": "Fast-track to management",
        "confidence": "medium",
        "notes": null
      },
      {
        "key": "success_signal",
        "title": "Success Signal",
        "value": "Customer Obsession",
        "subtitle": "Data-driven empathy",
        "confidence": "medium",
        "notes": null
      }
    ],

    "critical_commercial_fields": [
      {
        "key": "exec_repeating_words",
        "title": "Exec Themes",
        "value": ["Operational efficiency", "Supply chain resilience", "Value for customers"],
        "confidence": "high",
        "notes": "Extracted from official report/transcript."
      },
      {
        "key": "profit_engine",
        "title": "Profit Engine",
        "value": "Supermarkets + Liquor + Loyalty monetisation",
        "confidence": "medium",
        "notes": null
      },
      {
        "key": "market_headwinds",
        "title": "Market Headwinds",
        "value": "Inflationary costs and supply chain disruption",
        "confidence": "medium",
        "notes": null
      },
      {
        "key": "esg_action_item",
        "title": "ESG",
        "value": "Net zero by 2050 (scope 1 & 2 targets)",
        "confidence": "medium",
        "notes": null
      },
      {
        "key": "recent_pivot",
        "title": "Recent Pivot",
        "value": "Automation in fulfilment / distribution efficiency",
        "confidence": "low",
        "notes": null
      }
    ]
  },

  "provenance": {
    "updated_at": "2026-03-05T00:00:00Z",
    "sources": [
      {
        "type": "careers_page",
        "title": "Coles Graduate Program – Careers",
        "url": "https://...",
        "retrieved_at": "2026-03-05T00:00:00Z"
      },
      {
        "type": "annual_report",
        "title": "Annual Report 2025 (PDF)",
        "url": "https://...",
        "retrieved_at": "2026-03-05T00:00:00Z"
      }
    ],
    "notes": [
      "Salary not published on official pages (left blank).",
      "Rotation structure inferred from partial wording; verify if updated."
    ],
    "warnings": []
  }
}
```

### Enumerations (recommended)

* `confidence`: `"high" | "medium" | "low"`
* `status`: `"open" | "closed" | "unknown"`
* `source.type`: `"careers_page" | "program_page" | "pdf" | "annual_report" | "results_transcript" | "investor_relations" | "other_official"`

---

## 7) “Employer Discovery” requirement (your background research step)

Because you’re not strictly ASX, define a pragmatic discovery workflow:

**Output:** `employers_seed.json`

**Requirements**

* Start list assembled manually (first pass) + iterated as you learn.
* Each seed entry includes:

  * employer id (slug)
  * official careers URL
  * known grad program URL (if you can find it)
  * optional investor relations URL (for reports)

Example seed entry:

```json
{
  "id": "commonwealth-bank",
  "name": "Commonwealth Bank",
  "careers_url": "https://www.commbank.com.au/about-us/careers.html",
  "grad_program_url": "https://www.commbank.com.au/about-us/careers/graduate-program.html",
  "investor_relations_url": "https://www.commbank.com.au/about-us/investors.html"
}
```

---

## 8) Build Deliverables (what “done” looks like)

### MVP deliverables

1. Static frontend (Vite React) with:

   * list + search + filters
   * detail canvas
   * sources/provenance view
2. CLI tool that:

   * reads `employers_seed.json`
   * generates `index.json` + `companies/{id}.json`
   * outputs `report.md` summarising missing fields, failures, and last-updated
3. A documented schema + sample data for 3–5 employers

### Quality bar

* Clear “unknown/not published” handling everywhere
* No silent guessing
* No secondary sources
* Fast load and usable on mobile

---

## 9) Implementation Notes (tight, practical)

* Keep `index.json` tiny: only fields needed for list + filter.
* Treat “commercial fields” as **derived summaries**: label them as such and keep sources.
* Prefer storing raw snippets only in CLI logs; UI shows short bullets.
* Frontend should never break if a section is missing: show cards with “Not published”.
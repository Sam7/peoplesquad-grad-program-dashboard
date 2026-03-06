Company: {{company_name}}
Entity type: {{entity_type}}
Official domains: {{official_domains_json}}
Known urls: {{known_urls_json}}
Classification: {{classification_json}}

Extract:
- Program basics (name, links, dates, streams, locations, salary/duration/rotation text)
- Eligibility (work rights, grad window, disciplines, minimum requirements)
- Recruitment process (stages, tips)
- Section-level provenance with confidence, notes, and sources.
- For date fields, prioritize finding clear evidence and return `open_date`/`close_date` as `YYYY-MM-DD`.
- Always include `open_date_raw`, `close_date_raw`, `open_date_precision`, and `close_date_precision`.
- If only a month is stated with a year, keep that year.
- If only a month is stated with no year, assume the current year.
- Use language that students can understand quickly.
- Keep wording factual, plain English, and easy to scan.

Return strict JSON only.

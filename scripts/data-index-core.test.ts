import { describe, expect, it } from "vitest";
import { assertIndexMatchesDetails, buildIndexPayloadFromDetails } from "./data-index-core.mjs";

function buildDetail(
  id: string,
  name: string,
  {
    openDate = null,
    closeDate = null,
    openDateRaw = null,
    closeDateRaw = null,
    openDatePrecision = null,
    closeDatePrecision = null
  }: {
    openDate?: string | null;
    closeDate?: string | null;
    openDateRaw?: string | null;
    closeDateRaw?: string | null;
    openDatePrecision?: string | null;
    closeDatePrecision?: string | null;
  } = {}
): Record<string, unknown> {
  return {
    schema_version: "1.0",
    id,
    name,
    entity_type: "company",
    classification: {
      industry_bucket: "Technology"
    },
    urls: {
      careers_url: `https://example.com/${id}/careers`
    },
    logo_url: null,
    program: {
      name: `${name} Grad Program`,
      overview_url: `https://example.com/${id}/grad`,
      direct_apply_url: `https://example.com/${id}/apply`,
      open_date: openDate,
      close_date: closeDate,
      open_date_raw: openDateRaw,
      close_date_raw: closeDateRaw,
      open_date_precision: openDatePrecision,
      close_date_precision: closeDatePrecision,
      streams: ["Technology"],
      locations: [],
      salary_text: null,
      duration_text: null,
      rotation_text: null
    },
    eligibility: {
      work_rights: "Citizen or PR"
    },
    section_provenance: {
      program: {
        confidence: "medium"
      }
    },
    provenance: {
      updated_at: "2026-03-06T01:00:00Z",
      sources: [],
      notes: []
    }
  };
}

describe("data-index-core", () => {
  it("builds index apply fields from canonical company detail program fields", () => {
    const detailsById = new Map<string, Record<string, unknown>>();
    detailsById.set(
      "canonical-co",
      buildDetail("canonical-co", "Canonical Co", {
        openDate: "2026-03-30",
        closeDate: "2026-04-21",
        openDateRaw: "Applications open 30 March 2026",
        closeDateRaw: "Applications close 21 April 2026",
        openDatePrecision: "exact_day",
        closeDatePrecision: "exact_day"
      })
    );

    const indexPayload = buildIndexPayloadFromDetails(detailsById, "2026-03-06T00:00:00Z");
    const company = indexPayload.companies[0];
    expect(company?.id).toBe("canonical-co");
    expect(company?.apply.open_date).toBe("2026-03-30");
    expect(company?.apply.close_date).toBe("2026-04-21");
    expect(company?.apply.open_date_raw).toBe("Applications open 30 March 2026");
    expect(company?.apply.close_date_raw).toBe("Applications close 21 April 2026");
    expect(company?.apply.open_date_precision).toBe("exact_day");
    expect(company?.apply.close_date_precision).toBe("exact_day");
  });

  it("throws when index apply fields drift from canonical detail program fields", () => {
    const detailsById = new Map<string, Record<string, unknown>>();
    detailsById.set(
      "drift-co",
      buildDetail("drift-co", "Drift Co", {
        openDate: "2026-03-30",
        closeDate: "2026-04-21",
        openDateRaw: "Applications open 30 March 2026",
        closeDateRaw: "Applications close 21 April 2026",
        openDatePrecision: "exact_day",
        closeDatePrecision: "exact_day"
      })
    );

    const indexPayload = {
      schema_version: "1.0",
      generated_at: "2026-03-06T00:00:00Z",
      companies: [
        {
          id: "drift-co",
          name: "Drift Co",
          entity_type: "company",
          logo_url: null,
          career_url: "https://example.com/drift-co/careers",
          apply: {
            direct_apply_url: "https://example.com/drift-co/apply",
            open_date: null,
            close_date: "2026-04-21",
            open_date_raw: null,
            close_date_raw: "Applications close 21 April 2026",
            open_date_precision: "missing",
            close_date_precision: "exact_day",
            status: "unknown"
          },
          tags: {
            streams: ["Technology"],
            eligibility: ["Citizen or PR"],
            industries: ["Technology"]
          },
          updated_at: "2026-03-06T01:00:00Z",
          confidence: "medium"
        }
      ]
    };

    expect(() => assertIndexMatchesDetails(indexPayload, detailsById)).toThrow(/drift-co/);
    expect(() => assertIndexMatchesDetails(indexPayload, detailsById)).toThrow(/open_date/);
  });
});

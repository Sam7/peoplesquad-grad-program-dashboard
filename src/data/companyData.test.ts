import { describe, expect, it } from "vitest";
import { mapIndexToListCompanies, type CompanyIndexPayload } from "./companyData";

describe("mapIndexToListCompanies", () => {
  it("normalizes index records for UI consumption", () => {
    const payload: CompanyIndexPayload = {
      schema_version: "1.0",
      generated_at: "2026-03-05T00:00:00Z",
      companies: [
        {
          id: "bhp-group",
          name: "BHP Group",
          entity_type: "company",
          logo_url: null,
          career_url: "https://www.bhp.com/careers/",
          apply: {
            direct_apply_url: "https://careers.bhp.com/",
            open_date: null,
            close_date: "6 April 2026",
            status: "unknown"
          },
          tags: {
            streams: ["Engineering"],
            eligibility: ["International students with a valid visa are welcome to apply"],
            industries: ["Resources"]
          },
          updated_at: "2026-03-05T00:00:00Z",
          confidence: "medium"
        }
      ]
    };

    const companies = mapIndexToListCompanies(
      payload,
      {
        "bhp-group": "applied"
      },
      new Date("2026-04-01T12:00:00+11:00")
    );
    expect(companies).toHaveLength(1);
    expect(companies[0].id).toBe("bhp-group");
    expect(companies[0].status).toBe("open");
    expect(companies[0].progressState).toBe("applied");
    expect(companies[0].workRightsText).toContain("visa");
  });

  it("maps future open_date programs to upcoming status", () => {
    const payload: CompanyIndexPayload = {
      schema_version: "1.0",
      generated_at: "2026-03-05T00:00:00Z",
      companies: [
        {
          id: "future-co",
          name: "Future Co",
          entity_type: "company",
          logo_url: null,
          career_url: "https://example.com/careers",
          apply: {
            direct_apply_url: "https://example.com/apply",
            open_date: "2026-04-10",
            close_date: "2026-04-30",
            status: "unknown"
          },
          tags: {
            streams: ["Tech"],
            eligibility: ["Citizen or PR"],
            industries: ["Technology"]
          },
          updated_at: "2026-03-05T00:00:00Z",
          confidence: "high"
        }
      ]
    };

    const companies = mapIndexToListCompanies(payload, {}, new Date("2026-04-05T12:00:00+10:00"));
    expect(companies[0].status).toBe("upcoming");
  });
});

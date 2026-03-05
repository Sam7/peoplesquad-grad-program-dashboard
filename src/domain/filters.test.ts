import { describe, expect, it } from "vitest";
import {
  buildSearchParams,
  classifyWorkRights,
  defaultFilters,
  filterAndSortCompanies,
  parseSearchParams,
  type UiCompany
} from "./filters";

const baseCompanies: UiCompany[] = [
  {
    id: "coles-group",
    name: "Coles Group",
    streamTags: ["Technology", "Finance"],
    workRightsText: "Australian or New Zealand citizens or permanent residents",
    status: "open",
    closeDateRaw: "2026-04-12",
    progressState: "saved"
  },
  {
    id: "bhp-group",
    name: "BHP Group",
    streamTags: ["Engineering"],
    workRightsText: "International students with a valid visa are welcome to apply",
    status: "open",
    closeDateRaw: "6 April 2026",
    progressState: "none"
  },
  {
    id: "xero",
    name: "Xero",
    streamTags: ["Technical program"],
    workRightsText: null,
    status: "unknown",
    closeDateRaw: null,
    progressState: "none"
  },
  {
    id: "westpac",
    name: "Westpac",
    streamTags: ["Business"],
    workRightsText: "Australian or New Zealand Citizen",
    status: "closed",
    closeDateRaw: "2026-03-01",
    progressState: "none"
  }
];

describe("search param round-trip", () => {
  it("parses and re-builds filters", () => {
    const params = new URLSearchParams("q=co&open=1&soon=1&stream=Technology&workRights=citizen_pr&sort=name&view=board");
    const parsed = parseSearchParams(params);
    const rebuilt = buildSearchParams(parsed).toString();

    expect(parsed.q).toBe("co");
    expect(parsed.open).toBe(true);
    expect(parsed.view).toBe("board");
    expect(parsed.stream).toEqual(["Technology"]);
    expect(rebuilt).toContain("q=co");
    expect(rebuilt).toContain("open=1");
  });

  it("uses defaults for invalid values", () => {
    const parsed = parseSearchParams(new URLSearchParams("sort=invalid&soonDays=-2&view=bad"));
    expect(parsed).toEqual(defaultFilters());
  });
});

describe("classifyWorkRights", () => {
  it("classifies citizen/pr language", () => {
    expect(classifyWorkRights("Australian citizen or permanent resident")).toBe("citizen_pr");
  });

  it("classifies visa-eligible language", () => {
    expect(classifyWorkRights("valid visa and no work restrictions")).toBe("visa_ok");
  });

  it("classifies missing text as unknown", () => {
    expect(classifyWorkRights(null)).toBe("unknown");
  });
});

describe("filterAndSortCompanies", () => {
  it("filters by search, stream, and work rights", () => {
    const filters = {
      ...defaultFilters(),
      q: "co",
      stream: ["Technology"],
      workRights: "citizen_pr" as const
    };

    const result = filterAndSortCompanies(baseCompanies, filters, new Date("2026-04-01T12:00:00+11:00"));
    expect(result.map((c) => c.id)).toEqual(["coles-group"]);
  });

  it("puts expired companies at bottom for deadline sort", () => {
    const result = filterAndSortCompanies(baseCompanies, defaultFilters(), new Date("2026-04-01T12:00:00+11:00"));
    expect(result[result.length - 1]?.id).toBe("westpac");
  });

  it("supports closing-soon filter", () => {
    const filters = {
      ...defaultFilters(),
      soon: true,
      soonDays: 7
    };

    const result = filterAndSortCompanies(baseCompanies, filters, new Date("2026-04-01T12:00:00+11:00"));
    expect(result.map((c) => c.id)).toEqual(["bhp-group"]);
  });
});

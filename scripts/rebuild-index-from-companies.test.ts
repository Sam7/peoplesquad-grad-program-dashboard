import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rebuildIndexFromCompanies } from "./rebuild-index-from-companies.mjs";

const createdDirs: string[] = [];

function buildDetail(id: string, name: string): Record<string, unknown> {
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
      name: `${name} Graduate Program`,
      overview_url: `https://example.com/${id}/grad`,
      direct_apply_url: `https://example.com/${id}/apply`,
      open_date: "2026-03-30",
      close_date: "2026-04-21",
      open_date_raw: "Applications open 30 March 2026",
      close_date_raw: "Applications close 21 April 2026",
      open_date_precision: "exact_day",
      close_date_precision: "exact_day",
      streams: ["Technology"],
      locations: [],
      salary_text: null,
      duration_text: null,
      rotation_text: null
    },
    eligibility: {
      work_rights: "Citizen or PR"
    },
    recruitment_process: {
      stages: [],
      tips: []
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

afterEach(async () => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe("rebuildIndexFromCompanies", () => {
  it("rebuilds index.json from companies directory details", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "ps-reindex-"));
    createdDirs.push(dataDir);
    await mkdir(join(dataDir, "companies"), { recursive: true });

    await writeFile(
      join(dataDir, "companies", "canonical-co.json"),
      `${JSON.stringify(buildDetail("canonical-co", "Canonical Co"), null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(dataDir, "index.json"),
      `${JSON.stringify({ schema_version: "1.0", generated_at: "2026-03-06T00:00:00Z", companies: [] }, null, 2)}\n`,
      "utf8"
    );

    const result = await rebuildIndexFromCompanies({ dataDir });
    expect(result.companyCount).toBe(1);

    const indexRaw = await readFile(join(dataDir, "index.json"), "utf8");
    const index = JSON.parse(indexRaw) as { companies: Array<{ id: string; apply: { open_date: string | null } }> };
    expect(index.companies).toHaveLength(1);
    expect(index.companies[0]?.id).toBe("canonical-co");
    expect(index.companies[0]?.apply.open_date).toBe("2026-03-30");
  });
});

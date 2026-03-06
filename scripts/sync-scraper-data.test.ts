import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncScraperData } from "./sync-scraper-data-core.mjs";

const createdDirs: string[] = [];

type DetailDateFields = {
  openDate?: string | null;
  closeDate?: string | null;
  openDateRaw?: string | null;
  closeDateRaw?: string | null;
  openDatePrecision?: string | null;
  closeDatePrecision?: string | null;
};

function buildDetailPayload(
  id: string,
  name: string,
  {
    openDate = null,
    closeDate = null,
    openDateRaw = null,
    closeDateRaw = null,
    openDatePrecision = null,
    closeDatePrecision = null
  }: DetailDateFields = {}
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
      name: `${name} Graduate Program`,
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

describe("syncScraperData", () => {
  it("merges the three selected datasets into a single frontend payload", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "ps-sync-"));
    createdDirs.push(outDir);

    await syncScraperData({
      sourceRoots: [
        resolve("data-scraper/data/archive/experiments/e2e-three/coles"),
        resolve("data-scraper/data/archive/experiments/e2e-three/bhp"),
        resolve("data-scraper/data/archive/experiments/e2e-three/xero")
      ],
      outDir
    });

    const indexRaw = await readFile(join(outDir, "index.json"), "utf8");
    const index = JSON.parse(indexRaw) as { companies: Array<{ id: string }> };

    expect(index.companies).toHaveLength(3);
    expect(index.companies.map((c) => c.id).sort()).toEqual(["bhp-group", "coles-group", "xero"]);

    const companyFiles = await readdir(join(outDir, "companies"));
    expect(companyFiles.sort()).toEqual(["bhp-group.json", "coles-group.json", "xero.json"]);

    const logosDir = join(outDir, "assets", "logos");
    const logos = await readdir(logosDir);
    expect(logos).toContain("coles-group-peoplesquad-logo.webp");
    expect(logos).toContain("xero-peoplesquad-logo.webp");

    const bhpDetailRaw = await readFile(join(outDir, "companies", "bhp-group.json"), "utf8");
    const bhpDetail = JSON.parse(bhpDetailRaw) as { logo_url: string | null };
    expect(bhpDetail.logo_url).toBeNull();

    const indexStat = await stat(join(outDir, "index.json"));
    expect(indexStat.size).toBeGreaterThan(0);
  });

  it("overwrites existing output companies from source and regenerates index from detail payloads", async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), "ps-sync-fixture-"));
    const outDir = await mkdtemp(join(tmpdir(), "ps-sync-out-"));
    createdDirs.push(fixtureDir, outDir);

    const sourceRoot = join(fixtureDir, "source");
    await mkdir(join(sourceRoot, "companies"), { recursive: true });

    const existingId = "existing-co";
    const newId = "new-co";

    const existingPublicDetail = {
      ...buildDetailPayload(existingId, "Existing Co (Public)", {
        openDate: "2026-01-01",
        closeDate: "2026-01-31",
        openDateRaw: "1 Jan 2026",
        closeDateRaw: "31 Jan 2026",
        openDatePrecision: "exact_day",
        closeDatePrecision: "exact_day"
      }),
      keep_me: true
    };

    await mkdir(join(outDir, "companies"), { recursive: true });
    await writeFile(join(outDir, "companies", `${existingId}.json`), `${JSON.stringify(existingPublicDetail, null, 2)}\n`, "utf8");
    await writeFile(
      join(outDir, "index.json"),
      `${JSON.stringify(
        {
          schema_version: "1.0",
          generated_at: "2026-03-06T00:00:00Z",
          companies: [
            {
              id: existingId,
              name: "Existing Co (Stale Index)",
              entity_type: "company",
              logo_url: null,
              career_url: null,
              apply: {
                direct_apply_url: null,
                open_date: null,
                close_date: null,
                open_date_raw: null,
                close_date_raw: null,
                open_date_precision: "missing",
                close_date_precision: "missing",
                status: "unknown"
              },
              tags: {
                streams: [],
                eligibility: [],
                industries: ["Other"]
              },
              updated_at: "2026-03-06T00:00:00Z",
              confidence: "low"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const sourceIndex = {
      schema_version: "1.0",
      generated_at: "2026-03-06T01:00:00Z",
      companies: [
        {
          id: existingId,
          name: "Existing Co (Source Index)",
          entity_type: "company",
          logo_url: null,
          career_url: null,
          apply: {
            direct_apply_url: null,
            open_date: null,
            close_date: null,
            status: "unknown"
          },
          tags: {
            streams: [],
            eligibility: [],
            industries: ["Other"]
          },
          updated_at: "2026-03-06T01:00:00Z",
          confidence: "low"
        },
        {
          id: newId,
          name: "New Co (Source Index)",
          entity_type: "company",
          logo_url: null,
          career_url: null,
          apply: {
            direct_apply_url: null,
            open_date: null,
            close_date: null,
            status: "unknown"
          },
          tags: {
            streams: [],
            eligibility: [],
            industries: ["Other"]
          },
          updated_at: "2026-03-06T01:00:00Z",
          confidence: "low"
        }
      ]
    };

    await writeFile(join(sourceRoot, "index.json"), `${JSON.stringify(sourceIndex, null, 2)}\n`, "utf8");
    await writeFile(
      join(sourceRoot, "companies", `${existingId}.json`),
      `${JSON.stringify(
        {
          ...buildDetailPayload(existingId, "Existing Co (Scraped Update)", {
            openDate: "2026-03-01",
            closeDate: "2026-04-01",
            openDateRaw: "March 2026",
            closeDateRaw: "April 2026",
            openDatePrecision: "month_year_normalized",
            closeDatePrecision: "month_year_normalized"
          }),
          keep_me: false
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(sourceRoot, "companies", `${newId}.json`),
      `${JSON.stringify(
        buildDetailPayload(newId, "New Co", {
          openDate: "2026-03-10",
          closeDate: "2026-05-01",
          openDateRaw: "10 March 2026",
          closeDateRaw: "May 2026",
          openDatePrecision: "exact_day",
          closeDatePrecision: "month_year_normalized"
        }),
        null,
        2
      )}\n`,
      "utf8"
    );

    await syncScraperData({
      sourceRoots: [sourceRoot],
      outDir
    });

    const existingOutRaw = await readFile(join(outDir, "companies", `${existingId}.json`), "utf8");
    const existingOut = JSON.parse(existingOutRaw) as { name: string; keep_me: boolean };
    expect(existingOut.name).toBe("Existing Co (Scraped Update)");
    expect(existingOut.keep_me).toBe(false);

    const mergedIndexRaw = await readFile(join(outDir, "index.json"), "utf8");
    const mergedIndex = JSON.parse(mergedIndexRaw) as {
      companies: Array<{
        id: string;
        name: string;
        apply: {
          open_date: string | null;
          close_date: string | null;
          open_date_raw: string | null;
          close_date_raw: string | null;
          open_date_precision: string | null;
          close_date_precision: string | null;
        };
      }>;
    };

    expect(mergedIndex.companies.map((c) => c.id).sort()).toEqual([existingId, newId]);
    const existingFromIndex = mergedIndex.companies.find((c) => c.id === existingId);
    expect(existingFromIndex?.name).toBe("Existing Co (Scraped Update)");
    expect(existingFromIndex?.apply.open_date).toBe("2026-03-01");
    expect(existingFromIndex?.apply.close_date).toBe("2026-04-01");
    expect(existingFromIndex?.apply.open_date_raw).toBe("March 2026");
    expect(existingFromIndex?.apply.close_date_raw).toBe("April 2026");
    expect(existingFromIndex?.apply.open_date_precision).toBe("month_year_normalized");
    expect(existingFromIndex?.apply.close_date_precision).toBe("month_year_normalized");
  });

  it("uses later source roots as the winner when the same company id appears multiple times", async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), "ps-sync-priority-fixture-"));
    const outDir = await mkdtemp(join(tmpdir(), "ps-sync-priority-out-"));
    createdDirs.push(fixtureDir, outDir);

    const sourceA = join(fixtureDir, "source-a");
    const sourceB = join(fixtureDir, "source-b");
    await mkdir(join(sourceA, "companies"), { recursive: true });
    await mkdir(join(sourceB, "companies"), { recursive: true });

    const companyId = "priority-co";

    await writeFile(
      join(sourceA, "index.json"),
      `${JSON.stringify({ schema_version: "1.0", generated_at: "2026-03-06T00:00:00Z", companies: [{ id: companyId }] }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(sourceB, "index.json"),
      `${JSON.stringify({ schema_version: "1.0", generated_at: "2026-03-06T00:00:00Z", companies: [{ id: companyId }] }, null, 2)}\n`,
      "utf8"
    );

    await writeFile(
      join(sourceA, "companies", `${companyId}.json`),
      `${JSON.stringify(
        buildDetailPayload(companyId, "Priority Co - Source A", {
          openDate: "2026-01-01",
          closeDate: "2026-01-31"
        }),
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(sourceB, "companies", `${companyId}.json`),
      `${JSON.stringify(
        buildDetailPayload(companyId, "Priority Co - Source B", {
          openDate: "2026-02-01",
          closeDate: "2026-02-28"
        }),
        null,
        2
      )}\n`,
      "utf8"
    );

    await syncScraperData({
      sourceRoots: [sourceA, sourceB],
      outDir
    });

    const outDetailRaw = await readFile(join(outDir, "companies", `${companyId}.json`), "utf8");
    const outDetail = JSON.parse(outDetailRaw) as { name: string; program?: { open_date?: string } };
    expect(outDetail.name).toBe("Priority Co - Source B");
    expect(outDetail.program?.open_date).toBe("2026-02-01");

    const outIndexRaw = await readFile(join(outDir, "index.json"), "utf8");
    const outIndex = JSON.parse(outIndexRaw) as { companies: Array<{ id: string; name: string; apply?: { open_date?: string | null } }> };
    expect(outIndex.companies).toHaveLength(1);
    expect(outIndex.companies[0]?.id).toBe(companyId);
    expect(outIndex.companies[0]?.name).toBe("Priority Co - Source B");
    expect(outIndex.companies[0]?.apply?.open_date).toBe("2026-02-01");
  });

  it("hard refresh replaces managed data with source snapshot", async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), "ps-sync-hard-refresh-fixture-"));
    const outDir = await mkdtemp(join(tmpdir(), "ps-sync-hard-refresh-out-"));
    createdDirs.push(fixtureDir, outDir);

    const sourceRoot = join(fixtureDir, "source");
    await mkdir(join(sourceRoot, "companies"), { recursive: true });
    await mkdir(join(sourceRoot, "assets", "logos"), { recursive: true });

    const existingId = "existing-co";
    const newId = "new-co";
    const staleId = "stale-co";
    const sharedLogo = "existing-co-peoplesquad-logo.webp";
    const staleLogo = "stale-logo.webp";

    await mkdir(join(outDir, "companies"), { recursive: true });
    await mkdir(join(outDir, "assets", "logos"), { recursive: true });
    await writeFile(
      join(outDir, "companies", `${existingId}.json`),
      `${JSON.stringify({ ...buildDetailPayload(existingId, "Existing Co (Public)"), keep_me: true }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(outDir, "companies", `${staleId}.json`),
      `${JSON.stringify(buildDetailPayload(staleId, "Stale Co"), null, 2)}\n`,
      "utf8"
    );
    await writeFile(join(outDir, "assets", "logos", sharedLogo), "public-logo", "utf8");
    await writeFile(join(outDir, "assets", "logos", staleLogo), "stale-logo", "utf8");
    await writeFile(
      join(outDir, "index.json"),
      `${JSON.stringify(
        {
          schema_version: "1.0",
          generated_at: "2026-03-06T00:00:00Z",
          companies: [{ id: existingId }, { id: staleId }]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await writeFile(
      join(sourceRoot, "index.json"),
      `${JSON.stringify(
        {
          schema_version: "1.0",
          generated_at: "2026-03-06T01:00:00Z",
          companies: [{ id: existingId }, { id: newId }]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(sourceRoot, "companies", `${existingId}.json`),
      `${JSON.stringify(
        {
          ...buildDetailPayload(existingId, "Existing Co (Scraped Update)", {
            openDate: "2026-03-01",
            closeDate: "2026-04-01",
            openDateRaw: "March 2026",
            closeDateRaw: "April 2026",
            openDatePrecision: "month_year_normalized",
            closeDatePrecision: "month_year_normalized"
          }),
          keep_me: false
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(sourceRoot, "companies", `${newId}.json`),
      `${JSON.stringify(
        buildDetailPayload(newId, "New Co", {
          openDate: "2026-03-10",
          closeDate: "2026-05-01",
          openDateRaw: "10 March 2026",
          closeDateRaw: "May 2026",
          openDatePrecision: "exact_day",
          closeDatePrecision: "month_year_normalized"
        }),
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(join(sourceRoot, "assets", "logos", sharedLogo), "source-logo", "utf8");
    await writeFile(join(sourceRoot, "assets", "logos", "new-co-peoplesquad-logo.webp"), "new-logo", "utf8");

    await syncScraperData({
      sourceRoots: [sourceRoot],
      outDir,
      hardRefresh: true
    });

    const existingOutRaw = await readFile(join(outDir, "companies", `${existingId}.json`), "utf8");
    const existingOut = JSON.parse(existingOutRaw) as { name: string; keep_me: boolean };
    expect(existingOut.name).toBe("Existing Co (Scraped Update)");
    expect(existingOut.keep_me).toBe(false);

    await expect(stat(join(outDir, "companies", `${staleId}.json`))).rejects.toThrow();

    const sharedLogoContent = await readFile(join(outDir, "assets", "logos", sharedLogo), "utf8");
    expect(sharedLogoContent).toBe("source-logo");
    await expect(stat(join(outDir, "assets", "logos", staleLogo))).rejects.toThrow();

    const mergedIndexRaw = await readFile(join(outDir, "index.json"), "utf8");
    const mergedIndex = JSON.parse(mergedIndexRaw) as {
      companies: Array<{
        id: string;
        name: string;
        apply?: {
          open_date_raw?: string | null;
          close_date_raw?: string | null;
          open_date_precision?: string | null;
          close_date_precision?: string | null;
        };
      }>;
    };
    expect(mergedIndex.companies.map((c) => c.id).sort()).toEqual([existingId, newId]);
    const existingFromIndex = mergedIndex.companies.find((c) => c.id === existingId);
    expect(existingFromIndex?.name).toBe("Existing Co (Scraped Update)");
    expect(existingFromIndex?.apply?.open_date_raw).toBe("March 2026");
    expect(existingFromIndex?.apply?.close_date_raw).toBe("April 2026");
    expect(existingFromIndex?.apply?.open_date_precision).toBe("month_year_normalized");
    expect(existingFromIndex?.apply?.close_date_precision).toBe("month_year_normalized");
  });
});

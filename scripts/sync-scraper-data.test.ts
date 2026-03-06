import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncScraperData } from "./sync-scraper-data-core.mjs";

const createdDirs: string[] = [];

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

  it("adds new companies without overwriting existing public company payloads", async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), "ps-sync-fixture-"));
    const outDir = await mkdtemp(join(tmpdir(), "ps-sync-out-"));
    createdDirs.push(fixtureDir, outDir);

    const sourceRoot = join(fixtureDir, "source");
    await mkdir(join(sourceRoot, "companies"), { recursive: true });

    const existingId = "existing-co";
    const newId = "new-co";

    const existingIndexEntry = {
      id: existingId,
      name: "Existing Co",
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
      updated_at: "2026-03-06T00:00:00Z",
      confidence: "high"
    };

    await mkdir(join(outDir, "companies"), { recursive: true });
    await writeFile(
      join(outDir, "companies", `${existingId}.json`),
      `${JSON.stringify({ id: existingId, name: "Existing Co (Public)", keep_me: true }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(outDir, "index.json"),
      `${JSON.stringify(
        {
          schema_version: "1.0",
          generated_at: "2026-03-06T00:00:00Z",
          companies: [existingIndexEntry]
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
          ...existingIndexEntry,
          name: "Existing Co (Scraped Update)",
          confidence: "low"
        },
        {
          id: newId,
          name: "New Co",
          entity_type: "company",
          logo_url: null,
          career_url: "https://example.com/careers",
          apply: {
            direct_apply_url: "https://example.com/apply",
            open_date: "2026-03-01",
            close_date: "2026-04-01",
            status: "open"
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

    await writeFile(join(sourceRoot, "index.json"), `${JSON.stringify(sourceIndex, null, 2)}\n`, "utf8");
    await writeFile(
      join(sourceRoot, "companies", `${existingId}.json`),
      `${JSON.stringify({ id: existingId, name: "Existing Co (Scraped Update)", keep_me: false }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(sourceRoot, "companies", `${newId}.json`),
      `${JSON.stringify({ id: newId, name: "New Co", keep_me: false }, null, 2)}\n`,
      "utf8"
    );

    await syncScraperData({
      sourceRoots: [sourceRoot],
      outDir
    });

    const existingOutRaw = await readFile(join(outDir, "companies", `${existingId}.json`), "utf8");
    const existingOut = JSON.parse(existingOutRaw) as { name: string; keep_me: boolean };
    expect(existingOut.name).toBe("Existing Co (Public)");
    expect(existingOut.keep_me).toBe(true);

    const newOutRaw = await readFile(join(outDir, "companies", `${newId}.json`), "utf8");
    const newOut = JSON.parse(newOutRaw) as { name: string };
    expect(newOut.name).toBe("New Co");

    const mergedIndexRaw = await readFile(join(outDir, "index.json"), "utf8");
    const mergedIndex = JSON.parse(mergedIndexRaw) as { companies: Array<{ id: string; name: string; confidence: string }> };
    expect(mergedIndex.companies.map((c) => c.id).sort()).toEqual([existingId, newId]);
    const existingFromIndex = mergedIndex.companies.find((c) => c.id === existingId);
    expect(existingFromIndex?.name).toBe("Existing Co");
    expect(existingFromIndex?.confidence).toBe("high");
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
      `${JSON.stringify({ id: existingId, name: "Existing Co (Public)", keep_me: true }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(outDir, "companies", `${staleId}.json`),
      `${JSON.stringify({ id: staleId, name: "Stale Co" }, null, 2)}\n`,
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
          companies: [
            {
              id: existingId,
              name: "Existing Co",
              entity_type: "company",
              logo_url: `assets/logos/${sharedLogo}`,
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
              updated_at: "2026-03-06T00:00:00Z",
              confidence: "high"
            },
            {
              id: staleId,
              name: "Stale Co",
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
          name: "Existing Co (Scraped Update)",
          entity_type: "company",
          logo_url: `assets/logos/${sharedLogo}`,
          career_url: "https://example.com/existing/careers",
          apply: {
            direct_apply_url: "https://example.com/existing/apply",
            open_date: "2026-03-01",
            close_date: "2026-04-01",
            open_date_raw: "March 2026",
            close_date_raw: "April 2026",
            open_date_precision: "month_year_normalized",
            close_date_precision: "month_year_normalized",
            status: "open"
          },
          tags: {
            streams: ["Technology"],
            eligibility: ["Citizen or PR"],
            industries: ["Technology"]
          },
          updated_at: "2026-03-06T01:00:00Z",
          confidence: "medium"
        },
        {
          id: newId,
          name: "New Co",
          entity_type: "company",
          logo_url: null,
          career_url: "https://example.com/new/careers",
          apply: {
            direct_apply_url: "https://example.com/new/apply",
            open_date: "2026-03-10",
            close_date: "2026-05-01",
            open_date_raw: "10 March 2026",
            close_date_raw: "May 2026",
            open_date_precision: "exact_day",
            close_date_precision: "month_year_normalized",
            status: "open"
          },
          tags: {
            streams: ["Operations"],
            eligibility: ["Citizen or PR"],
            industries: ["Logistics"]
          },
          updated_at: "2026-03-06T01:00:00Z",
          confidence: "high"
        }
      ]
    };

    await writeFile(join(sourceRoot, "index.json"), `${JSON.stringify(sourceIndex, null, 2)}\n`, "utf8");
    await writeFile(
      join(sourceRoot, "companies", `${existingId}.json`),
      `${JSON.stringify({ id: existingId, name: "Existing Co (Scraped Update)", keep_me: false }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(sourceRoot, "companies", `${newId}.json`),
      `${JSON.stringify({ id: newId, name: "New Co", keep_me: false }, null, 2)}\n`,
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

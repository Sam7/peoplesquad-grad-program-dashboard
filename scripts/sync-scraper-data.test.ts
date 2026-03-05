import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
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
        resolve("data-scraper/data/e2e-three/coles"),
        resolve("data-scraper/data/e2e-three/bhp"),
        resolve("data-scraper/data/e2e-three/xero")
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
});

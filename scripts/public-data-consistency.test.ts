import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertIndexMatchesDetails, loadDetailsFromCompaniesDir } from "./data-index-core.mjs";

describe("public data consistency", () => {
  it("keeps index apply fields aligned with company detail program fields", async () => {
    const dataDir = resolve("public/data");
    const indexPath = join(dataDir, "index.json");
    const companiesDir = join(dataDir, "companies");

    const indexRaw = await readFile(indexPath, "utf8");
    const indexPayload = JSON.parse(indexRaw);
    const detailsById = await loadDetailsFromCompaniesDir(companiesDir);

    expect(() => assertIndexMatchesDetails(indexPayload, detailsById)).not.toThrow();
  });
});

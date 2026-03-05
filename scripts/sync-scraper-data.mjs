import { resolve } from "node:path";
import { syncScraperData } from "./sync-scraper-data-core.mjs";

const DEFAULT_SOURCES = [
  resolve("data-scraper/data/e2e-three/coles"),
  resolve("data-scraper/data/e2e-three/bhp"),
  resolve("data-scraper/data/e2e-three/xero")
];

const DEFAULT_OUT = resolve("public/data");

try {
  const result = await syncScraperData({
    sourceRoots: DEFAULT_SOURCES,
    outDir: DEFAULT_OUT
  });
  console.log(`Synced ${result.companyCount} companies to ${result.outDir}`);
} catch (error) {
  console.error("Failed to sync scraper data", error);
  process.exitCode = 1;
}

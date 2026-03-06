import { resolve } from "node:path";
import { syncScraperData } from "./sync-scraper-data-core.mjs";

const DEFAULT_SOURCES = [
  resolve("data-scraper/data/archive/experiments/e2e-three/coles"),
  resolve("data-scraper/data/archive/experiments/e2e-three/bhp"),
  resolve("data-scraper/data/archive/experiments/e2e-three/xero")
];

const DEFAULT_OUT = resolve("public/data");
const args = process.argv.slice(2);

function parseArgs(argv) {
  const sourceRoots = [];
  let outDir = DEFAULT_OUT;
  let hardRefresh = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") {
      const maybeOutDir = argv[i + 1];
      if (!maybeOutDir) {
        throw new Error("Missing path after --out");
      }
      outDir = resolve(maybeOutDir);
      i += 1;
      continue;
    }
    if (arg === "--hard-refresh") {
      hardRefresh = true;
      continue;
    }
    sourceRoots.push(resolve(arg));
  }

  return {
    sourceRoots: sourceRoots.length > 0 ? sourceRoots : DEFAULT_SOURCES,
    outDir,
    hardRefresh
  };
}

try {
  const { sourceRoots, outDir, hardRefresh } = parseArgs(args);
  const result = await syncScraperData({
    sourceRoots,
    outDir,
    hardRefresh
  });
  console.log(`Synced ${result.companyCount} companies to ${result.outDir}`);
} catch (error) {
  console.error("Failed to sync scraper data", error);
  process.exitCode = 1;
}

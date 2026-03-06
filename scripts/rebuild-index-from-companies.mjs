import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { assertIndexMatchesDetails, buildIndexPayloadFromDetails, loadDetailsFromCompaniesDir } from "./data-index-core.mjs";

async function writeJson(filePath, payload) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  let dataDir = resolve("public/data");

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--data-dir") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing path after --data-dir");
      }
      dataDir = resolve(next);
      i += 1;
    }
  }

  return { dataDir };
}

export async function rebuildIndexFromCompanies({ dataDir }) {
  const resolvedDataDir = resolve(dataDir);
  const companiesDir = join(resolvedDataDir, "companies");
  const indexPath = join(resolvedDataDir, "index.json");

  const detailsById = await loadDetailsFromCompaniesDir(companiesDir);
  const indexPayload = buildIndexPayloadFromDetails(detailsById);
  assertIndexMatchesDetails(indexPayload, detailsById);
  await writeJson(indexPath, indexPayload);

  return {
    companyCount: indexPayload.companies.length,
    dataDir: resolvedDataDir
  };
}

async function runCli() {
  const { dataDir } = parseArgs(process.argv.slice(2));
  const result = await rebuildIndexFromCompanies({ dataDir });
  console.log(`Rebuilt index for ${result.companyCount} companies in ${result.dataDir}`);
}

const directRunHref = process.argv[1] ? new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href : null;

if (directRunHref && import.meta.url === directRunHref) {
  runCli().catch((error) => {
    console.error("Failed to rebuild index from companies", error);
    process.exitCode = 1;
  });
}

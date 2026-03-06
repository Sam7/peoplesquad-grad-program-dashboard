import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { assertIndexMatchesDetails, buildIndexPayloadFromDetails, loadDetailsFromCompaniesDir } from "./data-index-core.mjs";

function nowIso() {
  return new Date().toISOString();
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(sourcePath, targetPath, { overwrite = false } = {}) {
  await mkdir(dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: overwrite, errorOnExist: false });
}

export async function syncScraperData({ sourceRoots, outDir, hardRefresh = false }) {
  const resolvedOutDir = resolve(outDir);
  const companiesOutDir = join(resolvedOutDir, "companies");
  const logosOutDir = join(resolvedOutDir, "assets", "logos");
  const indexOutPath = join(resolvedOutDir, "index.json");

  if (hardRefresh) {
    await rm(companiesOutDir, { recursive: true, force: true });
    await rm(logosOutDir, { recursive: true, force: true });
    await rm(indexOutPath, { force: true });
  }

  await mkdir(companiesOutDir, { recursive: true });
  await mkdir(logosOutDir, { recursive: true });

  const mergedDetailsById = hardRefresh ? new Map() : await loadDetailsFromCompaniesDir(companiesOutDir);

  for (const root of sourceRoots) {
    const resolvedRoot = resolve(root);
    const indexPath = join(resolvedRoot, "index.json");
    const indexPayload = await readJson(indexPath);
    const sourceCompanies = indexPayload.companies ?? [];

    for (const entry of sourceCompanies) {
      const id = entry?.id;
      if (!id) {
        continue;
      }

      const companySourcePath = join(resolvedRoot, "companies", `${id}.json`);
      if (!(await pathExists(companySourcePath))) {
        throw new Error(`Missing source company payload: ${companySourcePath}`);
      }

      const detail = await readJson(companySourcePath);
      const companyOutPath = join(companiesOutDir, `${id}.json`);
      await writeJson(companyOutPath, detail);
      mergedDetailsById.set(id, detail);
    }

    const logosSourceDir = join(resolvedRoot, "assets", "logos");
    try {
      const logos = await readdir(logosSourceDir);
      for (const logoFile of logos) {
        await copyIfExists(join(logosSourceDir, logoFile), join(logosOutDir, logoFile), {
          overwrite: true
        });
      }
    } catch {
      // Some sources do not include logos; this is expected.
    }
  }

  const indexPayload = buildIndexPayloadFromDetails(mergedDetailsById, nowIso());
  assertIndexMatchesDetails(indexPayload, mergedDetailsById);
  await writeJson(indexOutPath, indexPayload);

  return {
    companyCount: indexPayload.companies.length,
    outDir: resolvedOutDir
  };
}

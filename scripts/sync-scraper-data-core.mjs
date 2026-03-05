import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

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

async function copyIfExists(sourcePath, targetPath) {
  await mkdir(dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true, errorOnExist: false });
}

function normalizeIndexItem(item) {
  return {
    id: item.id,
    name: item.name,
    entity_type: item.entity_type,
    logo_url: item.logo_url ?? null,
    career_url: item.career_url ?? null,
    apply: {
      direct_apply_url: item.apply?.direct_apply_url ?? null,
      open_date: item.apply?.open_date ?? null,
      close_date: item.apply?.close_date ?? null,
      status: item.apply?.status ?? "unknown"
    },
    tags: {
      streams: item.tags?.streams ?? [],
      eligibility: item.tags?.eligibility ?? [],
      industries: item.tags?.industries ?? []
    },
    updated_at: item.updated_at ?? null,
    confidence: item.confidence ?? "low"
  };
}

export async function syncScraperData({ sourceRoots, outDir }) {
  const resolvedOutDir = resolve(outDir);
  const companiesOutDir = join(resolvedOutDir, "companies");
  const logosOutDir = join(resolvedOutDir, "assets", "logos");

  await mkdir(companiesOutDir, { recursive: true });
  await mkdir(logosOutDir, { recursive: true });

  const mergedCompanies = [];

  for (const root of sourceRoots) {
    const resolvedRoot = resolve(root);
    const indexPath = join(resolvedRoot, "index.json");
    const indexPayload = await readJson(indexPath);
    const sourceCompanies = indexPayload.companies ?? [];

    for (const entry of sourceCompanies) {
      const id = entry.id;
      const companySourcePath = join(resolvedRoot, "companies", `${id}.json`);
      const companyOutPath = join(companiesOutDir, `${id}.json`);
      const detail = await readJson(companySourcePath);

      await writeJson(companyOutPath, detail);
      mergedCompanies.push(normalizeIndexItem(entry));
    }

    const logosSourceDir = join(resolvedRoot, "assets", "logos");
    try {
      const logos = await readdir(logosSourceDir);
      for (const logoFile of logos) {
        await copyIfExists(join(logosSourceDir, logoFile), join(logosOutDir, logoFile));
      }
    } catch {
      // Some sources do not include logos; this is expected.
    }
  }

  mergedCompanies.sort((a, b) => a.name.localeCompare(b.name));

  await writeJson(join(resolvedOutDir, "index.json"), {
    schema_version: "1.0",
    generated_at: nowIso(),
    companies: mergedCompanies
  });

  return {
    companyCount: mergedCompanies.length,
    outDir: resolvedOutDir
  };
}

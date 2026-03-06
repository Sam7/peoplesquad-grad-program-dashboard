import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const CANONICAL_APPLY_FIELDS = [
  "direct_apply_url",
  "open_date",
  "close_date",
  "open_date_raw",
  "close_date_raw",
  "open_date_precision",
  "close_date_precision"
];

function nowIso() {
  return new Date().toISOString();
}

function asObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function asString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string" && item.trim().length > 0);
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  const stringValue = asString(value);
  if (!stringValue) {
    return null;
  }

  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(stringValue);
  if (isoDateOnly) {
    return new Date(`${stringValue}T00:00:00Z`);
  }

  const parsed = Date.parse(stringValue);
  if (Number.isFinite(parsed)) {
    return new Date(parsed);
  }
  return null;
}

function computeStatus(openDateRaw, closeDateRaw, referenceDate = new Date()) {
  const openDate = parseDate(openDateRaw);
  const closeDate = parseDate(closeDateRaw);
  const referenceKey = toDateKey(referenceDate);

  if (openDate && closeDate) {
    const openKey = toDateKey(openDate);
    const closeKey = toDateKey(closeDate);
    if (referenceKey < openKey) {
      return "upcoming";
    }
    if (referenceKey > closeKey) {
      return "closed";
    }
    return "open";
  }

  if (openDate) {
    const openKey = toDateKey(openDate);
    return referenceKey < openKey ? "upcoming" : "open";
  }

  if (closeDate) {
    const closeKey = toDateKey(closeDate);
    return referenceKey <= closeKey ? "open" : "closed";
  }

  return "unknown";
}

export function buildIndexItemFromDetail(detail, referenceDate = new Date()) {
  const detailObject = asObject(detail);
  const urls = asObject(detailObject.urls);
  const program = asObject(detailObject.program);
  const eligibility = asObject(detailObject.eligibility);
  const classification = asObject(detailObject.classification);
  const sectionProvenance = asObject(detailObject.section_provenance);
  const programProvenance = asObject(sectionProvenance.program);
  const provenance = asObject(detailObject.provenance);
  const workRights = asString(eligibility.work_rights);
  const industryBucket = asString(classification.industry_bucket) ?? "Other";

  const openDate = asString(program.open_date);
  const closeDate = asString(program.close_date);
  const openDateRaw = asString(program.open_date_raw);
  const closeDateRaw = asString(program.close_date_raw);
  const openDatePrecision = asString(program.open_date_precision);
  const closeDatePrecision = asString(program.close_date_precision);

  return {
    id: asString(detailObject.id),
    name: asString(detailObject.name) ?? "Unknown",
    entity_type: asString(detailObject.entity_type) ?? "company",
    logo_url: asString(detailObject.logo_url),
    career_url: asString(urls.careers_url),
    apply: {
      direct_apply_url: asString(program.direct_apply_url),
      open_date: openDate,
      close_date: closeDate,
      open_date_raw: openDateRaw,
      close_date_raw: closeDateRaw,
      open_date_precision: openDatePrecision,
      close_date_precision: closeDatePrecision,
      status: computeStatus(openDate, closeDate, referenceDate)
    },
    tags: {
      streams: asStringArray(program.streams),
      eligibility: workRights ? [workRights] : [],
      industries: [industryBucket]
    },
    updated_at: asString(provenance.updated_at),
    confidence: asString(programProvenance.confidence) ?? "low"
  };
}

function compareValues(left, right) {
  const normalizedLeft = left ?? null;
  const normalizedRight = right ?? null;
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

export function collectIndexDetailMismatches(indexPayload, detailsById) {
  const payload = asObject(indexPayload);
  const companies = Array.isArray(payload.companies) ? payload.companies : [];
  const mismatches = [];

  for (const company of companies) {
    const indexCompany = asObject(company);
    const id = asString(indexCompany.id);
    if (!id) {
      continue;
    }
    const detail = detailsById.get(id);
    if (!detail) {
      mismatches.push({
        id,
        field: "company",
        indexValue: "present",
        detailValue: "missing"
      });
      continue;
    }

    const indexApply = asObject(indexCompany.apply);
    const detailProgram = asObject(asObject(detail).program);
    for (const field of CANONICAL_APPLY_FIELDS) {
      if (!compareValues(indexApply[field], detailProgram[field])) {
        mismatches.push({
          id,
          field,
          indexValue: indexApply[field] ?? null,
          detailValue: detailProgram[field] ?? null
        });
      }
    }
  }

  return mismatches;
}

export function assertIndexMatchesDetails(indexPayload, detailsById) {
  const mismatches = collectIndexDetailMismatches(indexPayload, detailsById);
  if (mismatches.length === 0) {
    return;
  }

  const lines = mismatches.map(
    (mismatch) =>
      `${mismatch.id}.${mismatch.field}: index=${JSON.stringify(mismatch.indexValue)} detail=${JSON.stringify(
        mismatch.detailValue
      )}`
  );
  throw new Error(`index/detail mismatch detected (${mismatches.length}):\n${lines.join("\n")}`);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function loadDetailsFromCompaniesDir(companiesDir) {
  const detailsById = new Map();
  if (!(await pathExists(companiesDir))) {
    return detailsById;
  }

  const files = await readdir(companiesDir);
  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const detail = await readJson(join(companiesDir, file));
    const id = asString(asObject(detail).id);
    if (!id) {
      continue;
    }
    detailsById.set(id, detail);
  }
  return detailsById;
}

export function buildIndexPayloadFromDetails(detailsById, generatedAt = nowIso(), referenceDate = new Date()) {
  const companies = Array.from(detailsById.values())
    .map((detail) => buildIndexItemFromDetail(detail, referenceDate))
    .filter((item) => asString(item.id) !== null);

  companies.sort((a, b) => {
    const left = asString(a.name) ?? "";
    const right = asString(b.name) ?? "";
    return left.localeCompare(right);
  });

  return {
    schema_version: "1.0",
    generated_at: generatedAt,
    companies
  };
}

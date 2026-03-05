import { computeApplicationStatus } from "../domain/dates";
import type { ProgressState, UiCompany } from "../domain/filters";
import type { ProgressMap } from "../features/progress/progressStore";

export interface CompanyIndexItem {
  id: string;
  name: string;
  entity_type: string;
  logo_url: string | null;
  career_url: string | null;
  apply: {
    direct_apply_url: string | null;
    open_date: string | null;
    close_date: string | null;
    status: "open" | "upcoming" | "closed" | "unknown";
  };
  tags: {
    streams: string[];
    eligibility: string[];
    industries: string[];
  };
  updated_at: string | null;
  confidence: string;
}

export interface CompanyIndexPayload {
  schema_version: string;
  generated_at: string;
  companies: CompanyIndexItem[];
}

export interface CompanyDetailPayload {
  id: string;
  name: string;
  logo_url: string | null;
  [key: string]: unknown;
}

export interface ListCompany extends UiCompany {
  logoUrl: string | null;
  careerUrl: string | null;
  directApplyUrl: string | null;
  openDateRaw: string | null;
  industries: string[];
  confidence: string;
  updatedAt: string | null;
}

const detailCache = new Map<string, CompanyDetailPayload>();

export function mapIndexToListCompanies(
  payload: CompanyIndexPayload,
  progressMap: ProgressMap,
  referenceDate: Date = new Date()
): ListCompany[] {
  return payload.companies.map((item) => {
    const status = computeApplicationStatus(item.apply.open_date, item.apply.close_date, referenceDate);
    const progressState: ProgressState = progressMap[item.id] ?? "none";
    return {
      id: item.id,
      name: item.name,
      streamTags: item.tags.streams ?? [],
      workRightsText: item.tags.eligibility?.[0] ?? null,
      status,
      closeDateRaw: item.apply.close_date,
      progressState,
      logoUrl: item.logo_url,
      careerUrl: item.career_url,
      directApplyUrl: item.apply.direct_apply_url,
      openDateRaw: item.apply.open_date,
      industries: item.tags.industries ?? [],
      confidence: item.confidence,
      updatedAt: item.updated_at
    };
  });
}

export async function loadCompanyIndex(): Promise<CompanyIndexPayload> {
  const response = await fetch("/data/index.json", {
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load index.json (${response.status})`);
  }

  return (await response.json()) as CompanyIndexPayload;
}

export async function loadCompanyDetail(companyId: string): Promise<CompanyDetailPayload> {
  if (detailCache.has(companyId)) {
    return detailCache.get(companyId)!;
  }

  const response = await fetch(`/data/companies/${companyId}.json`, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load company ${companyId} (${response.status})`);
  }

  const detail = (await response.json()) as CompanyDetailPayload;
  detailCache.set(companyId, detail);
  return detail;
}

export function clearCompanyDetailCache(): void {
  detailCache.clear();
}

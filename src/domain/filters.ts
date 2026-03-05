import { getDaysUntil, getDeadlineUrgency } from "./dates";

export type WorkRightsCategory = "all" | "citizen_pr" | "visa_ok" | "unknown";
export type SortMode = "deadline" | "name";
export type ListingView = "search" | "board";
export type ProgressState = "none" | "saved" | "applied" | "interviewing" | "offer" | "rejected";

export interface FiltersState {
  q: string;
  open: boolean;
  soon: boolean;
  soonDays: number;
  stream: string[];
  workRights: WorkRightsCategory;
  sort: SortMode;
  view: ListingView;
}

export interface UiCompany {
  id: string;
  name: string;
  streamTags: string[];
  workRightsText: string | null;
  status: "open" | "upcoming" | "closed" | "unknown";
  openDateRaw: string | null;
  closeDateRaw: string | null;
  progressState: ProgressState;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function defaultFilters(): FiltersState {
  return {
    q: "",
    open: false,
    soon: false,
    soonDays: 7,
    stream: [],
    workRights: "all",
    sort: "deadline",
    view: "search"
  };
}

export function classifyWorkRights(workRightsText: string | null): Exclude<WorkRightsCategory, "all"> {
  const normalized = (workRightsText ?? "").toLowerCase();
  if (!normalized) {
    return "unknown";
  }

  if (
    normalized.includes("citizen") ||
    normalized.includes("permanent resident") ||
    normalized.includes("pr")
  ) {
    return "citizen_pr";
  }

  if (normalized.includes("visa") || normalized.includes("work restrictions")) {
    return "visa_ok";
  }

  return "unknown";
}

function parseBoolParam(value: string | null): boolean {
  return value === "1";
}

export function parseSearchParams(params: URLSearchParams): FiltersState {
  const defaults = defaultFilters();
  const sortRaw = params.get("sort");
  const sort: SortMode = sortRaw === "name" || sortRaw === "deadline" ? sortRaw : defaults.sort;

  const soonDaysRaw = params.get("soonDays");
  const soonDaysParsed = soonDaysRaw ? Number.parseInt(soonDaysRaw, 10) : defaults.soonDays;
  const soonDays = Number.isFinite(soonDaysParsed) && soonDaysParsed > 0 ? soonDaysParsed : defaults.soonDays;

  const workRightsRaw = params.get("workRights");
  const allowedWorkRights: WorkRightsCategory[] = ["all", "citizen_pr", "visa_ok", "unknown"];
  const workRights = allowedWorkRights.includes(workRightsRaw as WorkRightsCategory)
    ? (workRightsRaw as WorkRightsCategory)
    : defaults.workRights;
  const viewRaw = params.get("view");
  const view: ListingView = viewRaw === "board" || viewRaw === "search" ? viewRaw : defaults.view;

  const q = params.get("q") ?? defaults.q;
  const stream = params.getAll("stream").filter((value) => value.trim().length > 0);

  return {
    q,
    open: parseBoolParam(params.get("open")),
    soon: parseBoolParam(params.get("soon")),
    soonDays,
    stream,
    workRights,
    sort,
    view
  };
}

export function buildSearchParams(filters: FiltersState): URLSearchParams {
  const defaults = defaultFilters();
  const params = new URLSearchParams();

  if (filters.q !== defaults.q) {
    params.set("q", filters.q);
  }
  if (filters.open) {
    params.set("open", "1");
  }
  if (filters.soon) {
    params.set("soon", "1");
  }
  if (filters.soonDays !== defaults.soonDays) {
    params.set("soonDays", String(filters.soonDays));
  }
  for (const stream of filters.stream) {
    params.append("stream", stream);
  }
  if (filters.workRights !== defaults.workRights) {
    params.set("workRights", filters.workRights);
  }
  if (filters.sort !== defaults.sort) {
    params.set("sort", filters.sort);
  }
  if (filters.view !== defaults.view) {
    params.set("view", filters.view);
  }

  return params;
}

function matchesStream(company: UiCompany, requiredStreams: string[]): boolean {
  if (requiredStreams.length === 0) {
    return true;
  }

  const companyStreams = company.streamTags.map((stream) => normalizeText(stream));
  return requiredStreams.some((required) => companyStreams.includes(normalizeText(required)));
}

function matchesWorkRights(company: UiCompany, workRights: WorkRightsCategory): boolean {
  if (workRights === "all") {
    return true;
  }
  return classifyWorkRights(company.workRightsText) === workRights;
}

function matchesOpenFilter(company: UiCompany, open: boolean): boolean {
  if (!open) {
    return true;
  }
  return company.status === "open";
}

function matchesSoonFilter(company: UiCompany, soon: boolean, referenceDate: Date, soonDays: number): boolean {
  if (!soon) {
    return true;
  }

  const urgency = getDeadlineUrgency(company.closeDateRaw, company.status, referenceDate, soonDays);
  return urgency === "soon";
}

function deadlineSort(a: UiCompany, b: UiCompany, referenceDate: Date): number {
  const rank = (company: UiCompany): number => {
    if (company.status === "upcoming") {
      const daysUntilOpen = getDaysUntil(company.openDateRaw, referenceDate);
      if (daysUntilOpen !== null && daysUntilOpen >= 0 && daysUntilOpen <= 3) {
        return 0;
      }
      return 2;
    }

    if (company.status === "open") {
      return 1;
    }

    if (company.status === "unknown") {
      return 3;
    }

    return 4;
  };

  const rankDiff = rank(a) - rank(b);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const getPrimaryDateOffset = (company: UiCompany): number | null => {
    if (company.status === "upcoming") {
      return getDaysUntil(company.openDateRaw, referenceDate);
    }

    if (company.status === "open" || company.status === "closed") {
      return getDaysUntil(company.closeDateRaw, referenceDate);
    }

    return null;
  };

  const aDays = getPrimaryDateOffset(a);
  const bDays = getPrimaryDateOffset(b);

  if (aDays !== null && bDays !== null) {
    if (a.status === "closed" && b.status === "closed") {
      if (aDays !== bDays) {
        return bDays - aDays;
      }
    } else if (aDays !== bDays) {
      return aDays - bDays;
    }
  } else if (aDays !== null) {
    return -1;
  } else if (bDays !== null) {
    return 1;
  }

  return a.name.localeCompare(b.name);
}

export function filterAndSortCompanies<T extends UiCompany>(
  companies: T[],
  filters: FiltersState,
  referenceDate: Date = new Date()
): T[] {
  const q = normalizeText(filters.q);

  const filtered = companies.filter((company) => {
    if (q.length > 0 && !normalizeText(company.name).includes(q)) {
      return false;
    }
    if (!matchesStream(company, filters.stream)) {
      return false;
    }
    if (!matchesWorkRights(company, filters.workRights)) {
      return false;
    }
    if (!matchesOpenFilter(company, filters.open)) {
      return false;
    }
    if (!matchesSoonFilter(company, filters.soon, referenceDate, filters.soonDays)) {
      return false;
    }
    return true;
  });

  const sorted: T[] = [...filtered];
  if (filters.sort === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    sorted.sort((a, b) => deadlineSort(a, b, referenceDate));
  }

  return sorted;
}

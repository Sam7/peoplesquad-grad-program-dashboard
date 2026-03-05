import Cookies from "js-cookie";

export type ProgressState = "none" | "saved" | "applied" | "interviewing" | "offer" | "rejected";
export type StoredProgressState = Exclude<ProgressState, "none">;
export type ProgressMap = Record<string, StoredProgressState>;

const COOKIE_NAME = "ps_company_progress";
const COOKIE_DAYS = 365;

function secureCookie(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.protocol === "https:";
}

function isStoredProgressState(value: unknown): value is StoredProgressState {
  return value === "saved" || value === "applied" || value === "interviewing" || value === "offer" || value === "rejected";
}

function normalizeProgressMap(value: unknown): ProgressMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const out: ProgressMap = {};
  for (const [key, state] of Object.entries(value)) {
    if (typeof key !== "string" || key.trim().length === 0) {
      continue;
    }
    if (isStoredProgressState(state)) {
      out[key] = state;
    }
  }

  return out;
}

function setProgressMap(map: ProgressMap): void {
  Cookies.set(COOKIE_NAME, JSON.stringify(map), {
    expires: COOKIE_DAYS,
    sameSite: "Lax",
    secure: secureCookie(),
    path: "/"
  });
}

export function getProgressMap(): ProgressMap {
  const raw = Cookies.get(COOKIE_NAME);
  if (!raw) {
    return {};
  }

  try {
    return normalizeProgressMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function getProgressState(companyId: string): ProgressState {
  const map = getProgressMap();
  return map[companyId] ?? "none";
}

export function setProgressState(companyId: string, state: ProgressState): void {
  const current = getProgressMap();
  if (state === "none") {
    delete current[companyId];
  } else {
    current[companyId] = state;
  }
  setProgressMap(current);
}

export function clearProgressCookie(): void {
  Cookies.remove(COOKIE_NAME, { path: "/" });
}

export function getLeftProgressOption(state: ProgressState): ProgressState | null {
  if (state === "saved" || state === "applied" || state === "interviewing") {
    return "rejected";
  }
  return null;
}

export function getRightProgressOption(state: ProgressState): ProgressState | null {
  if (state === "saved") {
    return "applied";
  }
  if (state === "applied") {
    return "interviewing";
  }
  if (state === "interviewing") {
    return "offer";
  }
  return null;
}

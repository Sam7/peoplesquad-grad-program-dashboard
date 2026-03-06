import { differenceInCalendarDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export type ApplicationStatus = "open" | "upcoming" | "closed" | "unknown";
export type DeadlineUrgency = "none" | "normal" | "soon" | "closed";

const APP_TIMEZONE = "Australia/Sydney";
const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11
};

function toUtcDateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

function getDateKey(date: Date): string {
  return formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd");
}

function parseIsoDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
}

function parseMonthToken(value: string): number | null {
  const normalized = value.trim().toLowerCase().replace(/\./g, "");
  const month = MONTH_NAME_TO_NUMBER[normalized];
  return month === undefined ? null : month;
}

function buildUtcDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const parsed = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function parseNaturalLanguageDate(value: string): Date | null {
  const trimmed = value.trim();

  const dayMonthYear = trimmed.match(/^(\d{1,2})\s+([A-Za-z.]+)\s+(\d{4})$/);
  if (dayMonthYear) {
    const day = Number.parseInt(dayMonthYear[1], 10);
    const month = parseMonthToken(dayMonthYear[2]);
    const year = Number.parseInt(dayMonthYear[3], 10);
    if (month === null || !Number.isFinite(day) || !Number.isFinite(year)) {
      return null;
    }
    return buildUtcDate(year, month, day);
  }

  const monthYear = trimmed.match(/^([A-Za-z.]+)\s+(\d{4})$/);
  if (monthYear) {
    const month = parseMonthToken(monthYear[1]);
    const year = Number.parseInt(monthYear[2], 10);
    if (month === null || !Number.isFinite(year)) {
      return null;
    }
    return buildUtcDate(year, month, 1);
  }

  const monthOnly = trimmed.match(/^([A-Za-z.]+)$/);
  if (monthOnly) {
    const month = parseMonthToken(monthOnly[1]);
    if (month === null) {
      return null;
    }
    return buildUtcDate(new Date().getUTCFullYear(), month, 1);
  }

  return null;
}

export function parseFlexibleDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoDateOnly = parseIsoDateOnly(trimmed);
  if (isoDateOnly) {
    return isoDateOnly;
  }

  const naturalLanguage = parseNaturalLanguageDate(trimmed);
  if (naturalLanguage) {
    return naturalLanguage;
  }

  const numericDate = Date.parse(trimmed);
  if (Number.isFinite(numericDate)) {
    return new Date(numericDate);
  }

  return null;
}

export function computeApplicationStatus(
  openDateRaw: string | null | undefined,
  closeDateRaw: string | null | undefined,
  referenceDate: Date = new Date()
): ApplicationStatus {
  const openDate = parseFlexibleDate(openDateRaw);
  const closeDate = parseFlexibleDate(closeDateRaw);
  const referenceKey = getDateKey(referenceDate);

  if (openDate && closeDate) {
    const openKey = getDateKey(openDate);
    const closeKey = getDateKey(closeDate);
    if (referenceKey < openKey) {
      return "upcoming";
    }
    if (referenceKey > closeKey) {
      return "closed";
    }
    return "open";
  }

  if (openDate) {
    const openKey = getDateKey(openDate);
    return referenceKey < openKey ? "upcoming" : "open";
  }

  if (closeDate) {
    const closeKey = getDateKey(closeDate);
    return referenceKey <= closeKey ? "open" : "closed";
  }

  return "unknown";
}

export function getDaysUntil(closeDateRaw: string | null | undefined, referenceDate: Date = new Date()): number | null {
  const closeDate = parseFlexibleDate(closeDateRaw);
  if (!closeDate) {
    return null;
  }

  const closeDay = toUtcDateFromKey(getDateKey(closeDate));
  const referenceDay = toUtcDateFromKey(getDateKey(referenceDate));
  return differenceInCalendarDays(closeDay, referenceDay);
}

export function getDeadlineUrgency(
  closeDateRaw: string | null | undefined,
  status: ApplicationStatus,
  referenceDate: Date = new Date(),
  soonThresholdDays = 7
): DeadlineUrgency {
  if (status === "closed") {
    return "closed";
  }

  if (status !== "open") {
    return "none";
  }

  const daysUntil = getDaysUntil(closeDateRaw, referenceDate);
  if (daysUntil === null) {
    return "none";
  }

  if (daysUntil >= 0 && daysUntil <= soonThresholdDays) {
    return "soon";
  }

  return "normal";
}

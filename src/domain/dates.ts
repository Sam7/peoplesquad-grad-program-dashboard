import { isValid, parse } from "date-fns";
import { differenceInCalendarDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export type ApplicationStatus = "open" | "closed" | "unknown";
export type DeadlineUrgency = "none" | "normal" | "soon" | "closed";

const APP_TIMEZONE = "Australia/Sydney";

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

function parseNaturalLanguageDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) {
    const formats = ["d MMMM yyyy", "d MMM yyyy"];
    for (const fmt of formats) {
      const parsed = parse(value, fmt, new Date());
      if (isValid(parsed)) {
        return new Date(
          Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0, 0)
        );
      }
    }
    return null;
  }

  const [, dayRaw, monthRaw, yearRaw] = match;
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
  };

  const month = months[monthRaw.toLowerCase()];
  if (month === undefined) {
    return null;
  }

  const day = Number.parseInt(dayRaw, 10);
  const year = Number.parseInt(yearRaw, 10);
  if (!Number.isFinite(day) || !Number.isFinite(year)) {
    return null;
  }

  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
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
    return openKey <= referenceKey && referenceKey <= closeKey ? "open" : "closed";
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

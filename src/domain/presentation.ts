import { format } from "date-fns";
import { getDaysUntil, parseFlexibleDate, type ApplicationStatus } from "./dates";

export function formatDisplayDate(dateRaw: string | null | undefined): string {
  if (!dateRaw) {
    return "Not published";
  }

  const parsed = parseFlexibleDate(dateRaw);
  if (!parsed) {
    return dateRaw;
  }

  return format(parsed, "dd MMM yyyy");
}

export function formatRelativeDeadline(
  closeDateRaw: string | null | undefined,
  status: ApplicationStatus = "unknown",
  openDateRaw: string | null | undefined = null,
  referenceDate: Date = new Date()
): string {
  if (status === "upcoming") {
    const daysUntilOpen = getDaysUntil(openDateRaw, referenceDate);
    if (daysUntilOpen === null) {
      return "Opens date not published";
    }
    if (daysUntilOpen === 0) {
      return "Opens today";
    }
    if (daysUntilOpen === 1) {
      return "Opens in 1 day";
    }
    return `Opens in ${daysUntilOpen} days`;
  }

  const daysUntilClose = getDaysUntil(closeDateRaw, referenceDate);
  if (daysUntilClose === null) {
    return "Dates not published";
  }

  if (status === "open") {
    if (daysUntilClose === 0) {
      return "Closes today";
    }
    if (daysUntilClose === 1) {
      return "Closes in 1 day";
    }
    return `Closes in ${daysUntilClose} days`;
  }

  if (status === "closed") {
    const daysClosed = Math.abs(daysUntilClose);
    return `Closed ${daysClosed} day${daysClosed === 1 ? "" : "s"} ago`;
  }

  return "Dates not published";
}

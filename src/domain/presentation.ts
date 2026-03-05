import { format } from "date-fns";
import { getDaysUntil, parseFlexibleDate } from "./dates";

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

export function formatRelativeDeadline(dateRaw: string | null | undefined, referenceDate: Date = new Date()): string {
  const days = getDaysUntil(dateRaw, referenceDate);
  if (days === null) {
    return "Deadline not published";
  }
  if (days < 0) {
    return `Closed ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  }
  if (days === 0) {
    return "Closes today";
  }
  if (days === 1) {
    return "Closes in 1 day";
  }
  return `Closes in ${days} days`;
}

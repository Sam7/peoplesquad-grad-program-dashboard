import { describe, expect, it } from "vitest";
import { formatDisplayDate, formatRelativeDeadline } from "./presentation";

describe("formatDisplayDate", () => {
  it("returns fallback for missing date", () => {
    expect(formatDisplayDate(null)).toBe("Not published");
  });
});

describe("formatRelativeDeadline", () => {
  const reference = new Date("2026-03-06T12:00:00+11:00");

  it("shows opens-in copy for upcoming programs", () => {
    expect(formatRelativeDeadline("2026-04-12", "upcoming", "2026-03-10", reference)).toBe("Opens in 4 days");
  });

  it("shows closes-in copy for open programs", () => {
    expect(formatRelativeDeadline("2026-03-12", "open", "2026-03-01", reference)).toBe("Closes in 6 days");
  });

  it("shows closed-ago copy for closed programs", () => {
    expect(formatRelativeDeadline("2026-03-01", "closed", "2026-02-01", reference)).toBe("Closed 5 days ago");
  });
});

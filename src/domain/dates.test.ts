import { describe, expect, it } from "vitest";
import {
  computeApplicationStatus,
  getDeadlineUrgency,
  getDaysUntil,
  parseFlexibleDate
} from "./dates";

describe("parseFlexibleDate", () => {
  it("parses ISO dates", () => {
    const parsed = parseFlexibleDate("2026-04-12");
    expect(parsed?.toISOString().slice(0, 10)).toBe("2026-04-12");
  });

  it("parses ISO datetime with timezone", () => {
    const parsed = parseFlexibleDate("2026-03-29T23:59:00+11:00");
    expect(parsed).not.toBeNull();
  });

  it("parses natural language dates", () => {
    const parsed = parseFlexibleDate("6 April 2026");
    expect(parsed?.toISOString().slice(0, 10)).toBe("2026-04-06");
  });

  it("returns null for non-parseable values", () => {
    expect(parseFlexibleDate("Not a date")).toBeNull();
  });

  it("parses month-year values", () => {
    const parsed = parseFlexibleDate("August 2026");
    expect(parsed?.toISOString().slice(0, 10)).toBe("2026-08-01");
  });

  it("parses month-only values using current year", () => {
    const currentYear = new Date().getUTCFullYear();
    const parsed = parseFlexibleDate("August");
    expect(parsed?.toISOString().slice(0, 10)).toBe(`${currentYear}-08-01`);
  });
});

describe("computeApplicationStatus", () => {
  it("returns upcoming when open date is in the future", () => {
    expect(
      computeApplicationStatus("2026-03-10", "2026-04-12", new Date("2026-03-06T12:00:00+11:00"))
    ).toBe("upcoming");
  });

  it("returns open when today is within open-close range", () => {
    expect(
      computeApplicationStatus("2026-03-10", "2026-04-12", new Date("2026-03-15T12:00:00+11:00"))
    ).toBe("open");
  });

  it("returns closed when close date is in the past", () => {
    expect(computeApplicationStatus(null, "2026-04-06", new Date("2026-04-07T12:00:00+10:00"))).toBe("closed");
  });

  it("returns open when close month is parseable month-only in the same year", () => {
    expect(computeApplicationStatus(null, "August 2026", new Date("2026-04-07T12:00:00+10:00"))).toBe("open");
  });

  it("returns upcoming when only open date exists and has not started", () => {
    expect(computeApplicationStatus("2026-05-02", null, new Date("2026-04-07T12:00:00+10:00"))).toBe("upcoming");
  });
});

describe("deadline helpers", () => {
  it("computes days until close date", () => {
    const days = getDaysUntil("2026-04-12", new Date("2026-04-10T12:00:00+10:00"));
    expect(days).toBe(2);
  });

  it("flags closing soon when <= threshold and still open", () => {
    const urgency = getDeadlineUrgency("2026-04-12", "open", new Date("2026-04-10T12:00:00+10:00"), 7);
    expect(urgency).toBe("soon");
  });
});

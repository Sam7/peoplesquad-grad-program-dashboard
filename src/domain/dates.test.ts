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
    expect(parseFlexibleDate("August")).toBeNull();
  });
});

describe("computeApplicationStatus", () => {
  it("returns open when today is within open-close range", () => {
    expect(
      computeApplicationStatus("2026-03-10", "2026-04-12", new Date("2026-03-15T12:00:00+11:00"))
    ).toBe("open");
  });

  it("returns closed when close date is in the past", () => {
    expect(computeApplicationStatus(null, "2026-04-06", new Date("2026-04-07T12:00:00+10:00"))).toBe("closed");
  });

  it("returns unknown when no parseable dates exist", () => {
    expect(computeApplicationStatus(null, "August", new Date("2026-04-07T12:00:00+10:00"))).toBe("unknown");
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

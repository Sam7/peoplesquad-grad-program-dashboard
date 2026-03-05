import { beforeEach, describe, expect, it } from "vitest";
import {
  clearProgressCookie,
  getLeftProgressOption,
  getProgressMap,
  getProgressState,
  getRightProgressOption,
  setProgressState,
  type ProgressState
} from "./progressStore";

beforeEach(() => {
  clearProgressCookie();
});

describe("progressStore", () => {
  it("persists and reads progress state per company", () => {
    setProgressState("coles-group", "saved");
    setProgressState("xero", "applied");

    expect(getProgressState("coles-group")).toBe("saved");
    expect(getProgressState("xero")).toBe("applied");
    expect(getProgressMap()).toEqual({
      "coles-group": "saved",
      xero: "applied"
    });
  });

  it("removes company state when set to none", () => {
    setProgressState("coles-group", "saved");
    setProgressState("coles-group", "none");

    expect(getProgressState("coles-group")).toBe("none");
    expect(getProgressMap()).toEqual({});
  });

  it("handles malformed cookie safely", () => {
    document.cookie = "ps_company_progress=this-is-not-json; path=/";
    expect(getProgressMap()).toEqual({});
  });
});

describe("progress state machine", () => {
  const cases: Array<{ state: ProgressState; left: ProgressState | null; right: ProgressState | null }> = [
    { state: "none", left: null, right: null },
    { state: "saved", left: "rejected", right: "applied" },
    { state: "applied", left: "rejected", right: "interviewing" },
    { state: "interviewing", left: "rejected", right: "offer" },
    { state: "offer", left: null, right: null },
    { state: "rejected", left: null, right: null }
  ];

  it("returns deterministic left/right options", () => {
    for (const item of cases) {
      expect(getLeftProgressOption(item.state)).toBe(item.left);
      expect(getRightProgressOption(item.state)).toBe(item.right);
    }
  });
});

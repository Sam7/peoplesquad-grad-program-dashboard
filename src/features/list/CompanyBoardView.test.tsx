import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListCompany } from "../../data/companyData";
import { CompanyBoardView } from "./CompanyBoardView";

const BASE_COMPANY: Omit<ListCompany, "id" | "name" | "progressState" | "logoUrl"> = {
  streamTags: ["Technology"],
  workRightsText: null,
  status: "open",
  openDateRaw: "2026-03-01",
  closeDateRaw: "2026-03-30",
  careerUrl: null,
  directApplyUrl: null,
  industries: ["Technology"],
  confidence: "high",
  updatedAt: "2026-03-01T00:00:00Z"
};

function makeCompany(overrides: Partial<ListCompany> = {}): ListCompany {
  return {
    id: "coles-group",
    name: "Coles Group",
    progressState: "saved",
    logoUrl: "https://example.com/coles.png",
    ...BASE_COMPANY,
    ...overrides
  };
}

describe("CompanyBoardView", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("hover"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("renders progress icons in board column headers", () => {
    render(
      <CompanyBoardView companies={[makeCompany()]} onSelectCompany={vi.fn()} onSetProgress={vi.fn()} />
    );

    const headers = screen.getAllByTestId("board-column-icon");
    expect(headers).toHaveLength(5);
  });

  it("renders card logo and does not render per-card progress control", () => {
    render(
      <CompanyBoardView companies={[makeCompany()]} onSelectCompany={vi.fn()} onSetProgress={vi.fn()} />
    );

    expect(screen.getByAltText("Coles Group logo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /progress for coles group/i })).not.toBeInTheDocument();
  });

  it("disables card dragging on touch-first devices so horizontal scrolling works", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(hover: hover)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    render(
      <CompanyBoardView companies={[makeCompany()]} onSelectCompany={vi.fn()} onSetProgress={vi.fn()} />
    );

    const card = document.querySelector('[data-company-id="coles-group"]');
    expect(card).toHaveAttribute("draggable", "false");
  });
});

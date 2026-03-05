import { BrowserRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const mockIndex = {
  schema_version: "1.0",
  generated_at: "2026-03-05T00:00:00Z",
  companies: [
    {
      id: "coles-group",
      name: "Coles Group",
      entity_type: "company",
      logo_url: null,
      career_url: "https://colescareers.com.au/au/en/studentandgraduates",
      apply: {
        direct_apply_url: "https://example.com/coles/apply",
        open_date: "2099-03-10",
        close_date: "2099-04-12",
        status: "unknown"
      },
      tags: {
        streams: ["Technology"],
        eligibility: ["Australian or New Zealand citizens or permanent residents"],
        industries: ["Retail"]
      },
      updated_at: "2026-03-05T00:00:00Z",
      confidence: "high"
    },
    {
      id: "xero",
      name: "Xero",
      entity_type: "company",
      logo_url: null,
      career_url: "https://careers.xero.com/jobs/",
      apply: {
        direct_apply_url: null,
        open_date: null,
        close_date: null,
        status: "unknown"
      },
      tags: {
        streams: ["Technical program"],
        eligibility: ["right to work full-time in Australia"],
        industries: ["Technology"]
      },
      updated_at: "2026-03-05T00:00:00Z",
      confidence: "medium"
    }
  ]
};

const mockDetail = {
  id: "coles-group",
  name: "Coles Group",
  logo_url: null,
  program: {
    name: "Coles Graduate Program",
    direct_apply_url: "https://example.com/coles/apply",
    overview_url: "https://example.com/coles/program",
    open_date: "2099-03-10",
    close_date: "2099-04-12",
    salary_text: null,
    streams: ["Technology", "Finance"],
    locations: ["Melbourne", "Sydney"],
    duration_text: "2 years",
    rotation_text: "2 to 3 rotations across business teams"
  },
  eligibility: {
    work_rights: "Australian or New Zealand citizens or permanent residents",
    graduation_window: "Graduate by end of 2026",
    disciplines: ["Computer Science", "Engineering"],
    minimum_requirements: ["Submit transcript", "Full-time work rights by start date"]
  },
  recruitment_process: {
    stages: [
      {
        name: "Online application",
        details: "Submit your application and CV online."
      },
      {
        name: "Video interview",
        details: "Record short answers in an online interview."
      }
    ],
    tips: ["Use clear examples from uni projects.", "Apply before the deadline week."]
  },
  commercial_context: {
    exec_themes: ["Customer value"],
    profit_engine: "Retail",
    headwinds: "Cost-of-living pressure",
    esg: "Waste and emissions targets",
    recent_pivot: "Digital checkout expansion"
  },
  section_provenance: {
    program: {
      confidence: "high",
      notes: ["Dates and streams are from the official grad page."],
      sources: [{ title: "Program page", url: "https://example.com/coles/program", type: "web", retrieved_at: null }]
    },
    eligibility: {
      confidence: "high",
      notes: ["Work rights are explicitly listed."],
      sources: [{ title: "Eligibility page", url: "https://example.com/coles/eligibility", type: "web", retrieved_at: null }]
    },
    recruitment_process: {
      confidence: "medium",
      notes: ["Interview format can vary by stream."],
      sources: [{ title: "Recruitment page", url: "https://example.com/coles/recruitment", type: "web", retrieved_at: null }]
    },
    commercial_context: {
      confidence: "medium",
      notes: ["Commercial summary is synthesized from latest company updates."],
      sources: [{ title: "Investor update", url: "https://example.com/coles/investors", type: "web", retrieved_at: null }]
    }
  },
  provenance: {
    updated_at: "2026-03-05T00:00:00Z",
    confidence: "medium",
    notes: ["Synthesized from official pages only."],
    sources: [
      {
        title: "Official source",
        url: "https://example.com",
        type: "web",
        retrieved_at: null
      }
    ]
  }
};

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    document.cookie = "ps_company_progress=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/data/index.json")) {
          return new Response(JSON.stringify(mockIndex), { status: 200 });
        }
        if (url.endsWith("/data/companies/coles-group.json")) {
          return new Response(JSON.stringify(mockDetail), { status: 200 });
        }
        return new Response("Not Found", { status: 404 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and renders companies from index", async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(await screen.findByText("Coles Group")).toBeInTheDocument();
    expect(screen.getByText("Xero")).toBeInTheDocument();
  });

  it("switches between search and board tabs using URL state", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await screen.findByText("Coles Group");
    const boardTab = screen.getByRole("tab", { name: /tracking view|board view/i });
    await user.click(boardTab);

    await waitFor(() => {
      expect(window.location.search).toContain("view=board");
    });

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Applied")).toBeInTheDocument();
  });

  it("updates URL when search filter changes", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await screen.findByText("Coles Group");
    const search = screen.getByRole("searchbox", { name: /search companies/i });
    await user.type(search, "co");

    await waitFor(() => {
      expect(window.location.search).toContain("q=co");
    });
  });

  it("supports progress tracking control from list", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await screen.findByText("Coles Group");

    const progressButton = screen.getByRole("button", { name: /progress for coles group/i });
    await user.click(progressButton);

    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("shows upcoming status with opens-in relative copy when program has future open date", async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await screen.findByText("Coles Group");
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText(/opens in/i)).toBeInTheDocument();
  });

  it("navigates to detail route on company selection", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    const companyButton = await screen.findByRole("button", { name: /open coles group details/i });
    await user.click(companyButton);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/company/coles-group");
    });
    expect(await screen.findByText("Coles Graduate Program")).toBeInTheDocument();
    expect(screen.getByText(/salary:/i)).toBeInTheDocument();
  });

  it("hides tabs and forces search pane rendering when detail route is open", async () => {
    window.history.pushState({}, "", "/company/coles-group?view=board");

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await screen.findByText("Coles Graduate Program");
    expect(window.location.search).toContain("view=board");
    expect(screen.queryByRole("tablist", { name: /listing view tabs/i })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /search companies/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/company progress board/i)).not.toBeInTheDocument();
  });

  it("renders student-first sections and detailed JSON coverage on company detail", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    const companyButton = await screen.findByRole("button", { name: /open coles group details/i });
    await user.click(companyButton);

    expect(await screen.findByText(/industry/i)).toBeInTheDocument();
    expect(screen.getAllByText("Retail").length).toBeGreaterThan(0);
    expect(screen.getByText(/can i apply\?/i)).toBeInTheDocument();
    expect(screen.getByText(/how this program works/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /recruitment process/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/application tips/i)).toBeInTheDocument();
    expect(screen.getByText(/what this company is focused on/i)).toBeInTheDocument();
    expect(screen.getByText(/source confidence & references/i)).toBeInTheDocument();
    expect(screen.getAllByText(/citizens or permanent residents/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/graduate by end of 2026/i)).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText(/submit transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/video interview/i)).toBeInTheDocument();
    expect(screen.getByText(/apply before the deadline week/i)).toBeInTheDocument();
    expect(screen.getByText(/cost-of-living pressure/i)).toBeInTheDocument();
    expect(screen.getByText(/updated:/i)).toBeInTheDocument();
    expect(screen.getByText(/source confidence:/i)).toBeInTheDocument();
    expect(screen.queryByText(/program confidence:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dates and streams are from the official grad page/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll(".scroll-panel").length).toBeGreaterThan(0);
  });

  it("returns to full board view after closing detail when URL has view=board", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/company/coles-group?view=board");

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await screen.findByText("Coles Graduate Program");
    expect(screen.queryByRole("tablist", { name: /listing view tabs/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close company details/i }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
      expect(window.location.search).toContain("view=board");
    });

    expect(screen.getByRole("tablist", { name: /listing view tabs/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/company progress board/i)).toBeInTheDocument();
  });
});

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
    open_date: "2099-03-10",
    close_date: "2099-04-12",
    salary_text: null,
    streams: ["Technology"]
  },
  eligibility: {
    work_rights: "Australian or New Zealand citizens or permanent residents"
  },
  recruitment_process: {
    stages: [
      {
        name: "Online application"
      }
    ]
  },
  commercial_context: {
    exec_themes: ["Customer value"],
    profit_engine: "Retail"
  },
  provenance: {
    sources: [
      {
        title: "Official source",
        url: "https://example.com"
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
    const boardTab = screen.getByRole("tab", { name: /board view/i });
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

  it("shows industry, streams, and plain eligibility content in detail utility cards", async () => {
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
    expect(screen.getAllByText(/streams/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Technology").length).toBeGreaterThan(0);
    expect(screen.getByText(/eligibility/i)).toBeInTheDocument();
    expect(screen.getByText(/citizens or permanent residents/i)).toBeInTheDocument();
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

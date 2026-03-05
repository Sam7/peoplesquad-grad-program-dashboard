import { CalendarClock, Search } from "lucide-react";
import { getDeadlineUrgency } from "../../domain/dates";
import { formatDisplayDate, formatRelativeDeadline } from "../../domain/presentation";
import type { FiltersState, ProgressState } from "../../domain/filters";
import type { ListCompany } from "../../data/companyData";
import { cn } from "../../lib/cn";
import { CompanyBoardView } from "./CompanyBoardView";
import { ProgressControl } from "../progress/ProgressControl";

function formatStatusLabel(status: ListCompany["status"]): string {
  if (status === "upcoming") {
    return "Upcoming";
  }
  if (status === "open") {
    return "Open";
  }
  if (status === "closed") {
    return "Closed";
  }
  return "Unknown";
}

interface CompanyListPaneProps {
  filteredCompanies: ListCompany[];
  allCompanies: ListCompany[];
  allStreams: string[];
  filters: FiltersState;
  selectedId: string | null;
  onSearchChange: (value: string) => void;
  onToggleFilter: (key: "open" | "soon", value: boolean) => void;
  onWorkRightsChange: (value: FiltersState["workRights"]) => void;
  onSortChange: (value: FiltersState["sort"]) => void;
  onStreamChange: (value: string) => void;
  onSelectCompany: (id: string) => void;
  onSetProgress: (companyId: string, state: ProgressState) => void;
  onSetView: (view: FiltersState["view"]) => void;
}

export function CompanyListPane({
  filteredCompanies,
  allCompanies,
  allStreams,
  filters,
  selectedId,
  onSearchChange,
  onToggleFilter,
  onWorkRightsChange,
  onSortChange,
  onStreamChange,
  onSelectCompany,
  onSetProgress,
  onSetView
}: CompanyListPaneProps) {
  const isDetailMode = selectedId !== null;
  const effectiveView: FiltersState["view"] = isDetailMode ? "search" : filters.view;

  return (
    <section className={cn("list-pane", selectedId && "list-pane--selected")} aria-label="Company list">
      {!isDetailMode ? (
        <div className="listing-tabs" role="tablist" aria-label="Listing view tabs">
          <button
            role="tab"
            aria-selected={filters.view === "search"}
            className={cn("listing-tabs__tab", filters.view === "search" && "listing-tabs__tab--active")}
            onClick={() => onSetView("search")}
          >
            Search View
          </button>
          <button
            role="tab"
            aria-selected={filters.view === "board"}
            className={cn("listing-tabs__tab", filters.view === "board" && "listing-tabs__tab--active")}
            onClick={() => onSetView("board")}
          >
            Board View
          </button>
        </div>
      ) : null}

      {effectiveView === "search" ? (
        <>
          <div className="filters">
            <label className="filters__search">
              <Search size={18} aria-hidden />
              <span className="sr-only">Search companies</span>
              <input
                type="search"
                value={filters.q}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search ASX200 and global grad employers"
                aria-label="Search companies"
              />
            </label>

            <div className="filters__row">
              <label>
                <input
                  type="checkbox"
                  checked={filters.open}
                  onChange={(event) => onToggleFilter("open", event.target.checked)}
                />
                Open now
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={filters.soon}
                  onChange={(event) => onToggleFilter("soon", event.target.checked)}
                />
                Closing soon
              </label>
            </div>

            <div className="filters__row">
              <label>
                Work rights
                <select value={filters.workRights} onChange={(event) => onWorkRightsChange(event.target.value as FiltersState["workRights"])}>
                  <option value="all">All</option>
                  <option value="citizen_pr">Citizen / PR</option>
                  <option value="visa_ok">Visa eligible</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>

              <label>
                Stream
                <select value={filters.stream[0] ?? ""} onChange={(event) => onStreamChange(event.target.value)}>
                  <option value="">All streams</option>
                  {allStreams.map((stream) => (
                    <option key={stream} value={stream}>
                      {stream}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Sort
                <select value={filters.sort} onChange={(event) => onSortChange(event.target.value as FiltersState["sort"])}>
                  <option value="deadline">Deadline</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>
          </div>

          <ul className="company-list">
            {filteredCompanies.map((company) => (
              <li
                key={company.id}
                className={cn(
                  "company-card",
                  selectedId === company.id && "company-card--active",
                  getDeadlineUrgency(company.closeDateRaw, company.status) === "soon" && "company-card--soon"
                )}
              >
                <button
                  className="company-card__open"
                  onClick={() => onSelectCompany(company.id)}
                  aria-label={`Open ${company.name} details`}
                >
                  <div className="company-card__header">
                    <h2>{company.name}</h2>
                  </div>
                  <p className="company-card__date">
                    <CalendarClock size={14} aria-hidden />
                    <span>
                      {company.status === "upcoming"
                        ? `Opens: ${formatDisplayDate(company.openDateRaw)}`
                        : company.status === "unknown"
                          ? `Date: ${formatDisplayDate(company.closeDateRaw)}`
                          : `Closes: ${formatDisplayDate(company.closeDateRaw)}`}
                    </span>
                  </p>
                  <p
                    className={cn(
                      "company-card__relative",
                      getDeadlineUrgency(company.closeDateRaw, company.status) === "soon" && "company-card__relative--soon"
                    )}
                  >
                    {formatRelativeDeadline(company.closeDateRaw, company.status, company.openDateRaw)}
                  </p>
                </button>

                <div className="company-card__meta">
                  <span className={cn("status-pill", `status-pill--${company.status}`)}>{formatStatusLabel(company.status)}</span>
                  <ProgressControl
                    companyName={company.name}
                    state={company.progressState}
                    onStateChange={(next) => onSetProgress(company.id, next)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <CompanyBoardView companies={allCompanies} onSelectCompany={onSelectCompany} onSetProgress={onSetProgress} />
      )}
    </section>
  );
}

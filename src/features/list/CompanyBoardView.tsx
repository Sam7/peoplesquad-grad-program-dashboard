import { useEffect, useState } from "react";
import { type ListCompany } from "../../data/companyData";
import type { ProgressState } from "../../domain/filters";
import { PROGRESS_META } from "../progress/progressMeta";

interface CompanyBoardViewProps {
  companies: ListCompany[];
  onSelectCompany: (id: string) => void;
  onSetProgress: (companyId: string, state: ProgressState) => void;
}

const BOARD_COLUMNS: Array<{ key: ProgressState; title: string }> = [
  { key: "saved", title: "Saved" },
  { key: "applied", title: "Applied" },
  { key: "interviewing", title: "Interviewing" },
  { key: "offer", title: "Offer" },
  { key: "rejected", title: "Rejected" }
];

function useDragSupport(): boolean {
  const [canDrag, setCanDrag] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(hover: hover)");
    const sync = () => setCanDrag(media.matches);
    sync();

    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return canDrag;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function CompanyBoardView({ companies, onSelectCompany, onSetProgress }: CompanyBoardViewProps) {
  const canDrag = useDragSupport();

  const grouped = BOARD_COLUMNS.map((column) => ({
    ...column,
    items: companies.filter((company) => company.progressState === column.key)
  }));

  return (
    <section className="board-view" aria-label="Company progress board">
      <div className="board-view__grid">
        {grouped.map((column) => {
          const Icon = PROGRESS_META[column.key].icon;

          return (
            <article
              key={column.key}
              className="board-column"
              data-progress-column={column.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const companyId = event.dataTransfer.getData("text/plain");
                if (companyId) {
                  onSetProgress(companyId, column.key);
                }
              }}
            >
              <header className="board-column__header">
                <h3>
                  <span className="board-column__icon" data-testid="board-column-icon" aria-hidden>
                    <Icon size={14} aria-hidden />
                  </span>
                  <span>{column.title}</span>
                </h3>
                <span>{column.items.length}</span>
              </header>

              <div className="board-column__body">
                {column.items.length === 0 ? <p className="board-column__empty">No companies yet</p> : null}

                {column.items.map((company) => (
                  <div
                    key={company.id}
                    className="board-card"
                    data-company-id={company.id}
                    draggable={canDrag}
                    onDragStart={(event) => {
                      if (!canDrag) {
                        return;
                      }
                      event.dataTransfer.setData("text/plain", company.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <button
                      type="button"
                      className="board-card__open"
                      onClick={() => onSelectCompany(company.id)}
                      aria-label={`Open ${company.name} details`}
                    >
                      {company.logoUrl ? (
                        <img
                          src={`/data/${company.logoUrl}`}
                          alt={`${company.name} logo`}
                          className="board-card__logo"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="board-card__logo board-card__logo--fallback" aria-hidden>
                          {initials(company.name)}
                        </span>
                      )}
                      <span className="board-card__name">{company.name}</span>
                    </button>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

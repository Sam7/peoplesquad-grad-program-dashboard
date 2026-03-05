import { type ListCompany } from "../../data/companyData";
import type { ProgressState } from "../../domain/filters";
import { ProgressControl } from "../progress/ProgressControl";

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

export function CompanyBoardView({ companies, onSelectCompany, onSetProgress }: CompanyBoardViewProps) {
  const grouped = BOARD_COLUMNS.map((column) => ({
    ...column,
    items: companies.filter((company) => company.progressState === column.key)
  }));

  return (
    <section className="board-view" aria-label="Company progress board">
      <div className="board-view__grid">
        {grouped.map((column) => (
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
              <h3>{column.title}</h3>
              <span>{column.items.length}</span>
            </header>

            <div className="board-column__body">
              {column.items.length === 0 ? <p className="board-column__empty">No companies yet</p> : null}

              {column.items.map((company) => (
                <div
                  key={company.id}
                  className="board-card"
                  data-company-id={company.id}
                  draggable
                  onDragStart={(event) => {
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
                    {company.name}
                  </button>

                  <ProgressControl
                    companyName={company.name}
                    state={company.progressState}
                    onStateChange={(next) => onSetProgress(company.id, next)}
                    compact
                  />
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

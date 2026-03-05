import { ArrowLeft, CalendarClock, ExternalLink, X } from "lucide-react";
import type { CompanyDetailPayload, ListCompany } from "../../data/companyData";
import { getDeadlineUrgency } from "../../domain/dates";
import { formatDisplayDate, formatRelativeDeadline } from "../../domain/presentation";
import type { ProgressState } from "../../domain/filters";
import { cn } from "../../lib/cn";
import { ProgressControl } from "../progress/ProgressControl";

interface CompanyDetailPaneProps {
  company: ListCompany | null;
  detail: CompanyDetailPayload | null;
  isLoading: boolean;
  onClose: () => void;
  onSetProgress: (companyId: string, state: ProgressState) => void;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface DetailCard {
  key: string;
  title: string;
  value: string;
}

export function CompanyDetailPane({ company, detail, isLoading, onClose, onSetProgress }: CompanyDetailPaneProps) {
  if (!company) {
    return (
      <section className="detail-pane detail-pane--empty" aria-label="Company details">
        <h2>Pick an employer</h2>
        <p>Choose a company to view key dates, eligibility, recruitment flow, and official sources.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="detail-pane" aria-label="Company details">
        <p>Loading company details...</p>
      </section>
    );
  }

  const safeDetail = detail ?? ({} as CompanyDetailPayload);
  const program = asObject(safeDetail.program);
  const eligibility = asObject(safeDetail.eligibility);
  const recruitment = asObject(safeDetail.recruitment_process);
  const commercial = asObject(safeDetail.commercial_context);
  const provenance = asObject(safeDetail.provenance);

  const programName = asString(program.name) ?? "Not published";
  const applyUrl = asString(program.direct_apply_url) ?? company.directApplyUrl;
  const closeDate = asString(program.close_date) ?? company.closeDateRaw;
  const salaryText = asString(program.salary_text) ?? "Not published";

  const workRights = asString(eligibility.work_rights) ?? company.workRightsText ?? "Not published";
  const streamTags = asStringArray(program.streams);
  const recruitmentStages = Array.isArray(recruitment.stages)
    ? (recruitment.stages as Array<Record<string, unknown>>)
    : [];
  const tips = asStringArray(recruitment.tips);

  const execThemes = asStringArray(commercial.exec_themes);
  const sourceItems = Array.isArray(provenance.sources) ? (provenance.sources as Array<Record<string, unknown>>) : [];

  const essentialCards: DetailCard[] = [
    {
      key: "archetype",
      title: "Recruitment Archetype",
      value: recruitmentStages.length > 0 ? String(recruitmentStages[0].name ?? "Not published") : "Not published"
    },
    {
      key: "rotation",
      title: "Rotation Logic",
      value: asString(program.rotation_text) ?? "Not published"
    },
    {
      key: "support",
      title: "Support Hierarchy",
      value: tips.length > 0 ? tips[0] : "Not published"
    },
    {
      key: "conversion",
      title: "Conversion Strategy",
      value: asString(program.duration_text) ?? "Not published"
    },
    {
      key: "signal",
      title: "Success Signal",
      value: execThemes[0] ?? "Not published"
    }
  ];

  const commercialCards: DetailCard[] = [
    {
      key: "themes",
      title: "CEO Themes",
      value: execThemes.slice(0, 3).join(" • ") || "Not published"
    },
    {
      key: "profit",
      title: "Profit Engine",
      value: asString(commercial.profit_engine) ?? "Not published"
    },
    {
      key: "headwinds",
      title: "Market Headwinds",
      value: asString(commercial.headwinds) ?? "Not published"
    },
    {
      key: "esg",
      title: "ESG Action",
      value: asString(commercial.esg) ?? "Not published"
    },
    {
      key: "pivot",
      title: "Recent Pivot",
      value: asString(commercial.recent_pivot) ?? "Not published"
    }
  ];

  const urgency = getDeadlineUrgency(closeDate, company.status);

  return (
    <section className="detail-pane" aria-label="Company details">
      <div className="detail-pane__topbar">
        <button className="detail-pane__close" onClick={onClose} aria-label="Close company details">
          <ArrowLeft size={16} aria-hidden />
          <span>Back</span>
        </button>
        <button className="detail-pane__close detail-pane__close--desktop" onClick={onClose} aria-label="Close detail panel">
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="utility-header">
        <div className="utility-header__identity">
          {company.logoUrl ? (
            <img src={`/data/${company.logoUrl}`} alt={`${company.name} logo`} className="utility-header__logo" />
          ) : (
            <div className="utility-header__fallback-logo" aria-hidden>
              {getInitials(company.name)}
            </div>
          )}
          <div>
            <h2>{company.name}</h2>
            <p>{programName}</p>
          </div>
        </div>

        <div className="utility-header__actions">
          {applyUrl ? (
            <a href={applyUrl} target="_blank" rel="noreferrer" className="apply-link">
              Direct Apply
              <ExternalLink size={14} aria-hidden />
            </a>
          ) : (
            <span className="muted">Direct apply link not published</span>
          )}

          <ProgressControl
            companyName={company.name}
            state={company.progressState}
            onStateChange={(next) => onSetProgress(company.id, next)}
          />
        </div>

        <div className="utility-header__metrics">
          <div className="metric-card">
            <span>Closes</span>
            <p className={cn(urgency === "soon" && "metric-card__value--soon")}>
              <CalendarClock size={14} aria-hidden />
              {formatDisplayDate(closeDate)}
            </p>
            <small>{formatRelativeDeadline(closeDate)}</small>
          </div>

          <div className="metric-card">
            <span>Eligibility</span>
            <div className="tag-row">
              <span className="tag-chip">{workRights}</span>
              {streamTags.slice(0, 2).map((stream) => (
                <span key={stream} className="tag-chip tag-chip--secondary">
                  {stream}
                </span>
              ))}
            </div>
          </div>

          <div className="metric-card">
            <span>Salary</span>
            <p>Salary: {salaryText}</p>
          </div>

          <div className="metric-card">
            <span>Status</span>
            <p>
              <span className={cn("status-pill", `status-pill--${company.status}`)}>{company.status}</span>
            </p>
          </div>
        </div>
      </div>

      <section className="canvas-section canvas-section--essential">
        <h3>The 5 Essential Program Facts</h3>
        <div className="canvas-grid">
          {essentialCards.map((card) => (
            <article key={card.key} className="canvas-card">
              <h4>{card.title}</h4>
              <p>{card.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="canvas-section canvas-section--commercial">
        <h3>The 5 Critical Data Fields</h3>
        <div className="canvas-grid">
          {commercialCards.map((card) => (
            <article key={card.key} className="canvas-card">
              <h4>{card.title}</h4>
              <p>{card.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h3>Sources</h3>
        {sourceItems.length > 0 ? (
          <ul>
            {sourceItems.map((source, index) => {
              const title = String(source.title ?? "Official source");
              const url = asString(source.url);
              return (
                <li key={`${title}-${index}`}>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      {title}
                    </a>
                  ) : (
                    title
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No sources listed.</p>
        )}
      </section>
    </section>
  );
}

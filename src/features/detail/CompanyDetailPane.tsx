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

export function CompanyDetailPane({ company, detail, isLoading, onClose, onSetProgress }: CompanyDetailPaneProps) {
  if (!company) {
    return undefined;
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
  const classification = asObject(safeDetail.classification);
  const eligibility = asObject(safeDetail.eligibility);
  const recruitment = asObject(safeDetail.recruitment_process);
  const commercial = asObject(safeDetail.commercial_context);
  const provenance = asObject(safeDetail.provenance);

  const programName = asString(program.name) ?? "Not published";
  const applyUrl = asString(program.direct_apply_url) ?? company.directApplyUrl;
  const openDate = asString(program.open_date) ?? company.openDateRaw;
  const closeDate = asString(program.close_date) ?? company.closeDateRaw;
  const salaryText = asString(program.salary_text) ?? "Not published";

  const workRights = asString(eligibility.work_rights) ?? company.workRightsText ?? "Not published";
  const streamTags = asStringArray(program.streams).length > 0 ? asStringArray(program.streams) : company.streamTags;
  const derivedIndustry = asString(classification.industry_bucket);
  const industries = company.industries.length > 0 ? company.industries : derivedIndustry ? [derivedIndustry] : [];
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
            <div className="utility-header__name-row">
              <h2>{company.name}</h2>
              {industries.map((industry) => (
                <span key={industry} className="industry-pill">
                  {industry}
                </span>
              ))}
            </div>
            <p className="utility-header__field-label">Industry</p>
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
            <span>Timeline & status</span>
            <p>
              <CalendarClock size={14} aria-hidden />
              Opens: {formatDisplayDate(openDate)}
            </p>
            <p className={cn(urgency === "soon" && "metric-card__value--soon")}>
              <CalendarClock size={14} aria-hidden />
              Closes: {formatDisplayDate(closeDate)}
            </p>
            <small>{formatRelativeDeadline(closeDate, company.status, openDate)}</small>
            <p>
              <span className={cn("status-pill", `status-pill--${company.status}`)}>{formatStatusLabel(company.status)}</span>
            </p>
          </div>

          <div className="metric-card metric-card--plain">
            <span>Eligibility</span>
            <p>{workRights}</p>
          </div>

          <div className="metric-card">
            <span>Streams</span>
            <div className="tag-row">
              {streamTags.length > 0 ? (
                streamTags.map((stream) => (
                  <span key={stream} className="tag-chip tag-chip--secondary">
                    {stream}
                  </span>
                ))
              ) : (
                <p className="muted">Not published</p>
              )}
            </div>
          </div>

          <div className="metric-card">
            <span>Salary</span>
            <p>Salary: {salaryText}</p>
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

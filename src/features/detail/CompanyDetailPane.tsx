import { ArrowLeft, CalendarClock, ExternalLink, X } from "lucide-react";
import type { CompanyDetailPayload, ListCompany } from "../../data/companyData";
import { getDeadlineUrgency, parseFlexibleDate } from "../../domain/dates";
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

interface StageItem {
  name: string;
  details: string | null;
}

interface SourceItem {
  title: string;
  url: string | null;
}

function asStages(value: unknown): StageItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asObject(item))
    .map((stage) => ({
      name: asString(stage.name) ?? "Unnamed stage",
      details: asString(stage.details)
    }))
    .filter((stage) => stage.name.trim().length > 0);
}

function asSources(value: unknown): SourceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asObject(item))
    .map((source) => ({
      title: asString(source.title) ?? "Official source",
      url: asString(source.url)
    }));
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
  const urls = asObject(safeDetail.urls);
  const classification = asObject(safeDetail.classification);
  const eligibility = asObject(safeDetail.eligibility);
  const recruitment = asObject(safeDetail.recruitment_process);
  const commercial = asObject(safeDetail.commercial_context);
  const provenance = asObject(safeDetail.provenance);

  const programName = asString(program.name) ?? "Not published";
  const applyUrl = asString(program.direct_apply_url) ?? company.directApplyUrl ?? asString(urls.apply_url);
  const overviewUrl = asString(program.overview_url) ?? asString(urls.grad_program_url);
  const careersUrl = asString(urls.careers_url) ?? company.careerUrl;
  const openDate = asString(program.open_date) ?? company.openDateRaw;
  const closeDate = asString(program.close_date) ?? company.closeDateRaw;
  const salaryText = asString(program.salary_text) ?? "Not published";
  const durationText = asString(program.duration_text) ?? "Not published";
  const rotationText = asString(program.rotation_text) ?? "Not published";

  const workRights = asString(eligibility.work_rights) ?? company.workRightsText ?? "Not published";
  const graduationWindow = asString(eligibility.graduation_window) ?? "Not published";
  const disciplines = asStringArray(eligibility.disciplines);
  const minimumRequirements = asStringArray(eligibility.minimum_requirements);
  const streamTags = asStringArray(program.streams).length > 0 ? asStringArray(program.streams) : company.streamTags;
  const locations = asStringArray(program.locations);
  const derivedIndustry = asString(classification.industry_bucket);
  const industries = company.industries.length > 0 ? company.industries : derivedIndustry ? [derivedIndustry] : [];
  const recruitmentStages = asStages(recruitment.stages);
  const tips = asStringArray(recruitment.tips);

  const execThemes = asStringArray(commercial.exec_themes);
  const profitEngine = asString(commercial.profit_engine) ?? "Not published";
  const headwinds = asString(commercial.headwinds) ?? "Not published";
  const esg = asString(commercial.esg) ?? "Not published";
  const recentPivot = asString(commercial.recent_pivot) ?? "Not published";

  const updatedAt = asString(provenance.updated_at);
  const provenanceNotes = asStringArray(provenance.notes);
  const sourceItems = asSources(provenance.sources);

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
              Apply
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
            {(() => {
              const parsedOpenDate = parseFlexibleDate(openDate);
              const isOpenDateInFuture = parsedOpenDate && parsedOpenDate > new Date();
              return isOpenDateInFuture ? (
                <p>
                  <CalendarClock size={14} aria-hidden />
                  Opens: {formatDisplayDate(openDate)}
                </p>
              ) : null;
            })()}
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

      <section className="detail-section">
        <h3>Can I apply?</h3>
        <div className="detail-grid">
          <article className="detail-card">
            <h4>Work rights</h4>
            <p>{workRights}</p>
          </article>
          <article className="detail-card">
            <h4>Graduation timing</h4>
            <p>{graduationWindow}</p>
          </article>
          <article className="detail-card">
            <h4>Degree backgrounds</h4>
            {disciplines.length > 0 ? (
              <ul className="detail-list scroll-panel">
                {disciplines.map((discipline) => (
                  <li key={discipline}>{discipline}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Not published</p>
            )}
          </article>
          <article className="detail-card">
            <h4>Minimum requirements</h4>
            {minimumRequirements.length > 0 ? (
              <ul className="detail-list scroll-panel">
                {minimumRequirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Not published</p>
            )}
          </article>
        </div>
      </section>

      <section className="detail-section">
        <h3>How this program works</h3>
        <div className="detail-grid">
          <article className="detail-card">
            <h4>Program length</h4>
            <p>{durationText}</p>
          </article>
          <article className="detail-card">
            <h4>Rotation setup</h4>
            <p>{rotationText}</p>
          </article>
          <article className="detail-card">
            <h4>Locations</h4>
            {locations.length > 0 ? (
              <ul className="detail-list scroll-panel">
                {locations.map((location) => (
                  <li key={location}>{location}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Not published</p>
            )}
          </article>
          <article className="detail-card">
            <h4>Official program page</h4>
            {overviewUrl ? (
              <p>
                <a href={overviewUrl} target="_blank" rel="noreferrer">
                  View program overview
                </a>
              </p>
            ) : (
              <p className="muted">Not published</p>
            )}
          </article>
        </div>
      </section>

      <section className="detail-section">
        <h3>Recruitment process</h3>
        {recruitmentStages.length > 0 ? (
          <ol className="process-timeline">
            {recruitmentStages.map((stage, index) => (
              <li key={`${stage.name}-${index}`} className="process-timeline__item">
                <span className="process-timeline__step">{index + 1}</span>
                <div>
                  <h4>{stage.name}</h4>
                  <p>{stage.details ?? "Details not published."}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Not published</p>
        )}
      </section>

      <section className="detail-section">
        <h3>Application tips</h3>
        {tips.length > 0 ? (
          <ul className="detail-list scroll-panel">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Not published</p>
        )}
      </section>

      <section className="detail-section">
        <h3>What this company is focused on</h3>
        <div className="detail-grid">
          <article className="detail-card">
            <h4>Current priorities</h4>
            {execThemes.length > 0 ? (
              <ul className="detail-list scroll-panel">
                {execThemes.map((theme) => (
                  <li key={theme}>{theme}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Not published</p>
            )}
          </article>
          <article className="detail-card">
            <h4>How they make money</h4>
            <p>{profitEngine}</p>
          </article>
          <article className="detail-card">
            <h4>Current challenges</h4>
            <p>{headwinds}</p>
          </article>
          <article className="detail-card">
            <h4>Sustainability commitments</h4>
            <p>{esg}</p>
          </article>
          <article className="detail-card">
            <h4>Recent strategic move</h4>
            <p>{recentPivot}</p>
          </article>
        </div>
      </section>

      <section className="detail-section">
        <h3>Source confidence & references</h3>
        <p>
          Updated: <strong>{formatDisplayDate(updatedAt)}</strong>
        </p>

        <div className="detail-grid">
          <article className="detail-card">
            <h4>Official links</h4>
            <ul className="detail-list">
              {applyUrl ? (
                <li>
                  <a href={applyUrl} target="_blank" rel="noreferrer">
                    Direct apply
                  </a>
                </li>
              ) : null}
              {overviewUrl ? (
                <li>
                  <a href={overviewUrl} target="_blank" rel="noreferrer">
                    Program overview
                  </a>
                </li>
              ) : null}
              {careersUrl ? (
                <li>
                  <a href={careersUrl} target="_blank" rel="noreferrer">
                    Careers page
                  </a>
                </li>
              ) : null}
              {!applyUrl && !overviewUrl && !careersUrl ? <li className="muted">No official links listed.</li> : null}
            </ul>
          </article>
          <article className="detail-card">
            <h4>Notes</h4>
            {provenanceNotes.length > 0 ? (
              <ul className="detail-list scroll-panel">
                {provenanceNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No notes provided.</p>
            )}
          </article>
        </div>

        <h4>All official sources</h4>
        {sourceItems.length > 0 ? (
          <ul className="detail-list scroll-panel">
            {sourceItems.map((source, index) => {
              return (
                <li key={`${source.title}-${index}`}>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  ) : (
                    source.title
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

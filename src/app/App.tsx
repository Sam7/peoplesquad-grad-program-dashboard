import { useEffect, useMemo, useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { MobileCtaBar } from "../components/layout/MobileCtaBar";
import {
  loadCompanyDetail,
  loadCompanyIndex,
  mapIndexToListCompanies,
  type CompanyDetailPayload,
  type CompanyIndexPayload,
  type ListCompany
} from "../data/companyData";
import { filterAndSortCompanies, type ProgressState } from "../domain/filters";
import { CompanyDetailPane } from "../features/detail/CompanyDetailPane";
import { CompanyListPane } from "../features/list/CompanyListPane";
import { useUrlFilters } from "../features/navigation/useUrlFilters";
import { useProgress } from "../features/progress/useProgress";
import { useTheme } from "../features/theme/useTheme";
import { cn } from "../lib/cn";

const DEFAULT_PEOPLESQUAD_URL = "https://peoplesquad.com.au";

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch("/company/:companyId");
  const selectedCompanyId = match?.params.companyId ?? null;

  const peoplesquadUrl = import.meta.env.VITE_PEOPLESQUAD_URL ?? DEFAULT_PEOPLESQUAD_URL;

  const { filters, setFilters } = useUrlFilters();
  const { progressMap, updateCompanyProgress } = useProgress();
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();

  const [indexPayload, setIndexPayload] = useState<CompanyIndexPayload | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, CompanyDetailPayload>>({});
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const payload = await loadCompanyIndex();
        if (!cancelled) {
          setIndexPayload(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setIndexError(error instanceof Error ? error.message : "Failed to load companies");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCompanyId || detailById[selectedCompanyId]) {
      return;
    }
    const companyId = selectedCompanyId;

    let cancelled = false;
    setIsDetailLoading(true);

    async function load(): Promise<void> {
      try {
        const detail = await loadCompanyDetail(companyId);
        if (!cancelled) {
          setDetailById((prev) => ({
            ...prev,
            [companyId]: detail
          }));
        }
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, detailById]);

  const allCompanies = useMemo(() => {
    if (!indexPayload) {
      return [];
    }
    return mapIndexToListCompanies(indexPayload, progressMap);
  }, [indexPayload, progressMap]);

  const filteredCompanies = useMemo(() => filterAndSortCompanies(allCompanies, filters), [allCompanies, filters]);

  const allStreams = useMemo(() => {
    const set = new Set<string>();
    for (const company of allCompanies) {
      for (const stream of company.streamTags) {
        set.add(stream);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allCompanies]);

  const selectedCompany = useMemo<ListCompany | null>(
    () => allCompanies.find((company) => company.id === selectedCompanyId) ?? null,
    [allCompanies, selectedCompanyId]
  );

  function goToCompany(companyId: string): void {
    navigate({
      pathname: `/company/${companyId}`,
      search: location.search
    });
  }

  function closeDetail(): void {
    navigate({
      pathname: "/",
      search: location.search
    });
  }

  function handleToggleFilter(key: "open" | "soon", value: boolean): void {
    if (key === "open") {
      setFilters({ open: value });
      return;
    }
    setFilters({ soon: value });
  }

  function handleSetProgress(companyId: string, state: ProgressState): void {
    updateCompanyProgress(companyId, state);
  }

  if (indexError) {
    return <p role="alert">{indexError}</p>;
  }

  return (
    <div className="app-shell">
      <AppHeader
        peoplesquadUrl={peoplesquadUrl}
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
      />

      <main className={cn("app-main", selectedCompanyId && "app-main--detail")}>
        <CompanyListPane
          filteredCompanies={filteredCompanies}
          allCompanies={allCompanies}
          allStreams={allStreams}
          filters={filters}
          selectedId={selectedCompanyId}
          onSearchChange={(value) => setFilters({ q: value })}
          onToggleFilter={handleToggleFilter}
          onSortChange={(value) => setFilters({ sort: value })}
          onWorkRightsChange={(value) => setFilters({ workRights: value })}
          onStreamChange={(value) => setFilters({ stream: value ? [value] : [] })}
          onSelectCompany={goToCompany}
          onSetProgress={handleSetProgress}
          onSetView={(view) => setFilters({ view })}
        />

        <CompanyDetailPane
          company={selectedCompany}
          detail={selectedCompanyId ? detailById[selectedCompanyId] ?? null : null}
          isLoading={isDetailLoading}
          onClose={closeDetail}
          onSetProgress={handleSetProgress}
        />
      </main>

      {!indexPayload ? <p className="loading-row">Loading companies...</p> : null}

      <MobileCtaBar peoplesquadUrl={peoplesquadUrl} />
    </div>
  );
}

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { buildSearchParams, defaultFilters, parseSearchParams, type FiltersState } from "../../domain/filters";

export interface UrlFiltersApi {
  filters: FiltersState;
  setFilters: (next: Partial<FiltersState>) => void;
  resetFilters: () => void;
}

export function useUrlFilters(): UrlFiltersApi {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => parseSearchParams(searchParams), [searchParams]);

  function setFilters(next: Partial<FiltersState>): void {
    const merged: FiltersState = {
      ...filters,
      ...next
    };

    setSearchParams(buildSearchParams(merged));
  }

  function resetFilters(): void {
    setSearchParams(buildSearchParams(defaultFilters()));
  }

  return {
    filters,
    setFilters,
    resetFilters
  };
}

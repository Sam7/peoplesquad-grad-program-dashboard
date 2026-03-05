import { useMemo, useState } from "react";
import {
  getProgressMap,
  getProgressState,
  setProgressState,
  type ProgressMap,
  type ProgressState
} from "./progressStore";

export interface ProgressApi {
  progressMap: ProgressMap;
  getCompanyProgress: (companyId: string) => ProgressState;
  updateCompanyProgress: (companyId: string, state: ProgressState) => void;
}

export function useProgress(): ProgressApi {
  const [progressMapState, setProgressMapState] = useState<ProgressMap>(() => getProgressMap());

  const progressMap = useMemo(() => progressMapState, [progressMapState]);

  function getCompanyProgress(companyId: string): ProgressState {
    return progressMap[companyId] ?? "none";
  }

  function updateCompanyProgress(companyId: string, state: ProgressState): void {
    setProgressState(companyId, state);
    setProgressMapState(getProgressMap());
  }

  return {
    progressMap,
    getCompanyProgress,
    updateCompanyProgress
  };
}

export { getProgressState };
export type { ProgressState };

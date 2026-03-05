import { useEffect, useMemo, useState } from "react";
import { Award, Bookmark, CircleX, Flag, Handshake, Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { getLeftProgressOption, getRightProgressOption, type ProgressState } from "./progressStore";

interface ProgressControlProps {
  companyName: string;
  state: ProgressState;
  onStateChange: (next: ProgressState) => void;
  compact?: boolean;
}

interface ProgressMeta {
  label: string;
  icon: typeof Bookmark;
}

const PROGRESS_META: Record<ProgressState, ProgressMeta> = {
  none: { label: "Track", icon: Plus },
  saved: { label: "Saved", icon: Bookmark },
  applied: { label: "Applied", icon: Handshake },
  interviewing: { label: "Interviewing", icon: Flag },
  offer: { label: "Offer", icon: Award },
  rejected: { label: "Rejected", icon: CircleX }
};

function useHoverSupport(): boolean {
  const [supportsHover, setSupportsHover] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(hover: hover)");
    const apply = () => setSupportsHover(media.matches);
    apply();

    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return supportsHover;
}

function getLabel(state: ProgressState): string {
  return PROGRESS_META[state].label;
}

export function ProgressControl({ companyName, state, onStateChange, compact = false }: ProgressControlProps) {
  const [expanded, setExpanded] = useState(false);
  const supportsHover = useHoverSupport();

  const leftOption = getLeftProgressOption(state);
  const rightOption = getRightProgressOption(state);

  useEffect(() => {
    if (state === "none") {
      setExpanded(false);
    }
  }, [state]);

  const currentMeta = useMemo(() => PROGRESS_META[state], [state]);
  const CurrentIcon = currentMeta.icon;

  function handleCenterClick(): void {
    if (state === "none") {
      onStateChange("saved");
      return;
    }

    if (supportsHover) {
      onStateChange("none");
      return;
    }

    setExpanded((value) => !value);
  }

  return (
    <div
      className={cn(
        "progress-control",
        compact && "progress-control--compact",
        expanded && "progress-control--expanded",
        `progress-control--${state}`
      )}
      onMouseEnter={() => {
        if (supportsHover && state !== "none") {
          setExpanded(true);
        }
      }}
      onMouseLeave={() => {
        if (supportsHover) {
          setExpanded(false);
        }
      }}
    >
      {leftOption && expanded ? (
        <button
          type="button"
          className="progress-control__side progress-control__side--left"
          onClick={() => onStateChange(leftOption)}
          aria-label={`Move ${companyName} to ${getLabel(leftOption)}`}
        >
          <span>{getLabel(leftOption)}</span>
        </button>
      ) : null}

      <button
        type="button"
        className="progress-control__center"
        onClick={handleCenterClick}
        aria-label={`Progress for ${companyName}`}
      >
        <CurrentIcon size={14} aria-hidden />
        <span>{currentMeta.label}</span>
      </button>

      {expanded && state !== "none" ? (
        <button
          type="button"
          className="progress-control__clear"
          onClick={() => onStateChange("none")}
          aria-label={`Clear progress for ${companyName}`}
        >
          Clear
        </button>
      ) : null}

      {rightOption && expanded ? (
        <button
          type="button"
          className="progress-control__side progress-control__side--right"
          onClick={() => onStateChange(rightOption)}
          aria-label={`Move ${companyName} to ${getLabel(rightOption)}`}
        >
          <span>{getLabel(rightOption)}</span>
        </button>
      ) : null}
    </div>
  );
}

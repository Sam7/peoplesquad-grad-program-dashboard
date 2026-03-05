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

  const negativeOption = getLeftProgressOption(state);
  const positiveOption = getRightProgressOption(state);

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

    if (expanded) {
      onStateChange("none");
      setExpanded(false);
      return;
    }

    setExpanded(true);
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
      {positiveOption && expanded ? (
        <button
          type="button"
          className="progress-control__side progress-control__side--top"
          onClick={() => {
            onStateChange(positiveOption);
            setExpanded(false);
          }}
          aria-label={`Move ${companyName} to ${getLabel(positiveOption)}`}
        >
          <span>{getLabel(positiveOption)}</span>
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

      {negativeOption && expanded ? (
        <button
          type="button"
          className="progress-control__side progress-control__side--bottom"
          onClick={() => {
            onStateChange(negativeOption);
            setExpanded(false);
          }}
          aria-label={`Move ${companyName} to ${getLabel(negativeOption)}`}
        >
          <span>{getLabel(negativeOption)}</span>
        </button>
      ) : null}
    </div>
  );
}

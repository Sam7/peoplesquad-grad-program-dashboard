import { Award, Bookmark, CircleX, Flag, Handshake, Plus } from "lucide-react";
import type { ProgressState } from "./progressStore";

export const PROGRESS_META: Record<
  ProgressState,
  {
    label: string;
    icon: typeof Bookmark;
  }
> = {
  none: { label: "Track", icon: Plus },
  saved: { label: "Saved", icon: Bookmark },
  applied: { label: "Applied", icon: Handshake },
  interviewing: { label: "Interviewing", icon: Flag },
  offer: { label: "Offer", icon: Award },
  rejected: { label: "Rejected", icon: CircleX }
};

export function getProgressLabel(state: ProgressState): string {
  return PROGRESS_META[state].label;
}

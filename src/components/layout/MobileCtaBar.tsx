import { ExternalLink } from "lucide-react";

const TAGLINE = "Prepare for an elite career. Be ready for the real world.";

interface MobileCtaBarProps {
  peoplesquadUrl: string;
}

export function MobileCtaBar({ peoplesquadUrl }: MobileCtaBarProps) {
  return (
    <div className="mobile-cta" role="contentinfo">
      <a href={peoplesquadUrl} target="_blank" rel="noreferrer" className="mobile-cta__link">
        <span>{TAGLINE}</span>
        <ExternalLink size={14} aria-hidden />
      </a>
    </div>
  );
}

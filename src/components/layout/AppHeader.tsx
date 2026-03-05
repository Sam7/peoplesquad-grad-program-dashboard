import { ExternalLink, Moon, Sun } from "lucide-react";
import type { ResolvedTheme } from "../../features/theme/useTheme";

const TAGLINE = "Prepare for an elite career. Be ready for the real world.";
const TOOL_NAME = "Graduate Program Dashboard";

interface AppHeaderProps {
  peoplesquadUrl: string;
  resolvedTheme: ResolvedTheme;
  onThemeToggle: () => void;
}

export function AppHeader({ peoplesquadUrl, resolvedTheme, onThemeToggle }: AppHeaderProps) {
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const Icon = nextTheme === "dark" ? Moon : Sun;
  const buttonLabel = `Switch to ${nextTheme.charAt(0).toUpperCase()}${nextTheme.slice(1)} theme`;

  return (
    <header className="app-header" aria-label="PeopleSquad header">
      <div className="app-header__left">
        <img
          src="/assets/brand/peoplesquad-logo-teal.png"
          alt="PeopleSquad"
          className="app-header__logo"
          loading="eager"
          decoding="async"
        />
        <div className="app-header__titles">
          <h1 className="app-header__tool">{TOOL_NAME}</h1>
        </div>
      </div>

      <div className="app-header__right">
        <button type="button" className="theme-toggle__btn theme-toggle__btn--single" aria-label={buttonLabel} onClick={onThemeToggle}>
          <Icon size={14} aria-hidden />
          <span>{nextTheme === "dark" ? "Dark" : "Light"} mode</span>
        </button>

        <a href={peoplesquadUrl} target="_blank" rel="noreferrer" className="app-header__cta">
          <span>{TAGLINE}</span>
          <ExternalLink size={16} aria-hidden />
        </a>
      </div>
    </header>
  );
}

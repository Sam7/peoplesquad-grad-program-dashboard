import { ExternalLink, Monitor, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "../../features/theme/useTheme";

const TAGLINE = "Prepare for an elite career. Be ready for the real world.";
const TOOL_NAME = "Graduate Program Dashboard";

interface AppHeaderProps {
  peoplesquadUrl: string;
  themePreference: ThemePreference;
  onThemePreferenceChange: (next: ThemePreference) => void;
}

const THEME_OPTIONS: Array<{ key: ThemePreference; label: string; icon: typeof Sun }> = [
  { key: "system", label: "System", icon: Monitor },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "light", label: "Light", icon: Sun }
];

export function AppHeader({ peoplesquadUrl, themePreference, onThemePreferenceChange }: AppHeaderProps) {
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
          <span className="app-header__brand">PeopleSquad</span>
          <h1 className="app-header__tool">{TOOL_NAME}</h1>
        </div>
      </div>

      <div className="app-header__right">
        <div className="theme-toggle" role="group" aria-label="Theme preference">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.key}
                type="button"
                className={themePreference === option.key ? "theme-toggle__btn theme-toggle__btn--active" : "theme-toggle__btn"}
                aria-label={`Switch to ${option.label} theme`}
                onClick={() => onThemePreferenceChange(option.key)}
              >
                <Icon size={14} aria-hidden />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        <a href={peoplesquadUrl} target="_blank" rel="noreferrer" className="app-header__cta">
          <span>{TAGLINE}</span>
          <ExternalLink size={16} aria-hidden />
        </a>
      </div>
    </header>
  );
}

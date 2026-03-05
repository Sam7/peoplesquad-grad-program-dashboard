import { useEffect, useMemo, useState } from "react";

export type ThemePreference = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "ps_theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === "dark" || value === "light" || value === "system") {
    return value;
  }
  return "system";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

export interface ThemeApi {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

export function useTheme(): ThemeApi {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readPreference()));

  useEffect(() => {
    const nextResolved = resolveTheme(preference);
    setResolvedTheme(nextResolved);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = nextResolved;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  }, [preference]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if (preference === "system") {
        setResolvedTheme(media.matches ? "dark" : "light");
        if (typeof document !== "undefined") {
          document.documentElement.dataset.theme = media.matches ? "dark" : "light";
        }
      }
    };

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [preference]);

  const api = useMemo(
    () => ({
      preference,
      resolvedTheme,
      setPreference: setPreferenceState
    }),
    [preference, resolvedTheme]
  );

  return api;
}

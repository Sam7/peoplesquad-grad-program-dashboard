import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";

export type ThemePreference = "dark" | "light";
export type ResolvedTheme = "dark" | "light";

const COOKIE_NAME = "ps_theme";
const COOKIE_DAYS = 365;

function secureCookie(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.protocol === "https:";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readPreference(): ThemePreference | null {
  const value = Cookies.get(COOKIE_NAME);
  if (value === "dark" || value === "light") {
    return value;
  }
  return null;
}

function resolveTheme(preference: ThemePreference | null): ResolvedTheme {
  return preference ?? getSystemTheme();
}

export interface ThemeApi {
  preference: ThemePreference | null;
  resolvedTheme: ResolvedTheme;
  toggleTheme: () => void;
}

export function useTheme(): ThemeApi {
  const [preference, setPreferenceState] = useState<ThemePreference | null>(() => readPreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readPreference()));

  useEffect(() => {
    const nextResolved = resolveTheme(preference);
    setResolvedTheme(nextResolved);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = nextResolved;
    }

    if (preference) {
      Cookies.set(COOKIE_NAME, preference, {
        expires: COOKIE_DAYS,
        sameSite: "Lax",
        secure: secureCookie(),
        path: "/"
      });
      return;
    }

    Cookies.remove(COOKIE_NAME, { path: "/" });
  }, [preference]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if (preference === null) {
        setResolvedTheme(media.matches ? "dark" : "light");
        if (typeof document !== "undefined") {
          document.documentElement.dataset.theme = media.matches ? "dark" : "light";
        }
      }
    };

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [preference]);

  function toggleTheme(): void {
    const current = resolveTheme(preference);
    setPreferenceState(current === "dark" ? "light" : "dark");
  }

  const api = useMemo(
    () => ({
      preference,
      resolvedTheme,
      toggleTheme
    }),
    [preference, resolvedTheme]
  );

  return api;
}

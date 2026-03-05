import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("uses system preference by default", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.preference).toBe("system");
      expect(result.current.resolvedTheme).toBe("dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });

  it("respects stored preference and updates localStorage", async () => {
    window.localStorage.setItem("ps_theme", "light");
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.preference).toBe("light");
      expect(document.documentElement.dataset.theme).toBe("light");
    });

    act(() => {
      result.current.setPreference("dark");
    });

    await waitFor(() => {
      expect(result.current.resolvedTheme).toBe("dark");
      expect(window.localStorage.getItem("ps_theme")).toBe("dark");
    });
  });
});

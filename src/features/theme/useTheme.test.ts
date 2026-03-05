import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    document.cookie = "ps_theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("uses system preference by default without writing an explicit cookie", async () => {
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
      expect(result.current.preference).toBeNull();
      expect(result.current.resolvedTheme).toBe("dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
    });

    expect(document.cookie).not.toContain("ps_theme=");
  });

  it("respects stored preference and toggles to the opposite theme in cookie", async () => {
    document.cookie = "ps_theme=light; path=/";
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
      result.current.toggleTheme();
    });

    await waitFor(() => {
      expect(result.current.resolvedTheme).toBe("dark");
      expect(document.cookie).toContain("ps_theme=dark");
    });
  });

  it("first toggle from system mode stores explicit opposite of current system theme", async () => {
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
      expect(result.current.preference).toBeNull();
      expect(result.current.resolvedTheme).toBe("dark");
    });

    act(() => {
      result.current.toggleTheme();
    });

    await waitFor(() => {
      expect(result.current.preference).toBe("light");
      expect(result.current.resolvedTheme).toBe("light");
      expect(document.cookie).toContain("ps_theme=light");
    });
  });
});

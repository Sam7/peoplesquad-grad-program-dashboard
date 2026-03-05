import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressControl } from "./ProgressControl";

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches,
      media: "(hover: hover)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
}

describe("ProgressControl", () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not render a separate clear button when expanded", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();

    render(<ProgressControl companyName="Coles Group" state="saved" onStateChange={onStateChange} />);

    await user.click(screen.getByRole("button", { name: /progress for coles group/i }));

    expect(screen.getByRole("button", { name: /move coles group to rejected/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear progress for coles group/i })).not.toBeInTheDocument();
  });

  it("clears state when pressing the center button again on touch devices", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();

    render(<ProgressControl companyName="Coles Group" state="saved" onStateChange={onStateChange} />);

    const center = screen.getByRole("button", { name: /progress for coles group/i });
    await user.click(center);
    expect(onStateChange).not.toHaveBeenCalled();

    await user.click(center);
    expect(onStateChange).toHaveBeenCalledWith("none");
  });

  it("shows vertical top/bottom side actions when expanded", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();

    render(<ProgressControl companyName="Coles Group" state="saved" onStateChange={onStateChange} />);
    await user.click(screen.getByRole("button", { name: /progress for coles group/i }));

    expect(screen.getByRole("button", { name: /move coles group to applied/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move coles group to rejected/i })).toBeInTheDocument();
    expect(document.querySelector(".progress-control__side--top")).toBeInTheDocument();
    expect(document.querySelector(".progress-control__side--bottom")).toBeInTheDocument();
  });
});

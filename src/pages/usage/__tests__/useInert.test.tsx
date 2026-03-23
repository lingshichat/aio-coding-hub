import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAutoFocus, useInert } from "../useInert";

describe("pages/usage/useInert", () => {
  it("sets inert when enabled and removes it on cleanup", () => {
    const ref = { current: document.createElement("div") };

    const { unmount } = renderHook(() => useInert(ref, true));

    expect(ref.current).toHaveAttribute("inert", "");

    unmount();

    expect(ref.current).not.toHaveAttribute("inert");
  });

  it("removes inert when disabled and tolerates a missing element", () => {
    const ref = { current: document.createElement("div") };
    ref.current.setAttribute("inert", "");

    renderHook(() => useInert(ref, false));

    expect(ref.current).not.toHaveAttribute("inert");

    const emptyRef = { current: null };
    expect(() => renderHook(() => useInert(emptyRef, true))).not.toThrow();
  });
});

describe("pages/usage/useAutoFocus", () => {
  it("focuses only when enabled", () => {
    const enabledRef = createRef<HTMLButtonElement>();
    enabledRef.current = document.createElement("button");
    const enabledFocusSpy = vi.spyOn(enabledRef.current, "focus");

    renderHook(() => useAutoFocus(enabledRef, true));

    expect(enabledFocusSpy).toHaveBeenCalledTimes(1);

    const disabledRef = createRef<HTMLButtonElement>();
    disabledRef.current = document.createElement("button");
    const disabledFocusSpy = vi.spyOn(disabledRef.current, "focus");

    renderHook(() => useAutoFocus(disabledRef, false));

    expect(disabledFocusSpy).not.toHaveBeenCalled();
  });
});

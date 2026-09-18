import { beforeEach, describe, expect, mock, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

import { mockModulePreservingReal } from "../helpers/module-mock";
import { render, ensureDom } from "../helpers/render";

import { truncatePreviewText, useHoverTtsPreview } from "@/hooks/use-hover-tts-preview";
import { useCoalescenceMode } from "@/hooks/use-coalescence-mode";
import { CoalescenceGate } from "@/app/sandbox/prototypes/spatial-archetypes/_components/CoalescenceGate";
import * as ttsContext from "@/lib/context/tts-context";
import * as userSettings from "@/lib/user-settings";

ensureDom();

const mockGetSettings = mock(() => ({ coalescenceMode: false }));

// Merged over the real modules so the stubs keep `setSettings` and `useTTSContext` for files
// loaded after this one. Deliberately not restored: these modules are stubbed by several files
// that rely on last-writer-wins.
mockModulePreservingReal("@/lib/user-settings", userSettings, {
  getSettings: mockGetSettings,
} as never);

const mockSpeak = mock(() => undefined);
const mockStop = mock(() => undefined);

mockModulePreservingReal("@/lib/context/tts-context", ttsContext, {
  useTTSOptional: () => ({
    speak: mockSpeak,
    stop: mockStop,
  }),
} as never);

describe("truncatePreviewText", () => {
  test("returns trimmed text when under word limit", () => {
    expect(truncatePreviewText("  hello world  ")).toBe("hello world");
  });

  test("truncates long text with ellipsis", () => {
    const words = Array.from({ length: 100 }, (_, i) => `w${i}`).join(" ");
    const result = truncatePreviewText(words, 10);

    expect(result.endsWith("…")).toBe(true);
    expect(result.split(/\s+/).length).toBe(10);
  });
});

describe("useCoalescenceMode", () => {
  beforeEach(() => {
    mockGetSettings.mockClear();
    mockGetSettings.mockReturnValue({ coalescenceMode: false });
  });

  test("reads initial value from settings", () => {
    mockGetSettings.mockReturnValue({ coalescenceMode: true });

    const { result } = renderHook(() => useCoalescenceMode());

    expect(result.current).toBe(true);
  });

  test("updates when organic-llm-settings event fires", async () => {
    mockGetSettings.mockReturnValue({ coalescenceMode: false });

    const { result } = renderHook(() => useCoalescenceMode());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    act(() => {
      mockGetSettings.mockReturnValue({ coalescenceMode: true });
      window.dispatchEvent(new Event("organic-llm-settings"));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});

describe("useHoverTtsPreview", () => {
  beforeEach(() => {
    mockSpeak.mockClear();
    mockStop.mockClear();
  });

  test("speaks truncated text after hover delay", async () => {
    const { result } = renderHook(() => useHoverTtsPreview("artifact-1"));

    act(() => {
      result.current.onPointerEnter("one two three four five");
    });

    await new Promise((r) => setTimeout(r, 450));

    expect(mockStop).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledWith("one two three four five");
  });

  test("toggle tap starts and stops preview", () => {
    const { result } = renderHook(() => useHoverTtsPreview("artifact-2"));

    act(() => {
      result.current.onTap("preview text");
    });

    expect(mockSpeak).toHaveBeenCalledWith("preview text");

    act(() => {
      result.current.onTap("preview text");
    });

    expect(mockStop).toHaveBeenCalled();
  });

  test("onPointerLeave stops active preview", async () => {
    const { result } = renderHook(() => useHoverTtsPreview("artifact-3"));

    act(() => {
      result.current.onTap("hover text");
    });

    act(() => {
      result.current.onPointerLeave();
    });

    expect(mockStop).toHaveBeenCalled();
  });
});

describe("CoalescenceGate", () => {
  test("renders settings link and explanation", () => {
    const { getByRole, getByText } = render(<CoalescenceGate />);

    expect(getByText("Coalescence Mode required")).toBeTruthy();
    expect(getByRole("link", { name: "Open Settings" }).getAttribute("href")).toBe("/settings");
  });
});

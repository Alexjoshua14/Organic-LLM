import type { MutableRefObject } from "react";
import type { ShellLayoutInfo } from "./useMorphPhysics";

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { regular_spring_config } from "../constants";

import { useMorphPhysics } from "./useMorphPhysics";

describe("useMorphPhysics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reset applies translate and box size to the attached element", () => {
    const { result } = renderHook(() => useMorphPhysics({ config: regular_spring_config }));
    const div = document.createElement("div");

    document.body.appendChild(div);

    act(() => {
      (result.current.elementRef as MutableRefObject<HTMLDivElement | null>).current = div;
      result.current.reset({ x: 5, y: -3, w: 200, h: 44 });
    });

    expect(div.style.transform).toBe("translate(5px, -3px)");
    expect(div.style.width).toBe("200px");
    expect(div.style.height).toBe("44px");
  });

  it("morphTo advances position toward target after one simulated frame", () => {
    const rafQueue: FrameRequestCallback[] = [];
    let time = 1_000;

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        rafQueue.push(cb);

        return rafQueue.length;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", {
      now: () => time,
    } as Performance);

    const { result } = renderHook(() => useMorphPhysics({ config: regular_spring_config }));
    const div = document.createElement("div");

    document.body.appendChild(div);

    act(() => {
      (result.current.elementRef as MutableRefObject<HTMLDivElement | null>).current = div;
      result.current.reset({ x: 0, y: 0, w: 100, h: 80 });
    });

    act(() => {
      result.current.morphTo({ x: 40, y: 0, w: 100, h: 80 });
    });

    const initialX = (result.current.elementRef as MutableRefObject<HTMLDivElement | null>).current!
      .style.transform;

    act(() => {
      time += 16;
      const cb = rafQueue[rafQueue.length - 1];

      if (cb) cb(time);
    });

    const after = (result.current.elementRef as MutableRefObject<HTMLDivElement | null>).current!
      .style.transform;

    expect(initialX).toBe("translate(0px, 0px)");
    expect(after).not.toBe(initialX);
    expect(after).toMatch(/translate\([0-9.-]+px, 0px\)/);
  });

  it("morphTo invokes onShellLayout synchronously before rAF when shell is wider than target", () => {
    const rafQueue: FrameRequestCallback[] = [];

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        rafQueue.push(cb);

        return rafQueue.length;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const calls: ShellLayoutInfo[] = [];
    const onShellLayout = (info: ShellLayoutInfo) => {
      calls.push(info);
    };

    const { result } = renderHook(() =>
      useMorphPhysics({
        config: regular_spring_config,
        onShellLayout,
      })
    );
    const div = document.createElement("div");

    document.body.appendChild(div);

    act(() => {
      (result.current.elementRef as MutableRefObject<HTMLDivElement | null>).current = div;
      result.current.reset({ x: 0, y: 0, w: 200, h: 80 });
    });

    const afterResetCount = calls.length;

    act(() => {
      result.current.morphTo({ x: 0, y: 0, w: 100, h: 80 });
    });

    expect(calls.length).toBeGreaterThan(afterResetCount);
    const syncCall = calls[calls.length - 1];

    expect(syncCall.current.w).toBe(200);
    expect(syncCall.target.w).toBe(100);
    expect(syncCall.relaxation.width).toBe(true);
    expect(rafQueue.length).toBeGreaterThan(0);
  });
});

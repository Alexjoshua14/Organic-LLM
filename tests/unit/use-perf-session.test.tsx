import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { StrictMode, useEffect } from "react";

import { render } from "../helpers/render";

import { usePerfSession } from "@/hooks/use-perf-session";
import { isPerfEnabled, setPerfEnabled, setPerfSessionAllowed } from "@/lib/perf/enabled";
import {
  addServerPhases,
  clearPerfTraces,
  completeForJourney,
  getPerfSnapshot,
  mark,
  markAt,
  startJourney,
} from "@/lib/perf/trace-store";

type AuthState = { isLoaded: boolean; isSignedIn: boolean | undefined };
const signedIn: AuthState = { isLoaded: true, isSignedIn: true };
const signedOut: AuthState = { isLoaded: true, isSignedIn: false };
const pending: AuthState = { isLoaded: false, isSignedIn: undefined };
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
const originalRaf = globalThis.requestAnimationFrame;
const originalCancelRaf = globalThis.cancelAnimationFrame;
const originalObserver = globalThis.PerformanceObserver;
const observers: Array<{ disconnected: boolean; emit: () => void }> = [];

function ComposerReady() {
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      completeForJourney("load", "home:composer-ready");
    });

    return () => cancelAnimationFrame(id);
  }, []);

  return null;
}

function SessionProbe(props: AuthState) {
  const enabled = usePerfSession({ ...props, pathname: window.location.pathname });

  return enabled ? <span>Perf enabled</span> : null;
}

function App(props: AuthState) {
  return (
    <>
      {props.isLoaded && props.isSignedIn ? <ComposerReady /> : null}
      <SessionProbe {...props} />
    </>
  );
}

function paintComposer() {
  act(() => {
    const pendingFrames = [...frames.values()];

    frames.clear();
    for (const callback of pendingFrames) callback(performance.now());
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/?perf=1");
  sessionStorage.clear();
  setPerfSessionAllowed(false);
  clearPerfTraces();
  frames.clear();
  observers.length = 0;
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);

    return frameId;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  globalThis.PerformanceObserver = class {
    disconnected = false;
    emit: () => void;

    constructor(callback: PerformanceObserverCallback) {
      this.emit = () =>
        callback(
          { getEntries: () => [{ startTime: 12 }] } as PerformanceObserverEntryList,
          this as unknown as PerformanceObserver
        );
      observers.push(this);
    }

    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  } as unknown as typeof PerformanceObserver;
});

afterEach(() => {
  cleanup();
  setPerfSessionAllowed(false);
  clearPerfTraces();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancelRaf;
  globalThis.PerformanceObserver = originalObserver;
});

describe("signed-in perf collection", () => {
  test("a sticky flag cannot enable any collector entry point before auth", () => {
    setPerfEnabled(true);
    startJourney("load", "before-auth");
    mark("home:shell-mounted");
    markAt("nav:fcp", 10);
    addServerPhases([{ name: "loadChat", ms: 5 }]);
    completeForJourney("load", "home:composer-ready");

    expect(isPerfEnabled()).toBe(false);
    expect(getPerfSnapshot()).toEqual({ active: null, traces: [] });
  });

  test("signed-out visits with the URL and sticky flag create no trace, observer, or HUD", () => {
    setPerfEnabled(true);
    const { queryByText } = render(<App {...signedOut} />);

    startJourney("to-arcadia", "signed-out-link");
    expect(queryByText("Perf enabled")).toBeNull();
    expect(getPerfSnapshot()).toEqual({ active: null, traces: [] });
    expect(observers).toHaveLength(0);
  });

  test("signed-in home load starts before the earlier sibling composer completes", () => {
    const { getByText } = render(<App {...signedIn} />);

    expect(getByText("Perf enabled")).toBeTruthy();
    expect(getPerfSnapshot().active?.startedAt).toBe(0);
    paintComposer();
    expect(getPerfSnapshot().active).toBeNull();
    expect(getPerfSnapshot().traces).toHaveLength(1);
    expect(getPerfSnapshot().traces[0]?.headlinePhase).toBe("home:composer-ready");
  });

  test("late auth resolution still measures an initially signed-in home load", () => {
    const { rerender } = render(<App {...pending} />);

    expect(isPerfEnabled()).toBe(false);
    expect(observers).toHaveLength(0);
    rerender(<App {...signedIn} />);
    paintComposer();
    expect(getPerfSnapshot().traces[0]?.status).toBe("complete");
  });

  test("signing in after a signed-out visit enables navigation without retroactive load timing", () => {
    const { rerender, getByText } = render(<App {...signedOut} />);

    rerender(<App {...signedIn} />);
    paintComposer();
    expect(getByText("Perf enabled")).toBeTruthy();
    expect(getPerfSnapshot()).toEqual({ active: null, traces: [] });
    expect(observers).toHaveLength(0);
    act(() => startJourney("to-chat", "lets-chat"));
    expect(getPerfSnapshot().active?.journey).toBe("to-chat");
  });

  test("sign-out drops the active trace and blocks queued observer callbacks after sign-in", () => {
    const { rerender, queryByText } = render(<App {...signedIn} />);
    const observer = observers[0]!;

    rerender(<App {...signedOut} />);
    expect(observer.disconnected).toBe(true);
    expect(queryByText("Perf enabled")).toBeNull();
    expect(sessionStorage.getItem("ol:perf")).toBe("1");
    mark("signed-out-mark");
    expect(getPerfSnapshot()).toEqual({ active: null, traces: [] });

    rerender(<App {...signedIn} />);
    paintComposer();
    expect(getPerfSnapshot().traces).toHaveLength(0);
    act(() => {
      startJourney("to-chat", "after-sign-in");
      observer.emit();
    });
    expect(getPerfSnapshot().active?.marks).toHaveLength(0);
  });

  test("Strict Mode effect replay leaves one completed home load and cleans up observers", () => {
    const { unmount } = render(
      <StrictMode>
        <App {...signedIn} />
      </StrictMode>
    );

    paintComposer();
    expect(getPerfSnapshot().traces).toHaveLength(1);
    expect(getPerfSnapshot().traces[0]?.status).toBe("complete");
    unmount();
    expect(isPerfEnabled()).toBe(false);
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });

  test("direct loads outside home enable collection without starting a home load trace", () => {
    window.history.replaceState(null, "", "/chat/example?perf=1");
    render(<App {...signedIn} />);
    paintComposer();
    expect(isPerfEnabled()).toBe(true);
    expect(getPerfSnapshot()).toEqual({ active: null, traces: [] });
    expect(observers).toHaveLength(0);
  });

  test("signed-in users still need the perf flag, and perf=0 overrides a sticky flag", () => {
    window.history.replaceState(null, "", "/?perf=0");
    setPerfEnabled(true);
    render(<App {...signedIn} />);
    paintComposer();
    expect(isPerfEnabled()).toBe(false);
    expect(getPerfSnapshot()).toEqual({ active: null, traces: [] });
    expect(observers).toHaveLength(0);
  });
});

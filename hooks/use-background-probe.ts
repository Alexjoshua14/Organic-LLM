"use client";

import { useEffect, useRef, useState } from "react";

import {
  BACKGROUND_ACTIVITY_CHECK_MS,
  DEFAULT_BACKGROUND_ACTIVITY_MODE,
  isLowPower,
  isProbeDue,
  resolveProbePause,
  type BackgroundActivityMode,
} from "@/lib/background-activity";
import { getSettings, USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";

const PROBE_STORAGE_PREFIX = "organic-llm:background-probe:";
const INPUT_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

type BatteryLike = { charging: boolean; level: number };

function readLastProbeAt(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(`${PROBE_STORAGE_PREFIX}${key}`);
    const value = raw ? Number(raw) : Number.NaN;

    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastProbeAt(key: string, at: number): void {
  try {
    window.localStorage.setItem(`${PROBE_STORAGE_PREFIX}${key}`, String(at));
  } catch {
    /* private mode — this tab still keeps its own cadence via the in-flight guard */
  }
}

/** The user's Background activity setting, live across tabs. */
export function useBackgroundActivityMode(): BackgroundActivityMode {
  const [mode, setMode] = useState<BackgroundActivityMode>(DEFAULT_BACKGROUND_ACTIVITY_MODE);

  useEffect(() => {
    const read = () => setMode(getSettings().backgroundActivity);
    const onStorage = (event: StorageEvent) => {
      if (event.key === USER_SETTINGS_STORAGE_KEY) read();
    };

    read();
    window.addEventListener("organic-llm-settings", read);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("organic-llm-settings", read);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return mode;
}

/**
 * Run `probe` on the user's Background activity cadence while this view is mounted. Pauses for
 * hidden tabs or locked screens, idle clients, and low power (Battery API / Save-Data, where the
 * browser exposes them). The last run time is shared through localStorage, so several tabs on
 * one thread probe once per interval rather than once each.
 */
export function useBackgroundProbe(args: {
  key: string;
  enabled: boolean;
  probe: () => Promise<void>;
}): void {
  const { key, enabled } = args;
  const mode = useBackgroundActivityMode();
  const probeRef = useRef(args.probe);
  const modeRef = useRef(mode);
  const lastInputAtRef = useRef(0);
  const batteryRef = useRef<BatteryLike | null>(null);
  const inFlightRef = useRef(false);
  const lastProbeRef = useRef<{ key: string; at: number } | null>(null);

  probeRef.current = args.probe;
  modeRef.current = mode;

  useEffect(() => {
    lastInputAtRef.current = Date.now();
    const onInput = () => {
      lastInputAtRef.current = Date.now();
    };

    for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, { passive: true });

    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };

    void nav
      .getBattery?.()
      .then((battery) => {
        batteryRef.current = battery;
      })
      .catch(() => undefined);

    return () => {
      for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (inFlightRef.current) return;

      const now = Date.now();
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection;
      const paused = resolveProbePause(modeRef.current, {
        hidden: document.visibilityState !== "visible",
        idleForMs: now - lastInputAtRef.current,
        lowPower: isLowPower({ battery: batteryRef.current, saveData: connection?.saveData }),
      });

      if (paused) return;
      if (!isProbeDue({ mode: modeRef.current, lastProbeAt: Math.max(readLastProbeAt(key) ?? 0, lastProbeRef.current?.key === key ? lastProbeRef.current.at : 0) || null, now })) return;

      inFlightRef.current = true;
      lastProbeRef.current = { key, at: now };
      writeLastProbeAt(key, now);
      void probeRef
        .current()
        .catch(() => undefined)
        .finally(() => {
          inFlightRef.current = false;
        });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    tick();
    const id = window.setInterval(tick, BACKGROUND_ACTIVITY_CHECK_MS);

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, key]);
}

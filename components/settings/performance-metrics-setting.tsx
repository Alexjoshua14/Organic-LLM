"use client";

import Link from "next/link";

import { SettingsRow } from "./SettingsRow";

import { usePerfConsent } from "@/components/perf/use-perf-consent";
import { Switch } from "@/components/design-system/switch";
import { PERF_CODE_LINKS, PERF_PRIVACY_ANCHOR } from "@/lib/perf/disclosure-links";
import { setPerfConsent } from "@/lib/perf/consent";

const link = "text-foreground underline decoration-foreground/40 hover:decoration-foreground";

/**
 * Settings → Privacy: share anonymous speed measurements. The choice is stored on the account
 * (not the device) and enforced by the server, so it holds on every device. Turning it off stops
 * new collection immediately. It does not delete past numbers: they carry nothing that says whose
 * they were, so there is nothing to find and remove. They are pruned after 90 days.
 */
export function PerformanceMetricsSetting() {
  const state = usePerfConsent();
  const unavailable = state === "unavailable";
  const pending = state === "loading";

  return (
    <SettingsRow
      mainText={
        unavailable
          ? "Not available right now, so nothing is being collected."
          : state === "on"
            ? "Sharing anonymous timings."
            : "Not sharing timings."
      }
      subtext={
        <>
          Lets me see how long things take (opening a chat, loading a page) so I can make Organic
          faster. Each number is a duration plus the kind of page and your device type, with no
          account, chat, message or link attached. Turning this off stops collection from now on;
          numbers already collected can&apos;t be traced to you, so they stay as anonymous totals
          and are removed after 90 days.{" "}
          <Link className={link} href={PERF_PRIVACY_ANCHOR}>
            See exactly what&apos;s recorded
          </Link>{" "}
          ·{" "}
          <a className={link} href={PERF_CODE_LINKS[0].href} rel="noreferrer" target="_blank">
            read the code
          </a>
        </>
      }
      title="Anonymous performance metrics"
    >
      <Switch
        aria-label="Share anonymous performance metrics"
        isDisabled={pending || unavailable}
        isSelected={state === "on"}
        onValueChange={(enabled) => void setPerfConsent(enabled)}
      />
    </SettingsRow>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { QuickSettingRow } from "./quick-setting-row";
import { SettingsRow } from "./SettingsRow";

import { Switch } from "@/components/design-system/switch";
import { getSettings, setSettings, USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";
import { persistUserSettingsToSupabase } from "@/data/supabase/user-settings";

const CAPTION = "Use simpler agent animations to reduce rendering work.";

export function LightweightModeSetting({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const { userId } = useAuth();

  useEffect(() => {
    const sync = () => setEnabled(getSettings().lightweightMode);
    const storage = (event: StorageEvent) => {
      if (event.key === USER_SETTINGS_STORAGE_KEY || event.key === null) sync();
    };

    sync();
    window.addEventListener("organic-llm-settings", sync);
    window.addEventListener("storage", storage);

    return () => {
      window.removeEventListener("organic-llm-settings", sync);
      window.removeEventListener("storage", storage);
    };
  }, []);

  const toggle = (
    <Switch
      aria-label="Lightweight Mode"
      isSelected={enabled}
      onValueChange={(value) => {
        setEnabled(value);
        setSettings({ lightweightMode: value });
        if (userId) void persistUserSettingsToSupabase(userId, getSettings());
      }}
    />
  );

  return compact ? (
    <QuickSettingRow caption={CAPTION} label="Lightweight Mode">
      {toggle}
    </QuickSettingRow>
  ) : (
    <SettingsRow
      mainText={
        enabled
          ? "Simpler activity animations are on."
          : "Activity animations adapt to this device."
      }
      subtext={CAPTION}
      title="Lightweight Mode"
    >
      {toggle}
    </SettingsRow>
  );
}

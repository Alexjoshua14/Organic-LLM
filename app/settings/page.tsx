"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Switch } from "@heroui/switch";
import { X } from "lucide-react";

import Page from "@/components/layout/page";
import { ReturnButton } from "@/components/ReturnButton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/third-party/ui/tabs";
import { getProfile } from "@/data/supabase/profiles";
import { Profile } from "@/lib/schemas/profiles";
import { SETTINGS_PAGE_TITLE } from "@/config/settings-page";
import MemorySettings from "@/components/settings/memorySettings";
import FontSetting from "@/components/settings/FontSetting";
import { ProfileView } from "@/components/settings/profile";
import { AccountDeletion } from "@/components/settings/AccountDeletion";
import { DangerZone } from "@/components/settings/DangerZone";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { ThemeSwitch } from "@/components/shared/theme-switch";
import { getSettings, setSettings } from "@/lib/user-settings";

const showDevSettings = process.env.NEXT_PUBLIC_SHOW_DEV_SETTINGS === "true";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ttsWholeMessage, setTtsWholeMessage] = useState(true);
  const [zeroDataRetention, setZeroDataRetention] = useState(false);
  const { userId } = useAuth();
  const { user } = useUser();
  const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? null;

  const [profileHintDismissed, setProfileHintDismissed] = useState(true); // default hidden to avoid flash
  useEffect(() => {
    setProfileHintDismissed(localStorage.getItem("profile-hint-dismissed") === "1");
  }, []);
  const dismissProfileHint = useCallback(() => {
    setProfileHintDismissed(true);
    localStorage.setItem("profile-hint-dismissed", "1");
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTtsWholeMessage(getSettings().ttsWholeMessage);
      setZeroDataRetention(getSettings().zeroDataRetention);
    }
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;
      const supabaseProfile = await getProfile(userId);
      if (
        !supabaseProfile ||
        supabaseProfile.error ||
        supabaseProfile.data === null
      )
        return;
      setProfile(supabaseProfile.data);
    };
    fetchUserProfile();
  }, [userId]);

  return (
    <Page>
      <div className="flex w-full items-center justify-between border-b border-border pl-20 pr-4 py-3 md:pl-8 md:pr-8">
        <ReturnButton />
        <h1 className="text-lg font-semibold text-foreground">{SETTINGS_PAGE_TITLE}</h1>
        <div className="w-20" aria-hidden />
      </div>
      <div className="flex-1 w-full overflow-auto px-4 py-6 md:px-8">
        <Tabs defaultValue="profile" className="w-full max-w-2xl mx-auto">
          <TabsList className={`grid w-full mb-6 select-none ${showDevSettings ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            {showDevSettings && <TabsTrigger value="advanced">Advanced</TabsTrigger>}
          </TabsList>

          <TabsContent value="profile" className="mt-0">
            <div className="space-y-6">
              {!profileHintDismissed && (
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-[11px] leading-snug text-muted-foreground shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="flex-1">
                    Your profile uses your account info plus an about me that can be AI-generated or written by you, cached locally.
                  </span>
                  <button
                    type="button"
                    onClick={dismissProfileHint}
                    className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
              <Suspense fallback={<div className="animate-pulse h-48 rounded-xl bg-muted" />}>
                <ProfileView profile={profile} email={clerkEmail} displayName={profile?.display_name ?? null} />
              </Suspense>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="mt-0">
            <div className="flex flex-col gap-8">
              <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
              <section className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">Theme</h3>
                  <div className="flex items-center gap-3">
                    <ThemeSwitch />
                    <span className="text-sm text-muted-foreground">System / Light / Dark</span>
                  </div>
                </div>
                <FontSetting />
              </section>
            </div>
          </TabsContent>

          <TabsContent value="memory" className="mt-0">
            <MemorySettings />
          </TabsContent>

          <TabsContent value="privacy" className="mt-0">
            <div className="flex flex-col gap-8">
              <h2 className="text-xl font-semibold text-foreground">Privacy</h2>
              <section className="space-y-6">
                <SettingsRow
                  title="Zero Data Retention"
                  mainText={
                    zeroDataRetention
                      ? "External LLMs do not retain your prompts, outputs, or data."
                      : "External LLMs may retain your prompts, outputs, or data."
                  }
                  subtext="When on, external LLMs do not retain prompts, outputs, or other sensitive data. Your data is deleted immediately and permanently after each request. No action is needed on your side. With Organic LLM, use Memory off and delete threads to ensure no data is retained."
                >
                  <Switch
                    isSelected={zeroDataRetention}
                    onValueChange={(zdr) => {
                      setZeroDataRetention(zdr);
                      setSettings({ zeroDataRetention: zdr });
                    }}
                    aria-label="Zero Data Retention"
                  />
                </SettingsRow>
                <DangerZone>
                  <AccountDeletion />
                </DangerZone>
              </section>
            </div>
          </TabsContent>

          {showDevSettings && (
            <TabsContent value="advanced" className="mt-0">
              <div className="flex flex-col gap-8">
                <h2 className="text-xl font-semibold text-foreground">Advanced</h2>
                <section className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-foreground">TTS (developer)</h3>
                    <div className="flex items-center gap-3">
                      <Switch
                        isSelected={ttsWholeMessage}
                        onValueChange={(whole) => {
                          setTtsWholeMessage(whole);
                          setSettings({ ttsWholeMessage: whole });
                        }}
                        aria-label="TTS: whole message or first section only"
                      />
                      <span className="text-sm text-muted-foreground">
                        Play whole message when clicking TTS (off = first section only)
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Page>
  );
}

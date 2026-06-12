"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Switch } from "@heroui/switch";
import { X } from "lucide-react";

import Page from "@/components/layout/page";
import { PageTopBar } from "@/components/layout/page-top-bar";
import { ReturnButton } from "@/components/ReturnButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { getProfile } from "@/data/supabase/profiles";
import { Profile } from "@/lib/schemas/profiles";
import { SETTINGS_PAGE_TITLE } from "@/config/settings-page";
import { caption } from "@/components/design-system/primitives";
import ChatsSettings from "@/components/settings/chatsSettings";
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
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [ttsWholeMessage, setTtsWholeMessage] = useState(true);
  const [zeroDataRetention, setZeroDataRetention] = useState(false);
  const [coalescenceMode, setCoalescenceMode] = useState(false);
  const [experimentalArcadiaMarkdownPreview, setExperimentalArcadiaMarkdownPreview] =
    useState(false);
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
      setCoalescenceMode(getSettings().coalescenceMode);
      setExperimentalArcadiaMarkdownPreview(getSettings().experimentalArcadiaMarkdownPreview);
    }
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setProfileLoading(false);

        return;
      }

      setProfileLoading(true);
      setProfileError(null);

      try {
        const supabaseProfile = await getProfile(userId);

        if (!supabaseProfile || supabaseProfile.error || supabaseProfile.data === null) {
          throw supabaseProfile?.error ?? new Error("Profile not found");
        }

        setProfile(supabaseProfile.data);
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : "Failed to load profile");
      } finally {
        setProfileLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  return (
    <Page>
      <PageTopBar leading={<ReturnButton />} title={SETTINGS_PAGE_TITLE} />
      <div className="flex-1 w-full overflow-auto px-4 py-6 md:px-8">
        <Tabs className="w-full max-w-2xl mx-auto" defaultValue="profile">
          <TabsList
            className={`grid w-full mb-6 select-none ${showDevSettings ? "grid-cols-6" : "grid-cols-5"}`}
          >
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            {showDevSettings && <TabsTrigger value="advanced">Advanced</TabsTrigger>}
          </TabsList>

          <TabsContent className="mt-0" value="profile">
            <div className="space-y-6">
              {!profileHintDismissed && (
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-[11px] leading-snug text-muted-foreground shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="flex-1">
                    Your profile uses your account info plus an about me that can be AI-generated or
                    written by you, cached locally.
                  </span>
                  <button
                    aria-label="Dismiss"
                    className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                    type="button"
                    onClick={dismissProfileHint}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
              <Suspense fallback={<div className="animate-pulse h-48 rounded-xl bg-muted" />}>
                {profileLoading ? (
                  <div className="animate-pulse h-48 rounded-xl bg-muted" />
                ) : (
                  <>
                    {profileError && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {profileError}
                      </div>
                    )}
                    <ProfileView
                      displayName={profile?.display_name ?? user?.fullName ?? null}
                      email={clerkEmail}
                      profile={profile}
                    />
                  </>
                )}
              </Suspense>
            </div>
          </TabsContent>

          <TabsContent className="mt-0" value="chats">
            <div className="flex flex-col gap-8">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">Chats</h2>
                <p className={caption({ className: "max-w-md" })}>
                  Your chat threads: filter by archive state, open a row for summary and actions.
                </p>
              </div>
              <ChatsSettings />
            </div>
          </TabsContent>

          <TabsContent className="mt-0" value="memory">
            <div className="flex flex-col gap-8">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">Persisted memory</h2>
                <p className={caption({ className: "max-w-md" })} id="memory-lens-description">
                  What Organic LLM has stored and can retrieve across any thread.
                  <br />
                  Semantically searchable so the right context surfaces when you need it.
                </p>
              </div>
              <MemorySettings />
            </div>
          </TabsContent>

          <TabsContent className="mt-0" value="appearance">
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
                <SettingsRow
                  title="Coalescence Mode"
                  mainText={
                    coalescenceMode
                      ? "Sidebar shows threads from Arcadia and other feature chats."
                      : "Sidebar shows only main chat threads."
                  }
                  subtext="When on, your sidebar coalesces threads across chat experiences. Turn off to keep the sidebar focused on main chat only."
                >
                  <Switch
                    aria-label="Coalescence Mode"
                    isSelected={coalescenceMode}
                    onValueChange={(enabled) => {
                      setCoalescenceMode(enabled);
                      setSettings({ coalescenceMode: enabled });
                    }}
                  />
                </SettingsRow>
                <FontSetting />
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Experimental</h3>
                  <SettingsRow
                    title="Arcadia markdown preview"
                    mainText={
                      experimentalArcadiaMarkdownPreview
                        ? "Arcadia chat shows a Preview toggle on the composer."
                        : "Arcadia composer is plain text only."
                    }
                    subtext="Toggle rendered markdown preview while drafting in Arcadia (sandbox). May change or move."
                  >
                    <Switch
                      aria-label="Arcadia markdown preview (experimental)"
                      isSelected={experimentalArcadiaMarkdownPreview}
                      onValueChange={(enabled) => {
                        setExperimentalArcadiaMarkdownPreview(enabled);
                        setSettings({ experimentalArcadiaMarkdownPreview: enabled });
                      }}
                    />
                  </SettingsRow>
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent className="mt-0" value="privacy">
            <div className="flex flex-col gap-8">
              <h2 className="text-xl font-semibold text-foreground">Privacy</h2>
              <p className="text-sm text-muted-foreground">
                <Link
                  className="text-foreground underline decoration-foreground/40 hover:decoration-foreground"
                  href="/privacy-and-security"
                >
                  Read our Privacy & Security page
                </Link>{" "}
                for a full overview of how we handle your data.
              </p>
              <section className="space-y-6">
                <SettingsRow
                  mainText={
                    zeroDataRetention
                      ? "External LLMs do not retain your prompts, outputs, or data."
                      : "External LLMs may retain your prompts, outputs, or data."
                  }
                  subtext="When on, external LLMs do not retain prompts, outputs, or other sensitive data. Your data is deleted immediately and permanently after each request. No action is needed on your side. With Organic LLM, use Memory off and delete threads to ensure no data is retained."
                  title="Zero Data Retention"
                >
                  <Switch
                    aria-label="Zero Data Retention"
                    isSelected={zeroDataRetention}
                    onValueChange={(zdr) => {
                      setZeroDataRetention(zdr);
                      setSettings({ zeroDataRetention: zdr });
                    }}
                  />
                </SettingsRow>
                <DangerZone>
                  <AccountDeletion />
                </DangerZone>
              </section>
            </div>
          </TabsContent>

          {showDevSettings && (
            <TabsContent className="mt-0" value="advanced">
              <div className="flex flex-col gap-8">
                <h2 className="text-xl font-semibold text-foreground">Advanced</h2>
                <section className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-foreground">TTS (developer)</h3>
                    <div className="flex items-center gap-3">
                      <Switch
                        aria-label="TTS: whole message or first section only"
                        isSelected={ttsWholeMessage}
                        onValueChange={(whole) => {
                          setTtsWholeMessage(whole);
                          setSettings({ ttsWholeMessage: whole });
                        }}
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

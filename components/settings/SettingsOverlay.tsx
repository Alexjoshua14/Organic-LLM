"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, ExternalLink, GitBranch, Settings2Icon, LogOut, Sparkles } from "lucide-react";
import { SignedIn, SignOutButton, useAuth, useUser } from "@clerk/nextjs";

import { QuickSettingRow } from "./quick-setting-row";
import { LightweightModeSetting } from "./lightweight-mode-setting";

import { Switch } from "@/components/design-system/switch";
import { glass } from "@/components/design-system/primitives";
import { APP_VERSION_LABEL } from "@/lib/app-version";
import { cn } from "@/lib/utils";
import { KnowledgeModal } from "@/components/knowledge/KnowledgeModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/third-party/ui/sheet";
import { ThemeSwitch } from "@/components/shared/theme-switch";
import { getSettings, setSettings } from "@/lib/user-settings";
import { useOnboardingSnapshot } from "@/hooks/use-onboarding";
import { onboardingActions } from "@/lib/onboarding/onboarding-actions";
import { persistUserSettingsToSupabase } from "@/data/supabase/user-settings";

type SettingsOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
};

export function SettingsOverlay({ open, onOpenChange, trigger }: SettingsOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const onErgonPage = pathname === "/ergon" || pathname.startsWith("/ergon/");
  const { userId } = useAuth();
  const { user } = useUser();
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [coalescenceMode, setCoalescenceMode] = useState<boolean>(
    () => getSettings().coalescenceMode
  );
  const [experimentalContextEffort, setExperimentalContextEffort] = useState(
    () => getSettings().experimentalContextEffort
  );
  const [ergonLiquidChrome, setErgonLiquidChrome] = useState(() => getSettings().ergonLiquidChrome);
  const onboarding = useOnboardingSnapshot();

  const knowledgeDisplayName = useMemo(() => {
    const full = user?.fullName?.trim();
    const fromParts = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

    return full || fromParts || null;
  }, [user]);

  useEffect(() => {
    if (open) {
      const s = getSettings();

      setCoalescenceMode(s.coalescenceMode);
      setExperimentalContextEffort(s.experimentalContextEffort);
      setErgonLiquidChrome(s.ergonLiquidChrome);
    }
  }, [open]);

  return (
    <>
      <KnowledgeModal
        displayName={knowledgeDisplayName}
        open={knowledgeOpen}
        onOpenChange={setKnowledgeOpen}
      />
      <Sheet open={open} onOpenChange={onOpenChange}>
        {trigger}
        <SheetContent
          className={cn(
            glass({ opaque: true, border: "left" }),
            "flex h-dvh max-h-dvh min-h-0 flex-col gap-stack-lg overflow-hidden px-inset-lg py-inset-md pb-[max(var(--spacing-inset-md),env(safe-area-inset-bottom))]"
          )}
          ref={panelRef}
          overlayPriority="chrome"
          side="right"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            panelRef.current?.focus();
          }}
        >
          <SheetHeader className="shrink-0 p-0 pr-inset-lg">
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <Settings2Icon className="size-5 shrink-0" />
              Quick settings
            </SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col gap-stack-sm px-0 pt-inset-sm">
              <QuickSettingRow caption="System / Light / Dark" label="Theme">
                <ThemeSwitch className="text-foreground" />
              </QuickSettingRow>

              <LightweightModeSetting compact />

              {onboarding.status === "ready" ? (
                <QuickSettingRow
                  caption="A short pointer the first time you reach a feature. Read every tip, or replay them, in the Guide (?)."
                  icon={<Sparkles aria-hidden className="size-4 shrink-0 text-lumen" />}
                  label="Feature tips"
                >
                  <Switch
                    aria-label="Feature tips"
                    isSelected={onboarding.state.tipsEnabled}
                    onValueChange={(enabled) => onboardingActions.setTipsEnabled(enabled)}
                  />
                </QuickSettingRow>
              ) : null}

              <QuickSettingRow
                caption="Unlock Organic’s full potential by connecting its features."
                label="Coalescence Mode"
              >
                <Switch
                  aria-label="Coalescence Mode"
                  isSelected={coalescenceMode}
                  onValueChange={(enabled) => {
                    setCoalescenceMode(enabled);
                    setSettings({ coalescenceMode: enabled });
                    if (userId) void persistUserSettingsToSupabase(userId, getSettings());
                  }}
                />
              </QuickSettingRow>

              <QuickSettingRow
                caption="When on, Arcadia shows a slider for how hard Organic LLM works to compile your memories and portrait before answering. Off keeps today's retrieval."
                label="Context effort (beta)"
              >
                <Switch
                  aria-label="Context effort (beta)"
                  isSelected={experimentalContextEffort}
                  onValueChange={(enabled) => {
                    setExperimentalContextEffort(enabled);
                    setSettings({ experimentalContextEffort: enabled });
                    if (userId) void persistUserSettingsToSupabase(userId, getSettings());
                  }}
                />
              </QuickSettingRow>

              {onErgonPage ? (
                <QuickSettingRow
                  caption="Animated liquid chrome behind the task list."
                  label="Ergon background"
                >
                  <Switch
                    aria-label="Ergon liquid chrome background"
                    isSelected={ergonLiquidChrome}
                    onValueChange={(enabled) => {
                      setErgonLiquidChrome(enabled);
                      setSettings({ ergonLiquidChrome: enabled });
                      if (userId) void persistUserSettingsToSupabase(userId, getSettings());
                    }}
                  />
                </QuickSettingRow>
              ) : null}
            </div>

            <div className="mt-stack-lg border-t border-border pt-inset-sm px-0">
              <section className="space-y-2 pb-2">
                <h3 className="text-sm font-medium text-foreground">Knowledge</h3>
                <button
                  aria-label="What Organic LLM knows about you"
                  className="flex min-h-12 w-full items-center gap-2 rounded-lg py-3 text-left text-sm text-muted-foreground organic-focus organic-lumen-interactive hover:text-foreground"
                  title="What Organic LLM knows about you"
                  type="button"
                  onClick={() => setKnowledgeOpen(true)}
                >
                  <Brain className="size-4 shrink-0" />
                  Memory
                </button>
              </section>
              <Link
                className="flex min-h-12 items-center gap-2 rounded-lg py-3 text-sm text-muted-foreground organic-focus organic-lumen-interactive hover:text-foreground"
                href="/settings?tab=connectors"
                onClick={() => onOpenChange(false)}
              >
                <GitBranch className="size-4 shrink-0" />
                Connectors
              </Link>
              <Link
                className="flex min-h-12 items-center gap-2 rounded-lg py-3 text-sm text-muted-foreground organic-focus organic-lumen-interactive hover:text-foreground"
                href="/settings"
                onClick={() => onOpenChange(false)}
              >
                <ExternalLink className="size-4 shrink-0" />
                Open full settings
              </Link>
            </div>
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-inline-sm border-t border-border pt-inset-sm">
            <SignedIn>
              <SignOutButton>
                <button
                  className="organic-focus organic-lumen-interactive flex min-h-11 items-center gap-inline-sm rounded-md px-inset-sm text-sm text-muted-foreground hover:text-foreground"
                  type="button"
                >
                  <LogOut aria-hidden className="size-4" />
                  Sign out
                </button>
              </SignOutButton>
            </SignedIn>
            <Link
              aria-label={`App version ${APP_VERSION_LABEL}. Open release notes.`}
              className="organic-focus organic-lumen-interactive ml-auto flex min-h-11 items-center rounded-md px-inset-sm text-xs text-muted-foreground hover:text-foreground"
              href="/release-notes"
              onClick={() => onOpenChange(false)}
            >
              {APP_VERSION_LABEL}
            </Link>
          </footer>
        </SheetContent>
      </Sheet>
    </>
  );
}

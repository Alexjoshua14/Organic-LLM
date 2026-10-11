"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, ExternalLink, Settings2Icon, Sparkles } from "lucide-react";
import { useAuth, useUser } from "@clerk/nextjs";

import { QuickSettingRow } from "./quick-setting-row";

import { Switch } from "@/components/design-system/switch";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { KnowledgeModal } from "@/components/knowledge/KnowledgeModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/third-party/ui/sheet";
import { ThemeSwitch } from "@/components/shared/theme-switch";
import { getSettings, setSettings } from "@/lib/user-settings";
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
  const [experimentalArcadiaMarkdownPreview, setExperimentalArcadiaMarkdownPreview] = useState(
    () => getSettings().experimentalArcadiaMarkdownPreview
  );
  const [experimentalContextEffort, setExperimentalContextEffort] = useState(
    () => getSettings().experimentalContextEffort
  );
  const [ergonLiquidChrome, setErgonLiquidChrome] = useState(() => getSettings().ergonLiquidChrome);
  const [replayFeatureHints, setReplayFeatureHints] = useState(
    () => getSettings().replayFeatureHints
  );

  const knowledgeDisplayName = useMemo(() => {
    const full = user?.fullName?.trim();
    const fromParts = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

    return full || fromParts || null;
  }, [user]);

  useEffect(() => {
    if (open) {
      const s = getSettings();

      setCoalescenceMode(s.coalescenceMode);
      setExperimentalArcadiaMarkdownPreview(s.experimentalArcadiaMarkdownPreview);
      setExperimentalContextEffort(s.experimentalContextEffort);
      setErgonLiquidChrome(s.ergonLiquidChrome);
      setReplayFeatureHints(s.replayFeatureHints);
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
            "flex flex-col gap-5 overflow-y-auto px-6 py-4 md:gap-6 md:py-7"
          )}
          ref={panelRef}
          overlayPriority="chrome"
          side="right"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            panelRef.current?.focus();
          }}
        >
          <SheetHeader className="pt-0 pb-0 px-0">
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <Settings2Icon className="size-5 shrink-0" />
              Quick settings
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-2 px-0 pt-2">
            <QuickSettingRow caption="System / Light / Dark" label="Theme">
              <ThemeSwitch className="text-foreground" />
            </QuickSettingRow>

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
              caption="Markdown preview toggle on the Arcadia composer."
              label="Arcadia preview (experimental)"
            >
              <Switch
                aria-label="Arcadia markdown preview (experimental)"
                isSelected={experimentalArcadiaMarkdownPreview}
                onValueChange={(enabled) => {
                  setExperimentalArcadiaMarkdownPreview(enabled);
                  setSettings({ experimentalArcadiaMarkdownPreview: enabled });
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

            <QuickSettingRow
              caption="Re-show surface tips you dismissed. Sidebar and composer tips stay dismissed; turn off to return to normal."
              icon={<Sparkles aria-hidden className="size-4 shrink-0 text-lumen" />}
              label="Tips & coachmarks"
            >
              <Switch
                aria-label="Replay feature tips and coachmarks"
                isSelected={replayFeatureHints}
                onValueChange={(enabled) => {
                  setReplayFeatureHints(enabled);
                  setSettings({ replayFeatureHints: enabled });
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

          <div className="mt-auto border-t border-border pt-4 pb-6 px-0 md:pt-8 md:pb-12">
            <section className="space-y-2 pb-2">
              <h3 className="text-sm font-medium text-foreground">Knowledge</h3>
              <button
                aria-label="What Organic LLM knows about you"
                className="flex min-h-12 w-full items-center gap-2 rounded-lg py-3 text-left text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                title="What Organic LLM knows about you"
                type="button"
                onClick={() => setKnowledgeOpen(true)}
              >
                <Brain className="size-4 shrink-0" />
                Memory
              </button>
            </section>
            <Link
              className="flex min-h-12 items-center gap-2 rounded-lg py-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              href="/settings"
              onClick={() => onOpenChange(false)}
            >
              <ExternalLink className="size-4 shrink-0" />
              Open full settings
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

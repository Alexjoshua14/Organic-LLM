"use client";

import type { SharedSelection } from "@heroui/system";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Settings2Icon, ExternalLink } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/third-party/ui/sheet";
import { ThemeSwitch } from "@/components/shared/theme-switch";
import { featuredFonts, getFontById } from "@/config/font-options";
import { getSettings, setSettings } from "@/lib/user-settings";
import { applyFontPreference } from "@/components/FontProvider";
import { persistUserSettingsToSupabase } from "@/data/supabase/user-settings";

function fontFamilyForPreview(fontId: string): string | undefined {
  const font = getFontById(fontId);

  if (!font || font.id === "system") return undefined;
  if (font.id === "satoshi") return "var(--font-satoshi), sans-serif";
  if (font.id === "inter") return "var(--font-inter), sans-serif";
  if (font.id === "commissioner") return "var(--font-commissioner), sans-serif";
  if (font.googleId) return `'${font.googleId}', sans-serif`;
  if (font.id === "geist") return "'Geist', 'Geist Sans', sans-serif";

  return undefined;
}

type SettingsOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
};

export function SettingsOverlay({ open, onOpenChange, trigger }: SettingsOverlayProps) {
  const { userId } = useAuth();
  const [fontId, setFontId] = useState<string>(() => getSettings().fontId);
  const [coalescenceMode, setCoalescenceMode] = useState<boolean>(() => getSettings().coalescenceMode);
  const [experimentalArcadiaMarkdownPreview, setExperimentalArcadiaMarkdownPreview] = useState(
    () => getSettings().experimentalArcadiaMarkdownPreview
  );

  useEffect(() => {
    if (open) {
      const s = getSettings();
      setFontId(s.fontId);
      setCoalescenceMode(s.coalescenceMode);
      setExperimentalArcadiaMarkdownPreview(s.experimentalArcadiaMarkdownPreview);
    }
  }, [open]);

  const handleFontChange = (keys: SharedSelection) => {
    const raw = typeof keys === "string" ? keys : Array.from(keys)[0];
    const id = raw != null ? String(raw) : "";

    if (id) {
      setFontId(id);
      applyFontPreference(id);
      if (userId) void persistUserSettingsToSupabase(userId, getSettings());
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger}
      <SheetContent className="flex flex-col gap-6 px-6 py-6 md:gap-10 md:py-12" side="right">
        <SheetHeader className="pt-0 pb-0 px-0 md:pt-4">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Settings2Icon className="size-5 shrink-0" />
            Quick settings
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-0 pt-4 md:gap-12 md:pt-14">
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Theme</h3>
            <div className="flex items-center gap-3">
              <ThemeSwitch className="text-foreground" />
              <span className="text-xs text-muted-foreground">System / Light / Dark</span>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Coalescence Mode</h3>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                When on, your sidebar includes Arcadia and other feature threads.
              </span>
              <Switch
                aria-label="Coalescence Mode"
                isSelected={coalescenceMode}
                onValueChange={(enabled) => {
                  setCoalescenceMode(enabled);
                  setSettings({ coalescenceMode: enabled });
                  if (userId) void persistUserSettingsToSupabase(userId, getSettings());
                }}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Arcadia preview (experimental)</h3>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Markdown preview toggle on the Arcadia composer.
              </span>
              <Switch
                aria-label="Arcadia markdown preview (experimental)"
                isSelected={experimentalArcadiaMarkdownPreview}
                onValueChange={(enabled) => {
                  setExperimentalArcadiaMarkdownPreview(enabled);
                  setSettings({ experimentalArcadiaMarkdownPreview: enabled });
                  if (userId) void persistUserSettingsToSupabase(userId, getSettings());
                }}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Font</h3>
            <Select
              aria-label="Choose font"
              classNames={{ trigger: "min-h-9" }}
              selectedKeys={[fontId]}
              size="sm"
              variant="bordered"
              onSelectionChange={handleFontChange}
            >
              {featuredFonts.map((font) => (
                <SelectItem
                  key={font.id}
                  style={{ fontFamily: fontFamilyForPreview(font.id) }}
                  textValue={font.label}
                >
                  {font.label}
                </SelectItem>
              ))}
            </Select>
          </section>
        </div>

        <div className="mt-auto border-t border-border pt-4 pb-6 px-0 md:pt-8 md:pb-12">
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
  );
}

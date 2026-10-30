"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@heroui/button";
import { useAuth } from "@clerk/nextjs";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/third-party/ui/command";
import { featuredFonts, allFontOptions, getFontById, type FontOption } from "@/config/font-options";
import { SettingsHelp } from "@/components/settings/settings-help";
import { getSettings } from "@/lib/user-settings";
import { applyFontPreference } from "@/components/FontProvider";
import { persistUserSettingsToSupabase } from "@/data/supabase/user-settings";

function fontFamilyForPreview(font: FontOption | undefined): string | undefined {
  if (!font || font.id === "system") return undefined;
  if (font.id === "satoshi") return "var(--font-satoshi), sans-serif";
  if (font.id === "inter") return "var(--font-inter), sans-serif";
  if (font.id === "commissioner") return "var(--font-commissioner), sans-serif";
  if (font.googleId) return `'${font.googleId}', sans-serif`;
  if (font.id === "geist") return "'Geist', 'Geist Sans', sans-serif";

  return undefined;
}

export default function FontSetting() {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("satoshi");

  useEffect(() => {
    setSelectedId(getSettings().fontId);
  }, [open]);

  const handleSelect = (font: FontOption) => {
    setSelectedId(font.id);
    applyFontPreference(font.id);
    if (userId) void persistUserSettingsToSupabase(userId, getSettings());
    setOpen(false);
  };

  const selectedFont = getFontById(selectedId);

  return (
    <section className="space-y-stack-sm">
      <div className="space-y-stack-sm">
        <h3 className="text-sm font-medium text-foreground">Font</h3>
        <Button
          aria-label={`Choose font, current font: ${selectedFont?.label ?? "Satoshi"}`}
          className="min-h-11 w-full min-w-0 justify-between gap-inline-sm px-inset-md font-medium sm:max-w-xs"
          style={{ fontFamily: fontFamilyForPreview(selectedFont) }}
          variant="bordered"
          onPress={() => setOpen(true)}
        >
          <span className="truncate">{selectedFont?.label ?? "Satoshi"}</span>
          {selectedFont?.tag && (
            <span className="shrink-0 text-xs font-normal text-muted-foreground">
              {selectedFont.tag}
            </span>
          )}
        </Button>
      </div>
      <SettingsHelp title="About fonts">
        <p>Applies across the app. Browse featured fonts or search the full library.</p>
      </SettingsHelp>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch("");
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-inset-lg pt-inset-lg pb-inset-sm">
            <DialogTitle>Choose font</DialogTitle>
          </DialogHeader>
          <Command
            className="rounded-lg border-0 shadow-none"
            shouldFilter={false}
            value={search}
            onValueChange={setSearch}
          >
            <CommandInput className="border-b rounded-none" placeholder="Search fonts..." />
            <CommandList className="max-h-[320px]">
              <FontPickerContent search={search} selectedId={selectedId} onSelect={handleSelect} />
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FontPickerContent({
  search,
  selectedId,
  onSelect,
}: {
  search: string;
  selectedId: string;
  onSelect: (font: FontOption) => void;
}) {
  const filteredAll = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();

    return allFontOptions.filter(
      (f) => f.label.toLowerCase().includes(q) || (f.tag?.toLowerCase().includes(q) ?? false)
    );
  }, [search]);

  const showFeatured = !search.trim();
  const showSearchResults = search.trim().length > 0;

  return (
    <>
      {showFeatured && (
        <CommandGroup heading="Featured &amp; used by leading apps">
          {featuredFonts.map((font) => (
            <CommandItem
              key={font.id}
              className="flex min-h-11 items-center justify-between gap-inline-sm"
              value={font.id}
              onSelect={() => onSelect(font)}
            >
              <span style={{ fontFamily: fontFamilyForPreview(font) }}>{font.label}</span>
              {font.tag && (
                <span className="text-xs text-muted-foreground shrink-0">{font.tag}</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {showSearchResults && (
        <CommandGroup heading={filteredAll.length ? "All fonts" : undefined}>
          {filteredAll.length === 0 ? (
            <CommandEmpty>No font found for &quot;{search}&quot;</CommandEmpty>
          ) : (
            filteredAll.map((font) => (
              <CommandItem
                key={font.id}
                style={{ fontFamily: fontFamilyForPreview(font) }}
                value={font.id}
                onSelect={() => onSelect(font)}
              >
                {font.label}
              </CommandItem>
            ))
          )}
        </CommandGroup>
      )}
    </>
  );
}

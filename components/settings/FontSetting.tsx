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
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Font</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Choose the font used across the app. Featured picks and fonts used by popular apps are
          shown first; search for more.
        </p>
        <div className="flex items-center gap-3">
          <Button
            className="font-medium min-w-[200px] justify-start"
            style={{ fontFamily: fontFamilyForPreview(selectedFont) }}
            variant="bordered"
            onPress={() => setOpen(true)}
          >
            {selectedFont?.label ?? "Satoshi"}
          </Button>
          {selectedFont?.tag && (
            <span className="text-sm text-muted-foreground">{selectedFont.tag}</span>
          )}
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch("");
        }}
      >
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
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
              className="flex items-center justify-between gap-2"
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

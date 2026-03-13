"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { UIMessage } from "ai";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import type { WineEntry } from "@/lib/schemas/wine-line-list";
import { getWinesFromMessage } from "@/lib/schemas/wine-line-list";
import { updateWineListMessage } from "../actions";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import { cn } from "@/lib/utils";

type WineLineListTableProps = {
  message: UIMessage;
  threadId: string;
};

const SORT_OPTIONS = [
  { value: "default", label: "Default order" },
  { value: "red", label: "Reds" },
  { value: "white", label: "Whites" },
  { value: "orange", label: "Oranges" },
] as const;

const ATTRIBUTE_OPTIONS = [
  "macerated",
  "dry",
  "textured",
  "crowd pleaser",
] as const;

function buildMessageWithWines(message: UIMessage, wines: WineEntry[]): UIMessage {
  const parts = message.parts.map((part) => {
    if (part.type === "data-wineLineList") {
      return { type: "data-wineLineList" as const, data: { wines } };
    }
    return part;
  });
  return { ...message, parts };
}

export function WineLineListTable({ message, threadId }: WineLineListTableProps) {
  const initialWines = useMemo(
    () =>
      getWinesFromMessage(
        message.parts as Array<{ type: string; data?: { wines?: WineEntry[] } }>,
      ),
    [message.parts],
  );

  const [wines, setWines] = useState<WineEntry[]>(initialWines);
  const winesRef = useRef<WineEntry[]>(wines);
  winesRef.current = wines;

  const [sortBy, setSortBy] = useState<string>("default");
  const [attributeFilter, setAttributeFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const persist = useCallback(
    async (nextWines: WineEntry[]) => {
      setSaving(true);
      const updated = buildMessageWithWines(message, nextWines);
      const result = await updateWineListMessage(threadId, message.id, updated);
      setSaving(false);
      if (!result.ok) {
        console.error("Failed to save wine list:", result.error);
      }
    },
    [message, threadId],
  );

  const updateRow = useCallback((index: number, field: keyof WineEntry, value: string | string[] | undefined) => {
    setWines((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      next[index] = row;
      winesRef.current = next;
      return next;
    });
  }, []);

  const handleBlur = useCallback(() => {
    persist(winesRef.current);
  }, [persist]);

  const moveRow = useCallback(
    (index: number, direction: "up" | "down") => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= wines.length) return;
      setWines((prev) => {
        const next = [...prev];
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        persist(next);
        return next;
      });
    },
    [wines.length, persist],
  );

  const displayedWines = useMemo(() => {
    let list = [...wines];

    if (attributeFilter !== "all") {
      list = list.filter(
        (w) => w.attributes?.includes(attributeFilter) ?? false,
      );
    }

    if (sortBy !== "default") {
      list = [...list].sort((a, b) => {
        const catA = a.category ?? "";
        const catB = b.category ?? "";
        if (sortBy === "red") return catA === "red" ? (catB === "red" ? 0 : -1) : catB === "red" ? 1 : 0;
        if (sortBy === "white") return catA === "white" ? (catB === "white" ? 0 : -1) : catB === "white" ? 1 : 0;
        if (sortBy === "orange") return catA === "orange" ? (catB === "orange" ? 0 : -1) : catB === "orange" ? 1 : 0;
        return 0;
      });
    }

    return list;
  }, [wines, sortBy, attributeFilter]);

  if (wines.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground overflow-hidden mb-4">
      <div className="flex flex-wrap gap-2 p-2 border-b border-border bg-muted/30">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={attributeFilter} onValueChange={setAttributeFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Filter by attribute" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {ATTRIBUTE_OPTIONS.map((attr) => (
              <SelectItem key={attr} value={attr}>
                {attr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && (
          <span className="text-xs text-muted-foreground self-center">Saving…</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left font-medium p-2 w-8" aria-label="Reorder" />
              <th className="text-left font-medium p-2 min-w-[180px]">Wine</th>
              <th className="text-left font-medium p-2 min-w-[180px]">Style</th>
              <th className="text-left font-medium p-2 min-w-[200px]">Key Food Affinities</th>
            </tr>
          </thead>
          <tbody>
            {displayedWines.map((wine, displayIndex) => {
              const sourceIndex = wines.indexOf(wine);
              return (
                <tr
                  key={wine.id ?? displayIndex}
                  className={cn(
                    "border-b border-border/70 hover:bg-muted/20",
                    attributeFilter !== "all" && sourceIndex >= 0 && "opacity-90",
                  )}
                >
                  <td className="p-1 align-middle">
                    <div className="flex flex-col gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveRow(sourceIndex, "up")}
                        disabled={sourceIndex <= 0}
                        aria-label="Move up"
                      >
                        <ChevronUpIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveRow(sourceIndex, "down")}
                        disabled={sourceIndex >= wines.length - 1}
                        aria-label="Move down"
                      >
                        <ChevronDownIcon className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-2">
                    <Input
                      value={wine.wine}
                      onChange={(e) => updateRow(sourceIndex, "wine", e.target.value)}
                      onBlur={handleBlur}
                      className="h-8 border-0 bg-transparent focus-visible:ring-1 text-foreground"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={wine.style}
                      onChange={(e) => updateRow(sourceIndex, "style", e.target.value)}
                      onBlur={handleBlur}
                      className="h-8 border-0 bg-transparent focus-visible:ring-1 text-foreground"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={wine.keyFoodAffinities}
                      onChange={(e) =>
                        updateRow(sourceIndex, "keyFoodAffinities", e.target.value)
                      }
                      onBlur={handleBlur}
                      className="h-8 border-0 bg-transparent focus-visible:ring-1 text-foreground"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

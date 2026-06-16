/**
 * Settings → Chats: list all threads with archive filter and sorting.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ChatSettingsExpandProvider } from "./chats/chat-settings-expand-context";
import { SettingsChatTitleRow } from "./chats/settings-chat-title-row";

import { caption } from "@/components/design-system/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import {
  getChatsForSettingsForCurrentUser,
  type ChatThreadSettingsRow,
} from "@/data/supabase/chat";
import { getThreadFeatureCaption } from "@/lib/chat/thread-feature-caption";
import { createLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";

const logger = createLogger("components/settings/chatsSettings.tsx");

type ArchiveFilter = "all" | "active" | "archived";

type SortKey = "title" | "created_at" | "updated_at" | "feature";

function threadTitleSortKey(t: ChatThreadSettingsRow): string {
  return t.title != null && t.title.trim() !== "" ? t.title.toLowerCase() : "untitled chat";
}

function sortThreads(rows: ChatThreadSettingsRow[], sortBy: SortKey): ChatThreadSettingsRow[] {
  const copy = [...rows];

  copy.sort((a, b) => {
    switch (sortBy) {
      case "title":
        return threadTitleSortKey(a).localeCompare(threadTitleSortKey(b), undefined, {
          sensitivity: "base",
        });
      case "created_at":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "updated_at":
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      case "feature":
        return getThreadFeatureCaption(a.feature).localeCompare(
          getThreadFeatureCaption(b.feature),
          undefined,
          { sensitivity: "base" }
        );
      default:
        return 0;
    }
  });

  return copy;
}

function filterByArchive(
  rows: ChatThreadSettingsRow[],
  filter: ArchiveFilter
): ChatThreadSettingsRow[] {
  if (filter === "all") return rows;
  if (filter === "archived") return rows.filter((t) => t.archived === true);

  return rows.filter((t) => t.archived !== true);
}

export default function ChatsSettings() {
  const [threads, setThreads] = useState<ChatThreadSettingsRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("updated_at");

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getChatsForSettingsForCurrentUser();

      if (res.error) {
        setLoadError(res.error.message);
        setThreads([]);
      } else {
        setThreads(res.data ?? []);
      }
    } catch (e) {
      logger.error("loadThreads", e instanceof Error ? e.message : "Unknown error");
      setLoadError("Failed to load chats");
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const visibleThreads = useMemo(() => {
    const filtered = filterByArchive(threads, archiveFilter);

    return sortThreads(filtered, sortBy);
  }, [threads, archiveFilter, sortBy]);

  return (
    <ChatSettingsExpandProvider>
      <section aria-label="Chat threads" className="flex flex-col gap-5 w-full">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-2 border-b border-border/15 pb-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="text-[11px] text-muted-foreground/65 whitespace-nowrap"
              id="chats-filter-label"
            >
              Archive
            </span>
            <Select
              value={archiveFilter}
              onValueChange={(v) => setArchiveFilter(v as ArchiveFilter)}
            >
              <SelectTrigger
                aria-labelledby="chats-filter-label"
                className={cn(
                  "h-7 gap-1.5 rounded-md px-2 text-xs shadow-none border-border/25",
                  "bg-muted/15 text-muted-foreground w-full sm:w-[9.25rem]",
                  "hover:bg-muted/25 hover:text-foreground/75"
                )}
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Not archived</SelectItem>
                <SelectItem value="archived">Archived only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="text-[11px] text-muted-foreground/65 whitespace-nowrap"
              id="chats-sort-label"
            >
              Sort by
            </span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger
                aria-labelledby="chats-sort-label"
                className={cn(
                  "h-7 gap-1.5 rounded-md px-2 text-xs shadow-none border-border/25",
                  "bg-muted/15 text-muted-foreground w-full sm:w-[10.5rem]",
                  "hover:bg-muted/25 hover:text-foreground/75"
                )}
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="created_at">Created</SelectItem>
                <SelectItem value="updated_at">Last updated</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="animate-pulse h-40 rounded-2xl bg-muted" />
        ) : visibleThreads.length === 0 ? (
          <p className={caption({})}>No chats match the current filters.</p>
        ) : (
          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {visibleThreads.map((thread) => (
              <li key={thread.id}>
                <SettingsChatTitleRow thread={thread} onThreadUpdated={loadThreads} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </ChatSettingsExpandProvider>
  );
}

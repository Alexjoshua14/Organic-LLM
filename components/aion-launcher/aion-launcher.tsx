"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  Layers,
  MessageSquarePlus,
  Rabbit,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/third-party/ui/command";
import { Dialog, DialogContent } from "@/components/third-party/ui/dialog";
import { createArcadiaThreadAction } from "@/lib/chat/create-arcadia-thread";
import { createChat } from "@/lib/chat/chat-store";
import { routeHomepagePrompt, type RouteHomepagePromptData } from "@/lib/chat/thread-routing";
import {
  appendDraftQueryParam,
  homepageHrefWithOptionalDraft,
  type HomepageRouteCandidate,
} from "@/lib/chat/thread-routing-candidates";
import { createAndOpenStrataPageAction } from "@/app/sandbox/prototypes/strata/actions";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { getSettings } from "@/lib/user-settings";
import { isEditableEventTarget } from "@/lib/dom/is-editable-event-target";
import { createLogger } from "@/lib/logger";

const logger = createLogger("components/aion-launcher/aion-launcher.tsx");

type AionLauncherContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const AionLauncherContext = createContext<AionLauncherContextValue | null>(null);

export function useAionLauncher(): AionLauncherContextValue {
  const ctx = useContext(AionLauncherContext);

  if (!ctx) {
    throw new Error("useAionLauncher must be used within AionLauncherProvider");
  }

  return ctx;
}

function hrefFromRouteResult(data: RouteHomepagePromptData, query: string): string {
  if (data.outcome === "match") {
    const kind = data.metrics.matchedKind;

    if (kind) {
      return homepageHrefWithOptionalDraft(data.href, kind, query);
    }

    return data.href;
  }

  return appendDraftQueryParam(`/chat/${data.chatId}`, query);
}

export function AionLauncherProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<HomepageRouteCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [routing, setRouting] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [creatingArcadia, setCreatingArcadia] = useState(false);
  const [creatingStrata, setCreatingStrata] = useState(false);
  const router = useRouter();
  const { refreshSidebarChats } = useSharedChatContext();

  const toggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key === "k" || e.key === "K";

      if (!isK || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;

      if (!open && isEditableEventTarget(e.target)) return;

      e.preventDefault();
      toggle();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, toggle]);

  useEffect(() => {
    if (!open) return;

    const coalescence = getSettings().coalescenceMode;
    let cancelled = false;

    setCandidatesLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `/api/launcher/candidates?coalescence=${coalescence ? "true" : "false"}`
        );

        if (!res.ok) {
          if (!cancelled) setCandidates([]);

          return;
        }

        const json = (await res.json()) as { data?: HomepageRouteCandidate[] };

        if (!cancelled) setCandidates(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setCandidatesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const navigateAfterRoute = useCallback(
    (data: RouteHomepagePromptData, query: string) => {
      const href = hrefFromRouteResult(data, query);

      refreshSidebarChats();
      setOpen(false);
      router.push(href);
    },
    [refreshSidebarChats, router]
  );

  const runSemanticRoute = useCallback(
    async (query: string) => {
      const trimmed = query.trim();

      if (!trimmed || routing) return;

      try {
        setRouting(true);
        const routeRes = await routeHomepagePrompt({
          prompt: trimmed,
          coalescenceMode: getSettings().coalescenceMode,
        });

        if (routeRes.error || !routeRes.data) {
          logger.error("runSemanticRoute", routeRes.error?.message ?? "no data");

          return;
        }

        navigateAfterRoute(routeRes.data, trimmed);
      } catch (err) {
        logger.error("runSemanticRoute", String(err));
      } finally {
        setRouting(false);
      }
    },
    [navigateAfterRoute, routing]
  );

  const onNewChat = useCallback(async () => {
    if (creatingChat) return;

    try {
      setCreatingChat(true);
      const res = await createChat();

      if (res.error || res.data === null) {
        logger.error("onNewChat", res.error?.message ?? "null id");

        return;
      }

      refreshSidebarChats();
      setOpen(false);
      router.push(`/chat/${res.data}`);
    } catch (e) {
      logger.error("onNewChat", String(e));
    } finally {
      setCreatingChat(false);
    }
  }, [creatingChat, refreshSidebarChats, router]);

  const onNewArcadia = useCallback(async () => {
    if (creatingArcadia) return;

    try {
      setCreatingArcadia(true);
      const res = await createArcadiaThreadAction();

      if (!res.ok) {
        logger.error("onNewArcadia", res.error);

        return;
      }

      refreshSidebarChats();
      setOpen(false);
      router.push(res.path);
    } catch (e) {
      logger.error("onNewArcadia", String(e));
    } finally {
      setCreatingArcadia(false);
    }
  }, [creatingArcadia, refreshSidebarChats, router]);

  const onNewStrata = useCallback(async () => {
    if (creatingStrata) return;

    setCreatingStrata(true);

    try {
      const fd = new FormData();

      await createAndOpenStrataPageAction(fd);
    } finally {
      setCreatingStrata(false);
    }
  }, [creatingStrata]);

  const onStrataHub = useCallback(() => {
    setOpen(false);
    router.push("/sandbox/prototypes/strata");
  }, [router]);

  const onRabbitHoles = useCallback(() => {
    setOpen(false);
    router.push("/rabbitholes/browse");
  }, [router]);

  const onSettings = useCallback(() => {
    setOpen(false);
    router.push("/settings");
  }, [router]);

  const onOpenCandidate = useCallback(
    (c: HomepageRouteCandidate) => {
      refreshSidebarChats();
      setOpen(false);
      router.push(c.href);
    },
    [refreshSidebarChats, router]
  );

  const busy = routing || creatingChat || creatingArcadia || creatingStrata;

  return (
    <AionLauncherContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="z-[100] overflow-hidden p-0 sm:max-w-lg"
        >
          <Command
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
            shouldFilter
            onKeyDown={(e) => {
              if (e.key !== "Enter" || busy) return;

              const root = (e.currentTarget as HTMLElement).closest("[cmdk-root]");

              if (!root) return;

              const input = root.querySelector("input") as HTMLInputElement | null;
              const q = input?.value?.trim() ?? "";

              if (!q) return;

              const selected = root.querySelector(
                '[cmdk-item][data-selected="true"], [cmdk-item][data-selected]'
              ) as HTMLElement | null;

              const valueAttr = selected?.getAttribute("data-value") ?? "";

              const isListOrPinnedAction =
                valueAttr.startsWith("candidate-") ||
                (valueAttr.startsWith("action-") && valueAttr.length > 0);

              if (isListOrPinnedAction) return;

              if (valueAttr !== "semantic-best-match" && valueAttr !== "") return;

              e.preventDefault();
              void runSemanticRoute(q);
            }}
          >
            <CommandInput disabled={busy} placeholder="Search chats, Strata pages, actions…" />
            <CommandList className="max-h-[min(60vh,420px)]">
              {candidatesLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
              ) : null}
              <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
                No list matches — press Enter to find best match, or pick an action above.
              </CommandEmpty>
              <CommandGroup heading="Actions">
                <CommandItem
                  disabled={busy || creatingChat}
                  keywords={["new", "chat", "message"]}
                  onSelect={() => void onNewChat()}
                  value="action-new-chat"
                >
                  <MessageSquarePlus className="text-muted-foreground" />
                  <span>New chat</span>
                </CommandItem>
                <CommandItem
                  disabled={busy || creatingArcadia}
                  keywords={["arcadia", "sandbox"]}
                  onSelect={() => void onNewArcadia()}
                  value="action-new-arcadia"
                >
                  <Sparkles className="text-muted-foreground" />
                  <span>New Arcadia</span>
                </CommandItem>
                <CommandItem
                  disabled={busy || creatingStrata}
                  keywords={["strata", "page", "new"]}
                  onSelect={() => void onNewStrata()}
                  value="action-new-strata"
                >
                  <Layers className="text-muted-foreground" />
                  <span>New Strata page</span>
                </CommandItem>
                <CommandItem
                  disabled={busy}
                  keywords={["strata", "hub", "browse", "list"]}
                  onSelect={onStrataHub}
                  value="action-strata-hub"
                >
                  <Compass className="text-muted-foreground" />
                  <span>Open Strata hub</span>
                </CommandItem>
                <CommandItem
                  disabled={busy}
                  keywords={["rabbit", "hole", "explore"]}
                  onSelect={onRabbitHoles}
                  value="action-rabbit-holes"
                >
                  <Rabbit className="text-muted-foreground" />
                  <span>Rabbit holes</span>
                </CommandItem>
                <CommandItem
                  disabled={busy}
                  keywords={["settings", "preferences"]}
                  onSelect={onSettings}
                  value="action-settings"
                >
                  <Settings2 className="text-muted-foreground" />
                  <span>Settings</span>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Open recent">
                {candidates.map((c, i) => (
                  <CommandItem
                    key={`${c.kind}-${c.routeKey}-${i}`}
                    disabled={busy}
                    keywords={[c.title, c.summaryText ?? "", c.kind, c.feature].filter(Boolean)}
                    value={`candidate-${i}-${c.title}-${c.summaryText ?? ""}`}
                    onSelect={() => onOpenCandidate(c)}
                  >
                    <span className="truncate">{c.title}</span>
                    <span className="ml-auto shrink-0 text-xs capitalize text-muted-foreground">
                      {c.kind === "strata_page"
                        ? "Strata"
                        : c.kind === "rabbit_hole"
                          ? "Rabbit"
                          : c.feature}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Routing">
                <CommandItem
                  disabled={busy}
                  keywords={["best", "match", "route", "ai", "semantic", "find", "open"]}
                  value="semantic-best-match"
                  onSelect={() => {
                    const root = document.querySelector("[cmdk-root]");
                    const input = root?.querySelector("input") as HTMLInputElement | null;
                    const q = input?.value?.trim() ?? "";

                    if (q) void runSemanticRoute(q);
                  }}
                >
                  <Wand2 className="text-muted-foreground" />
                  <span>Best match from search…</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </AionLauncherContext.Provider>
  );
}

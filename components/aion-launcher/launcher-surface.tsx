"use client";

import type { SessionSignal } from "@/lib/sidebar/session-signal";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAionLauncher } from "./aion-launcher";
import { LauncherIdeaCard } from "./launcher-idea-card";

import { AIInput } from "@/components/chat-experimental/ai-input";
import { HomepagePrimaryActions } from "@/components/pages/homepage-primary-actions";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { useChatId } from "@/hooks/use-chat-id";
import { useSidebarActivity } from "@/hooks/use-sidebar-activity";
import { useClerkUserId } from "@/lib/auth/use-clerk-user-id";
import { useSharedChatContext } from "@/lib/context/chat-context";
import {
  buildLauncherIdeas,
  launcherIdeaLayout,
  moveIdeaFocus,
  openLauncherIdea,
  rankLauncherIdeas,
  type LauncherIdea,
} from "@/lib/launcher/launcher-ideas";
import { candidateFetcher, cueCacheKey, launcherCueCache } from "@/lib/launcher/launcher-cue-cache";
import {
  LAUNCHER_ENTER_S,
  LAUNCHER_EXIT_S,
  LAUNCHER_LIST_REFRESH_MIN_MS,
} from "@/lib/launcher/launcher-timing";
import { getSessionExperience } from "@/lib/sidebar/session-experience";
import { deriveSessionSignal, resolveActiveThreadId } from "@/lib/sidebar/session-signal";
import { getSettings } from "@/lib/user-settings";

/** Reopening is instant from the sidebar cache; the list itself is revalidated at most this often. */
let lastListRefreshAt = 0;

function useIdeaLayout() {
  const [layout, setLayout] = useState(() => launcherIdeaLayout(window.innerWidth));

  useEffect(() => {
    const onResize = () =>
      setLayout((prev) => {
        const next = launcherIdeaLayout(window.innerWidth);

        return next.limit === prev.limit && next.columns === prev.columns ? prev : next;
      });

    window.addEventListener("resize", onResize, { passive: true });

    return () => window.removeEventListener("resize", onResize);
  }, []);

  return layout;
}

/**
 * The ⌘K switcher: the homepage's own input with the most recent ideas laid out beneath it,
 * and the same primary actions below that. Mounted for the whole session (so ⌘K can open it at
 * once); its body, and every subscription in it, exists only while it is open.
 */
export function AionLauncherSurface() {
  // useSearchParams needs a boundary for prerendering, as in the sidebar's own list.
  return (
    <Suspense fallback={null}>
      <LauncherDialog />
    </Suspense>
  );
}

function LauncherDialog() {
  const { open: requested, setOpen } = useAionLauncher();
  const { userId } = useClerkUserId();
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  // Signed-out visitors have no ideas to switch between, and the input would route nowhere.
  const open = requested && userId !== null;

  // Any navigation, wherever it came from (a card, the input, an action), dismisses the launcher.
  useEffect(() => {
    setOpen(false);
  }, [pathname, search, setOpen]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[230] bg-background/60 backdrop-blur-md data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none"
          style={{
            animationDuration: `${open ? LAUNCHER_ENTER_S : LAUNCHER_EXIT_S}s`,
          }}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-[10dvh] z-[230] mx-auto w-full max-w-3xl px-4 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 motion-reduce:animate-none"
          style={{
            animationDuration: `${open ? LAUNCHER_ENTER_S : LAUNCHER_EXIT_S}s`,
          }}
        >
          <DialogPrimitive.Title className="sr-only">Switch ideas</DialogPrimitive.Title>
          <LauncherBody onClose={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function LauncherBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const search = useSearchParams()?.toString() ?? "";
  const pathChatId = useChatId();
  const { userId } = useClerkUserId();
  const { setChatId, sidebarPinnedChats, sidebarUnpinnedChats, refreshSidebarChats } =
    useSharedChatContext();
  const { activityById } = useSidebarActivity();
  const voice = useVoiceSessionOptional();
  const layout = useIdeaLayout();

  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const [now] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ── Resume cues: in memory, revalidated on open, never blocking ──
  const coalescenceMode = getSettings().coalescenceMode;
  const cueKey = userId ? cueCacheKey(userId, coalescenceMode) : "";
  const cueById = useSyncExternalStore(
    launcherCueCache.subscribe,
    () => launcherCueCache.peek(cueKey),
    () => launcherCueCache.peek("")
  );

  useEffect(() => {
    if (!cueKey) return;
    void launcherCueCache.load(cueKey, candidateFetcher(coalescenceMode));
  }, [cueKey, coalescenceMode]);

  // The sidebar cache paints first; bring the order up to date behind it, not on every open.
  useEffect(() => {
    const at = Date.now();

    if (at - lastListRefreshAt < LAUNCHER_LIST_REFRESH_MIN_MS) return;
    lastListRefreshAt = at;
    refreshSidebarChats();
  }, [refreshSidebarChats]);

  const threads = useMemo(
    () => [...sidebarPinnedChats, ...sidebarUnpinnedChats],
    [sidebarPinnedChats, sidebarUnpinnedChats]
  );

  const activeThreadId = useMemo(
    () => resolveActiveThreadId(threads, { chatId: pathChatId, pathname, search }),
    [threads, pathChatId, pathname, search]
  );

  const ideas = useMemo(
    () => buildLauncherIdeas({ threads, cueById, activeThreadId }),
    [threads, cueById, activeThreadId]
  );
  const shown = useMemo(
    () => rankLauncherIdeas(ideas, query, layout.limit),
    [ideas, query, layout.limit]
  );

  const signals = useMemo(() => {
    const voiceInput = voice
      ? {
          threadId: voice.threadId ?? null,
          live: Boolean(voice.connected || voice.connecting),
          paused: Boolean(voice.paused),
        }
      : null;
    const map = new Map<string, SessionSignal>();

    for (const idea of shown) {
      map.set(
        idea.id,
        deriveSessionSignal({
          threadId: idea.id,
          experience: getSessionExperience(idea.feature),
          activity: activityById.get(idea.id),
          voice: voiceInput,
          isActive: false,
        })
      );
    }

    return map;
  }, [shown, activityById, voice]);

  const openIdea = useCallback(
    (idea: LauncherIdea) => {
      // Same path as a sidebar click, so a thread that is mid-stream reattaches the same way.
      openLauncherIdea(idea, { setChatId, close: onClose, push: router.push });
    },
    [onClose, router, setChatId]
  );

  const focusCard = useCallback((index: number) => {
    cardRefs.current[index]?.focus();
  }, []);

  const focusInput = useCallback(() => {
    rootRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const target = event.target as HTMLElement;

    // From the input, ↓ at the end of the text steps into the cards.
    if (target.tagName === "TEXTAREA") {
      const field = target as HTMLTextAreaElement;
      const atEnd =
        field.selectionStart === field.value.length && field.selectionEnd === field.value.length;

      if (event.key === "ArrowDown" && atEnd && !event.shiftKey && shown.length > 0) {
        event.preventDefault();
        focusCard(0);
        setFocusIndex(0);
      }

      return;
    }

    const index = cardRefs.current.findIndex((card) => card === target);

    if (index === -1) return;

    // Typing from a card goes back to the input, so you never have to aim for it.
    if (event.key.length === 1 && event.key !== " ") {
      focusInput();

      return;
    }

    const move = moveIdeaFocus({
      index,
      count: shown.length,
      columns: layout.columns,
      key: event.key,
    });

    if (move.kind === "stay") return;

    event.preventDefault();
    if (move.kind === "input") focusInput();
    else focusCard(move.index);
  };

  const hasQuery = query.trim().length > 0;

  return (
    // The key handler delegates to the real focusable controls inside; it adds no role of its own.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div ref={rootRef} className="flex flex-col items-center gap-6" onKeyDown={onKeyDown}>
      <div className="w-full max-w-xl">
        <AIInput
          hideEmbedActions
          placeholder="Jump to an idea, or start a new one…"
          onNavigate={onClose}
          onTextChange={setQuery}
        />
      </div>

      {shown.length > 0 ? (
        <div
          aria-label={hasQuery ? "Matching ideas" : "Recent ideas"}
          className="grid w-full gap-3"
          role="group"
          style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}
        >
          {shown.map((idea, index) => (
            <LauncherIdeaCard
              key={idea.id}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              idea={idea}
              index={index}
              likely={hasQuery && index === 0}
              now={now}
              signal={signals.get(idea.id) ?? { kind: "idle" }}
              tabbable={index === Math.min(focusIndex, shown.length - 1)}
              onFocusCard={setFocusIndex}
              onOpen={openIdea}
            />
          ))}
        </div>
      ) : hasQuery ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Nothing recent matches. Press Enter to search everything.
        </p>
      ) : null}

      <p
        aria-hidden="true"
        className="hidden text-[11px] tracking-wide text-muted-foreground sm:block"
      >
        ↵ find · ↓ switch · esc close
      </p>

      <HomepagePrimaryActions scope="launcher" variant="fullViewSecondary" />
    </div>
  );
}

"use client";

import type { HomepagePlanIntent, HomepageRoutePreview } from "@/lib/homepage/ollama-schemas";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { AiInputForm } from "./ai-input-form";

import { HomepagePrimaryActions } from "@/components/pages/homepage-primary-actions";
import { createStrataPageWithRawTextAction } from "@/app/sandbox/prototypes/strata/actions";
import { useAion } from "@/hooks/use-aion";
import { createLogger } from "@/lib/logger";
import { createChat } from "@/lib/chat/chat-store";
import { routeHomepagePrompt } from "@/lib/chat/thread-routing";
import {
  appendDraftQueryParam,
  homepageHrefWithOptionalDraft,
} from "@/lib/chat/thread-routing-candidates";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { getSettings } from "@/lib/user-settings";
import { cn } from "@/lib/utils";

const logger = createLogger("ai-input");

const HOME_INPUT_SPRING = { type: "spring" as const, stiffness: 220, damping: 30, mass: 0.95 };

export type AIInputProps = {
  fullView?: boolean;
  planMode?: boolean;
  onPlanModeToggle?: () => void;
  onTextChange?: (text: string) => void;
  previewIntent?: HomepageRoutePreview | null;
  /** Double-tap / mobile courtesy entry to full composer */
  onComposerDoubleTap?: () => void;
  /** When true, primary actions render outside (homepage shell full view). */
  hideEmbedActions?: boolean;
  onPlanComplete?: (plan: HomepagePlanIntent, userPrompt: string) => void;
  /** Cmd/Ctrl+Enter capture — if omitted, uses Strata save + navigate */
  onStrataShortcut?: (text: string) => void | Promise<void>;
};

export const AIInput: React.FC<AIInputProps> = ({
  fullView = false,
  planMode = false,
  onPlanModeToggle,
  onTextChange,
  previewIntent = null,
  onComposerDoubleTap,
  hideEmbedActions = false,
  onPlanComplete,
  onStrataShortcut: onStrataShortcutProp,
}) => {
  const router = useRouter();
  const { refreshSidebarChats } = useSharedChatContext();
  const [creating, setCreating] = useState(false);
  const [routing, setRouting] = useState(false);

  const handleLetsChat = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await createChat();

      if (res.error || res.data === null) {
        logger.error("handleLetsChat", res.error ? res.error.message : "Chat ID is null");

        return;
      }
      const id = res.data;

      refreshSidebarChats();
      router.push(`/chat/${id}`);
    } catch (error) {
      logger.error("handleLetsChat", `Error creating chat: ${error}`);
    } finally {
      setCreating(false);
    }
  }, [creating, refreshSidebarChats, router]);

  const aion = useAion({
    onFinish: ({ message }) => {
      logger.log(
        "onFinish",
        `Message finished streaming, role=${message?.role} parts=${message?.parts?.length ?? 0}`
      );
    },
    onToolCall: (params) => {
      logger.log("onToolCall", `Tool called ${JSON.stringify(params, null, 2)}`);

      if (params.toolCall.toolName === "navigate" && params.toolCall.input) {
        const { page } = params.toolCall.input as {
          page: string;
          reason?: string;
        };

        switch (page) {
          case "chat":
            void handleLetsChat();
            break;
          case "rabbit-hole":
            break;
          case "settings":
            router.push("/settings");
            break;
        }
      }
    },
    onError: (error) => {
      logger.error("onError", `Error in Aion request ${error.message}`);
    },
  });

  const handleStrataShortcut = useCallback(
    async (text: string) => {
      if (onStrataShortcutProp) {
        await onStrataShortcutProp(text);

        return;
      }
      try {
        const { pageId } = await createStrataPageWithRawTextAction(text);

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(`strata:homepage-capture:${pageId}`, text);
        }
        router.push(`/sandbox/prototypes/strata/${pageId}?highlight=raw`);
      } catch (error) {
        logger.error("handleStrataShortcut", `Strata capture failed: ${error}`);
      }
    },
    [onStrataShortcutProp, router]
  );

  const handlePlanSubmit = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();

      if (!trimmed || routing || aion.status === "streaming" || aion.status === "submitted") {
        return;
      }

      try {
        setRouting(true);
        const res = await fetch("/api/homepage/plan-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });

        if (!res.ok) {
          logger.error("handlePlanSubmit", `Plan API ${res.status}`);

          return;
        }

        const data = (await res.json()) as { plan?: HomepagePlanIntent };

        if (data.plan) {
          onPlanComplete?.(data.plan, trimmed);
        }
      } catch (error) {
        logger.error("handlePlanSubmit", String(error));
      } finally {
        setRouting(false);
      }
    },
    [aion.status, onPlanComplete, routing]
  );

  const handleSubmit = useCallback(
    async (prompt: string) => {
      if (planMode) {
        await handlePlanSubmit(prompt);

        return;
      }

      const trimmed = prompt.trim();

      if (!trimmed || routing || aion.status === "streaming" || aion.status === "submitted") {
        return;
      }

      const clientStart = performance.now();

      try {
        setRouting(true);
        const coalescenceMode = getSettings().coalescenceMode;
        const routeRes = await routeHomepagePrompt({ prompt: trimmed, coalescenceMode });
        const clientRoundTripMs = performance.now() - clientStart;

        if (routeRes.error || !routeRes.data) {
          logger.error(
            "handleSubmit",
            `Semantic routing failed: ${routeRes.error?.message ?? "unknown"}`
          );

          return;
        }

        const { metrics } = routeRes.data;

        logger.log(
          "handleSubmit",
          JSON.stringify({
            event: "homepage_route_client",
            clientRoundTripMs,
            serverTotalMs: metrics.totalServerMs,
            serverClassificationMs: metrics.classificationMs,
            serverFetchCandidatesMs: metrics.fetchCandidatesMs,
            outcome: routeRes.data.outcome,
            candidateCount: metrics.candidateCount,
            coalescenceMode,
          })
        );

        if (routeRes.data.outcome === "match") {
          refreshSidebarChats();
          const kind = routeRes.data.metrics.matchedKind;
          const href =
            kind != null
              ? homepageHrefWithOptionalDraft(routeRes.data.href, kind, trimmed)
              : appendDraftQueryParam(routeRes.data.href, trimmed);

          router.push(href);

          return;
        }

        refreshSidebarChats();
        router.push(appendDraftQueryParam(`/chat/${routeRes.data.chatId}`, trimmed));
      } catch (error) {
        logger.error("handleSubmit", `Error routing homepage prompt ${error}`);
      } finally {
        setRouting(false);
      }
    },
    [aion.status, handlePlanSubmit, planMode, refreshSidebarChats, router, routing]
  );

  const isProcessing = routing || aion.status === "streaming" || aion.status === "submitted";

  return (
    <motion.div
      layout
      className={cn("flex w-full flex-col gap-4", fullView && "mx-auto max-w-2xl min-h-0 flex-1")}
      tabIndex={-1}
      transition={{ ...HOME_INPUT_SPRING, layout: { ...HOME_INPUT_SPRING } }}
    >
      <AiInputForm
        className={cn("w-full rounded-xl", fullView ? "flex-1 min-h-0" : "max-w-xl")}
        clearAfterSubmit={!planMode}
        forceReadyInput={planMode}
        fullView={fullView}
        isLoading={isProcessing}
        previewIntent={previewIntent}
        status={planMode ? aion.status : routing ? "submitted" : aion.status}
        submitStatus={routing ? "submitted" : aion.status}
        onComposerDoubleTap={onComposerDoubleTap}
        onPlanModeToggle={onPlanModeToggle}
        onStrataShortcut={handleStrataShortcut}
        onSubmit={handleSubmit}
        onTextChange={onTextChange}
      />
      <AnimatePresence initial={false} mode="sync">
        {!hideEmbedActions ? (
          <motion.div
            key="homepage-embed-primary-actions"
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            initial={{ opacity: 0, y: 4 }}
            transition={HOME_INPUT_SPRING}
          >
            <HomepagePrimaryActions />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
};

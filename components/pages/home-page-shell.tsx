"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

import { AIInput } from "../chat-experimental/ai-input";
import Page from "../layout/page";

import { AdminBlogLink } from "./admin-blog-link";
import { HomepagePrimaryActions } from "./homepage-primary-actions";
import { SandboxGatewayButton } from "./sandbox-gateway-button";
import { StatusGatewayButton } from "./status-gateway-button";
import { ShowcaseGatewayButton } from "./showcase-gateway-button";
import { T3CodeStubModal } from "./t3code-stub-modal";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { FirstSessionChecklist } from "@/components/onboarding/first-session-checklist";
import { Button } from "@/components/third-party/ui/button";
import { useSidebar, useSidebarPointerInside } from "@/components/third-party/ui/sidebar";
import { appendDraftQueryParam } from "@/lib/chat/thread-routing-candidates";
import { useSharedChatContext } from "@/lib/context/chat-context";
import {
  buildT3CodeCraftedPrompt,
  userTextContainsT3CodeToken,
  type HomepagePlanIntent,
  type HomepageRoutePreview,
} from "@/lib/homepage/ollama-schemas";
import { createChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";

const PLAN_MODE_LABEL = "Intent mode";
const logger = createLogger("home-page-shell");

const HOME_LAYOUT_SPRING = { type: "spring" as const, stiffness: 220, damping: 30, mass: 0.95 };
const FULL_VIEW_CHROME_SPRING = {
  type: "spring" as const,
  stiffness: 240,
  damping: 32,
  mass: 0.9,
};
const CTRL_SPACE_TOGGLE_MS = 1000;

/** Full-view side gutters: 25vw on md+; comfortable floor on small screens. */
const fullViewGutterX = "px-4 md:px-[calc(min(12rem, 25vw))]";

export function HomePageShell() {
  const router = useRouter();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const pointerInside = useSidebarPointerInside();
  const { refreshSidebarChats } = useSharedChatContext();
  const [fullView, setFullView] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [previewIntent, setPreviewIntent] = useState<HomepageRoutePreview | null>(null);
  const [planResult, setPlanResult] = useState<HomepagePlanIntent | null>(null);
  const [t3Open, setT3Open] = useState(false);
  const [t3Prompt, setT3Prompt] = useState("");

  const prevFullView = useRef(false);
  const lastCtrlSpaceToggleRef = useRef(0);

  useEffect(() => {
    if (fullView && !prevFullView.current && !pointerInside) {
      if (isMobile) setOpenMobile(false);
      else setOpen(false);
    }
    prevFullView.current = fullView;
  }, [fullView, pointerInside, isMobile, setOpen, setOpenMobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.ctrlKey && !e.repeat) {
        e.preventDefault();
        const now = Date.now();

        if (now - lastCtrlSpaceToggleRef.current < CTRL_SPACE_TOGGLE_MS) {
          return;
        }
        lastCtrlSpaceToggleRef.current = now;
        setFullView((v) => !v);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!fullView) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullView(false);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [fullView]);

  const lastFiredBucketRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastApiCallRef = useRef(0);
  const pendingTextRef = useRef<string>("");

  const flushPreview = useCallback(async (text: string) => {
    const trimmed = text.trim();

    if (trimmed.length < 30) {
      return;
    }
    const now = Date.now();
    const wait = Math.max(0, 15000 - (now - lastApiCallRef.current));

    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastApiCallRef.current = Date.now();
    try {
      const res = await fetch("/api/homepage/route-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      if (res.ok) {
        const data = (await res.json()) as { preview?: HomepageRoutePreview };

        setPreviewIntent(data.preview ?? null);
      }
    } catch (err) {
      logger.error("flushPreview", String(err));
    }
  }, []);

  const onTextChange = useCallback(
    (text: string) => {
      if (!fullView) {
        return;
      }
      if (text.length < 30) {
        lastFiredBucketRef.current = 0;
        setPreviewIntent(null);
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }

        return;
      }
      const bucket = Math.floor(text.length / 30);

      if (bucket <= lastFiredBucketRef.current) {
        pendingTextRef.current = text;

        return;
      }
      pendingTextRef.current = text;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const t = pendingTextRef.current;
        const b = Math.floor(t.length / 30);

        void flushPreview(t).then(() => {
          lastFiredBucketRef.current = b;
        });
      }, 1200);
    },
    [flushPreview, fullView]
  );

  const onPlanModeToggle = useCallback(() => {
    setPlanMode((v) => !v);
    setPlanResult(null);
  }, []);

  const onPlanComplete = useCallback((plan: HomepagePlanIntent, userPrompt: string) => {
    setPlanResult(plan);
    if (plan.t3codeSuggested || userTextContainsT3CodeToken(userPrompt)) {
      setT3Prompt(buildT3CodeCraftedPrompt(userPrompt));
      setT3Open(true);
    }
  }, []);

  const runPlanNewChat = useCallback(async () => {
    const res = await createChat();

    if (res.data) {
      refreshSidebarChats();
      router.push(`/chat/${res.data}`);
    }
  }, [refreshSidebarChats, router]);

  const runPlanRabbitHole = useCallback(
    (seed: string) => {
      const s = seed.trim();

      router.push(s ? appendDraftQueryParam("/rabbitholes/browse", s) : "/rabbitholes/browse");
    },
    [router]
  );

  return (
    <Page liquidChromeBackground transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <LayoutGroup id="homepage">
        <div
          className={cn(
            "absolute inset-0 flex h-full w-full",
            fullView ? "flex-col" : "flex-col items-center justify-center gap-6 sm:gap-8"
          )}
        >
          <motion.div
            data-dim-background
            transition={HOME_LAYOUT_SPRING}
            className={cn(
              "mx-auto flex w-full max-w-xl flex-col gap-6 px-4 sm:px-0",
              fullView
                ? cn("min-h-0 flex-1 justify-start py-20", fullViewGutterX)
                : "items-center justify-center"
            )}
          >
            {planMode ? (
              <div className="w-full rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-center text-sm text-muted-foreground">
                {PLAN_MODE_LABEL} — Enter runs a lightweight plan (Shift+Tab to exit).
              </div>
            ) : null}
            {planResult ? (
              <div className="w-full space-y-2 rounded-md border border-border/40 bg-background/40 p-3 text-sm">
                <p className="font-medium text-foreground/80">Suggested plan</p>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                  {planResult.actions.map((a, i) =>
                    a.type === "new_chat" ? (
                      <li key={i}>
                        New chat
                        {a.rationale ? ` — ${a.rationale}` : ""}{" "}
                        <Button
                          className="ml-1 h-7 align-middle text-xs"
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => void runPlanNewChat()}
                        >
                          Open
                        </Button>
                      </li>
                    ) : (
                      <li key={i}>
                        Rabbit hole
                        {a.seed
                          ? ` (${a.seed.slice(0, 80)}${a.seed.length > 80 ? "…" : ""})`
                          : ""}{" "}
                        <Button
                          className="ml-1 h-7 align-middle text-xs"
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => runPlanRabbitHole(a.seed ?? "")}
                        >
                          Browse
                        </Button>
                      </li>
                    )
                  )}
                </ul>
              </div>
            ) : null}
            <div
              className={cn(
                "mx-auto w-full max-w-xl",
                fullView && "flex min-h-0 flex-1 flex-col"
              )}
            >
              <AIInput
                fullView={fullView}
                hideEmbedActions={fullView}
                planMode={planMode}
                previewIntent={fullView ? previewIntent : null}
                onComposerDoubleTap={() => setFullView(true)}
                onPlanComplete={onPlanComplete}
                onPlanModeToggle={onPlanModeToggle}
                onTextChange={onTextChange}
              />
            </div>
            <AnimatePresence initial={false} mode="sync">
              {!fullView ? (
                <motion.div
                  key="homepage-gateways"
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
                  transition={HOME_LAYOUT_SPRING}
                  className="flex flex-wrap items-center justify-center gap-3"
                >
                  <SandboxGatewayButton />
                  <ShowcaseGatewayButton />
                  <StatusGatewayButton />
                  <AdminBlogLink />
                </motion.div>
              ) : null}
            </AnimatePresence>
            {!fullView ? (
              <FirstSessionChecklist className="mt-2 px-2 sm:px-0" />
            ) : null}
            {!fullView ? (
              <HomepagePrimaryActions className="mt-4" />
            ) : null}
          </motion.div>
          <AnimatePresence initial={false} mode="sync">
            {fullView ? (
              <motion.div
                key="homepage-full-chrome"
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                initial={{ opacity: 0, y: 12 }}
                transition={FULL_VIEW_CHROME_SPRING}
                className={cn(
                  "pointer-events-auto mt-auto flex w-full min-h-[5rem] flex-shrink-0 flex-col items-stretch gap-4 border-t border-border/30 py-3",
                  "lg:min-h-0 lg:flex-row lg:items-end lg:gap-0"
                )}
              >
                <div className="flex w-full min-w-0 justify-center px-2 lg:w-1/2 lg:justify-center">
                  <HomepagePrimaryActions variant="fullViewSecondary" />
                </div>
                <div className="flex w-full min-w-0 justify-center px-2 lg:w-1/2 lg:justify-center">
                  <div className="flex flex-wrap justify-center gap-2 opacity-90">
                    <SandboxGatewayButton />
                    <ShowcaseGatewayButton />
                    <StatusGatewayButton />
                    <AdminBlogLink />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </LayoutGroup>
      <T3CodeStubModal craftedPrompt={t3Prompt} open={t3Open} onOpenChange={setT3Open} />
    </Page>
  );
}

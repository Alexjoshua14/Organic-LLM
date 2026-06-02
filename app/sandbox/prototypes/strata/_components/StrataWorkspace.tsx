"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const STRATA_PATH_PREFIX = "/sandbox/prototypes/strata";

type StrataAgentUiContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const StrataAgentUiContext = createContext<StrataAgentUiContextValue | null>(null);

export function useStrataAgentPanel(): StrataAgentUiContextValue {
  const ctx = useContext(StrataAgentUiContext);

  if (!ctx) {
    throw new Error("useStrataAgentPanel must be used within StrataWorkspace");
  }

  return ctx;
}

export function useOptionalStrataAgentPanel(): StrataAgentUiContextValue | null {
  return useContext(StrataAgentUiContext);
}

/** Opens the Strata assistant panel (only renders under StrataWorkspace). */
export function StrataAssistantOpenHint() {
  const ctx = useOptionalStrataAgentPanel();

  if (!ctx) return null;

  return (
    <button
      className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      type="button"
      onClick={() => ctx.setOpen(true)}
    >
      Assistant <span className="hidden sm:inline">· </span>
      <kbd className="font-sans text-[10px] opacity-80">⌘⌥B</kbd>
    </button>
  );
}

/**
 * Strata-wide layout: main column + optional right assistant (Cmd+Opt+B / Ctrl+Alt+B).
 * Keyboard listener only applies under `/sandbox/prototypes/strata`.
 */
export function StrataWorkspace({
  children,
  agentPanel,
  agentPanelTitle,
}: {
  children: ReactNode;
  agentPanel: ReactNode;
  /** Shown top-left when the assistant aside is open (e.g. active persona short label). */
  agentPanelTitle?: string;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const isStrataRoute = pathname.startsWith(STRATA_PATH_PREFIX);

  useEffect(() => {
    if (!isStrataRoute) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && !e.shiftKey && e.code === "KeyB") {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isStrataRoute, toggle]);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  if (!isStrataRoute) {
    return <>{children}</>;
  }

  return (
    <StrataAgentUiContext.Provider value={value}>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        {open ? (
          <aside
            className={cn(
              glass({ opaque: true }),
              "flex h-full min-h-0 w-full shrink-0 flex-col border-border/60 md:w-[min(26rem,100%)] md:border-l"
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
              <div className="min-w-0 flex-1 text-left">
                <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Assistant
                </span>
                <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
                  {agentPanelTitle ?? "Assistant"}
                </span>
              </div>
              <button
                className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                type="button"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">{agentPanel}</div>
          </aside>
        ) : null}
      </div>
    </StrataAgentUiContext.Provider>
  );
}

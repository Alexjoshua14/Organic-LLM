"use client";

import type { LabView } from "../_lib/lab-state";
import type { FocusControlId } from "./focus-stage";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { LAB_COMPOSER_PREF_KEYS, useCoreInputLabState } from "../_lib/lab-state";
import { useSimulatedChat } from "../_lib/use-simulated-chat";

import { FocusPanel } from "./focus-panel";
import { FOCUS_CONTROLS, FocusStage, parseFocusControl } from "./focus-stage";
import { ProductPanel } from "./product-panel";
import { ProductStage } from "./product-stage";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { useContextEffortSettings } from "@/hooks/use-context-effort-settings";
import { setSettings } from "@/lib/user-settings";
import { cn } from "@/lib/utils";

const VIEW_COPY: Record<LabView, string> = {
  product:
    "The shipped composer, live. Sends are simulated: type and press Enter to watch the real submit → streaming → ready cycle.",
  focus:
    "Footer controls in isolation, driven by lab state instead of CoreInput. Pinned cells hold a state so you can compare without clicking.",
};

export function CoreInputLab() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: LabView = searchParams.get("view") === "focus" ? "focus" : "product";
  const control = parseFocusControl(searchParams.get("control"));

  const { state, hydrated, patchProduct, patchFocus, reset } = useCoreInputLabState();
  const chat = useSimulatedChat({ outcome: state.product.sendOutcome });
  const contextEffortSettings = useContextEffortSettings();
  const [remountKey, setRemountKey] = useState(0);

  const setParams = useCallback(
    (next: { view?: LabView; control?: FocusControlId | "all" }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (next.view !== undefined) {
        if (next.view === "product") params.delete("view");
        else params.set("view", next.view);
      }
      if (next.control !== undefined) {
        if (next.control === "all") params.delete("control");
        else params.set("control", next.control);
      }

      const query = params.toString();

      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const remount = useCallback(() => setRemountKey((key) => key + 1), []);

  const resetComposerPrefs = useCallback(() => {
    for (const key of Object.values(LAB_COMPOSER_PREF_KEYS)) localStorage.removeItem(key);
    remount();
  }, [remount]);

  const resetLab = useCallback(() => {
    reset();
    chat.setStatus("ready");
    remount();
  }, [chat, remount, reset]);

  const chrome = view === "product" && state.product.backdrop === "chrome";

  return (
    <Page
      className="items-stretch justify-start overflow-hidden"
      liquidChromeBackground={chrome}
      transparentBackground={chrome}
    >
      {chrome ? <AdaptiveLiquidChrome dimIntensity={0.45} /> : null}

      <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto pb-20">
        <PageContentFrame maxWidth="7xl">
          <PageNavBack
            className="mb-6"
            href="/sandbox/prototypes"
            trailing={<ViewSwitch value={view} onChange={(next) => setParams({ view: next })} />}
          >
            ← Prototypes
          </PageNavBack>

          <header className="mb-6">
            <h1 className="font-commissioner text-2xl font-light tracking-tight text-foreground sm:text-3xl">
              CoreInput lab
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {VIEW_COPY[view]}
            </p>
          </header>

          {view === "focus" ? (
            <FocusNav
              className="mb-5"
              value={control}
              onChange={(next) => setParams({ control: next })}
            />
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
            <div className="min-w-0">
              {!hydrated ? (
                <div className="h-48 rounded-2xl border border-dashed border-border/40" />
              ) : view === "product" ? (
                <ProductStage chat={chat} remountKey={remountKey} state={state.product} />
              ) : (
                <FocusStage
                  chat={chat}
                  control={control}
                  patch={patchFocus}
                  state={state.focus}
                  onFocusControl={(next) => setParams({ control: next })}
                />
              )}
            </div>

            <aside className="lg:sticky lg:top-2 lg:max-h-[calc(100dvh-1rem)] lg:overflow-y-auto">
              {!hydrated ? null : view === "product" ? (
                <ProductPanel
                  chat={chat}
                  contextEffortBeta={contextEffortSettings.enabled}
                  patch={patchProduct}
                  state={state.product}
                  onContextEffortBetaChange={(enabled) =>
                    setSettings({ experimentalContextEffort: enabled })
                  }
                  onRemount={remount}
                  onResetComposerPrefs={resetComposerPrefs}
                  onResetLab={resetLab}
                />
              ) : (
                <FocusPanel
                  chat={chat}
                  patch={patchFocus}
                  state={state.focus}
                  onResetLab={resetLab}
                />
              )}
            </aside>
          </div>
        </PageContentFrame>
      </div>
    </Page>
  );
}

function ViewSwitch({ value, onChange }: { value: LabView; onChange: (view: LabView) => void }) {
  const views: Array<{ id: LabView; label: string }> = [
    { id: "product", label: "Product" },
    { id: "focus", label: "Focus" },
  ];

  return (
    <div
      aria-label="Lab view"
      className="flex gap-0.5 rounded-full bg-muted/50 p-0.5"
      role="tablist"
    >
      {views.map((entry) => {
        const active = entry.id === value;

        return (
          <button
            key={entry.id}
            aria-selected={active}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            role="tab"
            type="button"
            onClick={() => onChange(entry.id)}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

function FocusNav({
  value,
  onChange,
  className,
}: {
  value: FocusControlId | "all";
  onChange: (control: FocusControlId | "all") => void;
  className?: string;
}) {
  const entries: Array<{ id: FocusControlId | "all"; label: string }> = [
    { id: "all", label: "All" },
    ...FOCUS_CONTROLS.map((control) => ({ id: control.id, label: control.title })),
  ];

  return (
    <nav aria-label="Focus a control" className={cn("flex flex-wrap gap-1.5", className)}>
      {entries.map((entry) => {
        const active = entry.id === value;

        return (
          <button
            key={entry.id}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-full border px-2.5 py-1 text-2xs transition-colors",
              active
                ? "border-foreground/40 bg-foreground/10 text-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            )}
            type="button"
            onClick={() => onChange(entry.id)}
          >
            {entry.label}
          </button>
        );
      })}
    </nav>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";
import { Brain, Lock, Moon, Search, Settings } from "lucide-react";

import { AssistantMessageActionsSnapshotPreview } from "./_components/assistant-message-actions-snapshot-preview";
import { CurrentCoreInputPreview } from "./_components/current-core-input-preview";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { OrganicGlassBaselineSurface } from "@/components/design-system/organic-glass-baseline-surface";
import { glass, glassPreview } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { cn } from "@/lib/utils";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "UI v2 Snapshot"),
};

type SnapshotVariant = "current" | "v2";

const threads = [
  {
    title: "Memory architecture",
    meta: "Today",
    status: "Reasoning",
  },
  {
    title: "Liquid glass typography",
    meta: "Today",
    status: "Design",
  },
  {
    title: "Rabbit Hole: Agent UX",
    meta: "Yesterday",
    status: "Exploration",
  },
  {
    title: "Profile summary review",
    meta: "Apr 24",
    status: "Memory",
  },
];

const rabbitHoles = [
  {
    title: "Agentic UI patterns",
    question: "How should an AI workspace reveal its reasoning without becoming noisy?",
    branches: 12,
    updated: "Today, 8:42 PM",
    summary: "Mapped progressive disclosure, tool traces, and calm status surfaces.",
  },
  {
    title: "Glass material research",
    question: "What makes a digital glass surface feel alive while staying readable?",
    branches: 8,
    updated: "Today, 6:10 PM",
    summary: "Collected notes on refraction, blur budgets, contrast, and motion restraint.",
  },
  {
    title: "Memory as product UX",
    question: "How can memory feel useful, inspectable, and under user control?",
    branches: 15,
    updated: "Yesterday",
    summary: "Compared recall cards, consent flows, summary layers, and privacy controls.",
  },
];

const settingsRows = [
  {
    icon: Brain,
    title: "Profile memory",
    value: "Enabled",
    description: "Uses saved preferences and working context to personalize responses.",
  },
  {
    icon: Moon,
    title: "Appearance",
    value: "System dark",
    description: "Theme follows the device and keeps chrome intensity balanced.",
  },
  {
    icon: Lock,
    title: "Zero Data Retention",
    value: "On",
    description: "Requests non-retention from supported model providers.",
  },
  {
    icon: Settings,
    title: "Interface font",
    value: "Commissioner",
    description: "Prototype direction for the next Organic LLM interface voice.",
  },
];

const CHAT_USER_SNAPSHOT =
  "Help me turn memory into a user-facing trust feature, not just a backend capability.";

const CHAT_ASSISTANT_SNAPSHOT =
  "Treat memory as an inspectable layer: show what was used, let users correct it, and keep retrieval narrow enough that the interface still feels fast and grounded.";

function currentSurfaceClass(className?: string) {
  return cn("rounded-2xl border border-border bg-background-secondary", className);
}

function mutedSurfaceClass(variant: SnapshotVariant, className?: string) {
  if (variant === "v2") {
    return cn(glassPreview({ depth: "raised", opaque: true }), "rounded-xl", className);
  }

  return cn("rounded-xl border border-border/70 bg-background-secondary/70", className);
}

function Chip({ children, variant }: { children: ReactNode; variant: SnapshotVariant }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-medium",
        variant === "v2"
          ? "border border-white/20 bg-background/34 text-foreground shadow-inner dark:border-white/10 dark:bg-background-secondary/34"
          : "border border-border bg-background text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

function ShimmerIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-grid size-5 shrink-0 place-items-center", className)}>
      <span className="text-foreground/55 transition-colors duration-200 group-hover:text-foreground group-active:text-foreground">
        {children}
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(110deg,transparent,rgba(18,140,116,0.42),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-active:opacity-100" />
    </span>
  );
}

function SidebarPreview({ variant }: { variant: SnapshotVariant }) {
  if (variant === "current") {
    return (
      <aside className="flex min-h-[30rem] w-64 shrink-0 flex-col overflow-hidden bg-background-secondary subpixel-antialiased">
        <div className="grid h-16 shrink-0 place-content-center bg-background-secondary pl-7">
          <h3 className="font-commissioner text-lg font-medium tracking-tight text-foreground">
            Organic LLM
          </h3>
        </div>

        <div className="flex shrink-0 flex-col gap-3 px-3 pb-3">
          <button
            className="flex w-full cursor-pointer items-center justify-center rounded bg-background-tertiary px-4 py-5 text-sm font-medium text-foreground"
            type="button"
          >
            New Chat
          </button>
          {["Rabbit Holes", "Speak", "Remy"].map((item) => (
            <button
              className="flex w-full cursor-pointer items-center justify-center rounded bg-background-tertiary px-4 py-5 text-sm font-medium text-foreground"
              key={item}
              type="button"
            >
              {item}
            </button>
          ))}
          <div className="flex items-center gap-2 rounded px-1 py-2 text-sm text-muted-foreground">
            <Search className="size-4" />
            <span>Search your threads...</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
          <div className="mb-2 px-2 text-xs font-medium text-foreground">All Threads</div>
          <div className="space-y-1">
            {threads.map((thread, index) => (
              <div
                className={cn(
                  "group flex items-center justify-between gap-2 rounded px-2 py-2 text-sm",
                  index === 0 ? "bg-background text-foreground" : "text-muted-foreground"
                )}
                key={thread.title}
              >
                <span className="truncate">{thread.title}</span>
                <span className="text-[10px] opacity-60">{thread.meta}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <OrganicGlassBaselineSurface
      className="flex min-h-[30rem] w-64 shrink-0 flex-col font-commissioner"
      compact
    >
      <div className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Workspace
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Organic LLM</h3>
      </div>

      <button
        className="mb-4 rounded-lg bg-foreground px-3 py-2 text-left text-sm font-medium text-background"
        type="button"
      >
        New chat
      </button>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
        <Search className="size-3.5" />
        Search threads
      </div>

      <div className="space-y-2">
        {threads.map((thread, index) => (
          <div
            className={cn(
              "rounded-lg px-3 py-2",
              index === 0 ? "border border-accent/25 bg-accent/10" : "bg-transparent"
            )}
            key={thread.title}
          >
            <div className="truncate text-sm font-medium text-foreground">{thread.title}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{thread.meta}</span>
              <span>{thread.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
        Rabbit Holes, Speak, Remy
      </div>
    </OrganicGlassBaselineSurface>
  );
}

function ChatPreview({ variant }: { variant: SnapshotVariant }) {
  if (variant === "current") {
    return (
      <section className="flex min-h-[30rem] flex-1 flex-col bg-background p-4 sm:p-5">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10">
          <div className="max-w-4/5 w-fit self-end overflow-hidden text-foreground">
            <div className={cn(glass(), "rounded-lg p-4")}>
              <p className="text-sm leading-6 text-foreground">{CHAT_USER_SNAPSHOT}</p>
            </div>
          </div>

          <div className="group/ai-message flex max-w-[88%] flex-col gap-2 rounded-lg p-4">
            <div className="prose dark:prose-invert max-w-full space-y-2 text-sm leading-6 text-foreground">
              <p className="text-foreground">{CHAT_ASSISTANT_SNAPSHOT}</p>
            </div>
            <AssistantMessageActionsSnapshotPreview text={CHAT_ASSISTANT_SNAPSHOT} />
          </div>
        </div>

        <div className="mx-auto mt-5 w-full max-w-2xl">
          <CurrentCoreInputPreview />
        </div>
      </section>
    );
  }

  return (
    <OrganicGlassBaselineSurface className="flex min-h-[30rem] flex-1 flex-col">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Chat thread
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            Memory architecture
          </h3>
        </div>
        <Chip variant={variant}>GPT-5.5</Chip>
      </header>

      <div className="min-h-0 flex flex-1 flex-col gap-8 overflow-x-hidden overflow-y-auto py-0.5">
        <div className="max-w-4/5 w-fit self-end overflow-hidden text-foreground">
          <div className={cn(glass(), "rounded-lg p-4")}>
            <p className="text-sm leading-6 text-foreground">{CHAT_USER_SNAPSHOT}</p>
          </div>
        </div>

        <div className="group/ai-message flex max-w-[88%] flex-col gap-2 rounded-lg p-4">
          <div className="prose dark:prose-invert max-w-full space-y-2 text-sm leading-6 text-foreground">
            <p className="text-foreground">{CHAT_ASSISTANT_SNAPSHOT}</p>
          </div>
          <AssistantMessageActionsSnapshotPreview text={CHAT_ASSISTANT_SNAPSHOT} />
        </div>
      </div>

      <div className="mt-5 overflow-visible px-0.5 pb-1">
        <CurrentCoreInputPreview variant="v2" />
      </div>
    </OrganicGlassBaselineSurface>
  );
}

function RabbitHolesPreview({ variant }: { variant: SnapshotVariant }) {
  if (variant === "current") {
    return (
      <section className="bg-background px-5 py-6 sm:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="mb-2 font-commissioner text-3xl font-light tracking-tight text-foreground">
              Rabbit Holes
            </h3>
            <p className="text-sm text-muted-foreground">
              Browse and manage your exploration sessions
            </p>
          </div>
          <button
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
            type="button"
          >
            New Rabbit Hole
          </button>
        </div>

        <div className="grid gap-4">
          {rabbitHoles.map((session) => (
            <article
              className="rounded-lg border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm"
              key={session.title}
            >
              <h4 className="mb-2 font-commissioner text-lg font-light text-foreground">
                {session.title}
              </h4>
              <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{session.summary}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{session.updated}</span>
                <span>•</span>
                <span>{session.branches} levels explored</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <OrganicGlassBaselineSurface className="!p-0">
      <div className="px-5 py-6 sm:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="mb-2 font-commissioner text-3xl font-light tracking-tight text-foreground">
              Rabbit Holes
            </h3>
            <p className="text-sm text-muted-foreground">
              Browse and manage your exploration sessions
            </p>
          </div>
          <button
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
            type="button"
          >
            New Rabbit Hole
          </button>
        </div>

        <div className="grid gap-4">
          {rabbitHoles.map((session) => (
            <article
              className="rounded-lg border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm"
              key={session.title}
            >
              <h4 className="mb-2 font-commissioner text-lg font-light text-foreground">
                {session.title}
              </h4>
              <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{session.summary}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{session.updated}</span>
                <span>•</span>
                <span>{session.branches} levels explored</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </OrganicGlassBaselineSurface>
  );
}

function SettingsPreview({ variant }: { variant: SnapshotVariant }) {
  if (variant === "current") {
    return (
      <section className="bg-background">
        <div className="flex w-full items-center justify-between border-b border-border px-8 py-3">
          <div aria-hidden className="w-20" />
          <h3 className="text-lg font-semibold text-foreground">Settings</h3>
          <div aria-hidden className="w-20" />
        </div>

        <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
          <div className="mb-6 grid w-full grid-cols-4 rounded-lg bg-muted p-1 text-sm">
            {["Profile", "Appearance", "Memory", "Privacy"].map((tab, index) => (
              <div
                className={cn(
                  "rounded-md px-3 py-1.5 text-center",
                  index === 0 ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
                key={tab}
              >
                {tab}
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-background px-4 py-4 shadow-sm">
              <h4 className="text-base font-semibold text-foreground">Alex Joshua</h4>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Building a cohesive AI workspace with memory, voice, and deep exploration.
              </p>
            </div>
            {settingsRows.slice(0, 3).map((row) => {
              const Icon = row.icon;

              return (
                <div className="flex items-start gap-3" key={row.title}>
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{row.title}</p>
                      <span className="text-sm text-muted-foreground">{row.value}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {row.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <OrganicGlassBaselineSurface>
      <div className="mb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Settings
        </p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          Profile and controls
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
        <div className={mutedSurfaceClass(variant, "p-4")}>
          <div className="mb-4 size-12 rounded-xl bg-foreground text-background grid place-items-center text-lg font-semibold">
            AJ
          </div>
          <h4 className="text-base font-semibold text-foreground">Alex Joshua</h4>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Building a cohesive AI workspace with memory, voice, and deep exploration.
          </p>
        </div>

        <div className="space-y-2">
          {settingsRows.map((row) => {
            const Icon = row.icon;

            return (
              <div
                className={mutedSurfaceClass(variant, "group flex items-start gap-3 p-3")}
                key={row.title}
              >
                <ShimmerIcon className="mt-0.5">
                  <Icon className="size-4" />
                </ShimmerIcon>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{row.title}</p>
                    <span className="text-xs text-muted-foreground">{row.value}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </OrganicGlassBaselineSurface>
  );
}

function SnapshotShell({ variant }: { variant: SnapshotVariant }) {
  const isV2 = variant === "v2";

  const header = (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-accent/80">
          {isV2 ? "Working prototype" : "Current UI"}
        </p>
        <h2 className="mt-1 text-3xl font-light tracking-[-0.04em] text-foreground">
          {isV2 ? "Organic LLM v2" : "Organic LLM today"}
        </h2>
      </div>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        {isV2
          ? "Commissioner, Organic Glass baseline candidate, and a calmer high-contrast surface system."
          : "A concise snapshot of today's sidebar, chat, Rabbit Holes, and settings patterns."}
      </p>
    </header>
  );

  const body = (
    <div className="space-y-4 overflow-visible py-0.5">
      <div
        className={cn(
          "flex min-w-0 gap-4",
          isV2 ? "items-stretch overflow-x-auto overflow-y-visible py-0.5" : "overflow-hidden"
        )}
      >
        <SidebarPreview variant={variant} />
        <ChatPreview variant={variant} />
      </div>
      <RabbitHolesPreview variant={variant} />
      <SettingsPreview variant={variant} />
    </div>
  );

  if (isV2) {
    return (
      <OrganicGlassBaselineSurface className="min-w-0 font-commissioner" compact>
        {header}
        {body}
      </OrganicGlassBaselineSurface>
    );
  }

  return (
    <section className={currentSurfaceClass("min-w-0 p-4 sm:p-5")}>
      {header}
      {body}
    </section>
  );
}

export default function UiV2SnapshotPrototypePage() {
  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.48} dimIntensityFull={0.68} speed={0.01} />

      <div className="relative z-10 h-full w-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[96rem] px-5 py-6 sm:px-8 sm:py-10">
          <nav className="mb-8">
            <Link
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              href="/sandbox/prototypes"
            >
              &larr; Prototypes
            </Link>
          </nav>

          <header className="mb-8 max-w-4xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.3em] text-accent/80">
              UI v2 snapshot
            </p>
            <h1 className="text-4xl font-light tracking-[-0.045em] text-foreground sm:text-5xl">
              Current interface beside the Commissioner glass direction.
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Placeholder data fills every surface so the next UI can be evaluated as a whole
              product system, not as isolated components.
            </p>
          </header>

          <div className="grid gap-5 xl:grid-cols-2">
            <SnapshotShell variant="current" />
            <SnapshotShell variant="v2" />
          </div>
        </div>
      </div>
    </Page>
  );
}

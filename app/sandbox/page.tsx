import Link from "next/link";

import Page from "@/components/layout/page";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type SandboxEntry = {
  title: string;
  description: string;
  href: string;
  size: "small" | "large";
};

const sandboxPages: SandboxEntry[] = [
  {
    title: "Arcadia",
    description:
      "Sandbox chat experience for experimenting with prompts, context/tooling, and UI variants",
    href: "/sandbox/arcadia",
    size: "large",
  },
  {
    title: "Prototypes",
    description: "UI and background experiments — silk-fabric gradient and more",
    href: "/sandbox/prototypes",
    size: "small",
  },
  {
    title: "Ideas",
    description:
      "Capture, organize, and manage your creative ideas with priority levels and status tracking",
    href: "/sandbox/ideas",
    size: "large",
  },
  {
    title: "Tasks",
    description: "Full-featured task management with client and server-side functionality",
    href: "/sandbox/tasks",
    size: "large",
  },
  {
    title: "Quick Tasks",
    description: "Streamlined server-side task creation",
    href: "/sandbox/tasks/server",
    size: "small",
  },
  {
    title: "Text-to-Speech",
    description: "Generate speech-friendly responses optimized for audio playback",
    href: "/sandbox/tts",
    size: "large",
  },
  {
    title: "Prometheus",
    description: "Advanced AI interface with organic design and 3D visualization placeholder",
    href: "/sandbox/prometheus",
    size: "large",
  },
  {
    title: "Memory",
    description: "Persisted memory lens, cards, and ephemeral in-chat preview",
    href: "/sandbox/memory",
    size: "small",
  },
  {
    title: "Memory migration tests",
    description:
      "Compare `memories` vs `memories_v2` retrieval side by side with batched sandbox queries",
    href: "/sandbox/migration-tests",
    size: "small",
  },
  {
    title: "Sandbox Platform",
    description:
      "Inspect and test real UI components, pipelines, and LLM-backed functions (Rabbit Holes scenarios)",
    href: "/sandbox/platform",
    size: "large",
  },
];

export default function SandboxPage() {
  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 w-full max-w-6xl mx-auto p-6 overflow-y-auto h-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-linear-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            Sandbox Gateway
          </h1>
          <p className="text-lg text-foreground/80 dark:text-muted-foreground max-w-2xl mx-auto">
            Welcome to your development playground. Explore and experiment with different features
            and tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[minmax(120px,auto)]">
          {sandboxPages.map((page) => (
            <Link
              key={page.href}
              data-dim-background
              className={cn(
                glass(),
                "group relative overflow-hidden rounded-2xl border border-border/70 backdrop-blur-xl",
                "transition-all duration-300 ease-in-out hover:bg-muted/40 active:scale-[0.995]",
                page.size === "large" ? "md:col-span-1 lg:row-span-2" : "md:col-span-1",
                "p-5 flex flex-col justify-between"
              )}
              href={page.href}
            >
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {page.title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {page.description}
                </p>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Explore
                </span>
                <svg
                  aria-hidden
                  className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
            </Link>
          ))}

          <div
            className={cn(
              glass(),
              "group relative overflow-hidden rounded-2xl border-2 border-dashed border-border/50 backdrop-blur-xl",
              "transition-colors duration-300 hover:border-border",
              "p-5 flex flex-col items-center justify-center text-center"
            )}
          >
            <div className="text-3xl mb-3 opacity-60">➕</div>
            <h3 className="text-base font-medium text-muted-foreground mb-1">Coming Soon</h3>
            <p className="text-xs text-muted-foreground/70">
              More sandbox experiments will appear here as you build them
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground/70">
            Each sandbox is a self-contained experiment. Feel free to break things and learn!
          </p>
        </div>
      </div>
    </Page>
  );
}

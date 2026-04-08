import Link from "next/link";

import Page from "@/components/layout/page";
import ShinyText from "@/components/ShinyText";
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
          <h1 className="mb-2 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Sandbox Gateway
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto select-none">
            Where new ideas get built, broken, and refined before they go anywhere else.
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
                <h2 className="font-commissioner text-lg font-light text-foreground mb-2">
                  {page.title}
                </h2>
                <p className="text-sm text-muted-foreground">{page.description}</p>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-muted-foreground select-none">
                  <ShinyText
                    className="cursor-inherit"
                    shimmerOnParentGroupHover
                    speed={2.5}
                    text="Explore"
                  />
                </div>
                <svg
                  aria-hidden
                  className="w-4 h-4 text-muted-foreground opacity-100 transition-all duration-200 group-hover:translate-x-0.5 md:opacity-0 md:group-hover:opacity-100"
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

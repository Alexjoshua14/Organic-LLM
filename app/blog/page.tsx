import Link from "next/link";

import { PageContentFrame } from "@/components/layout/page-content-frame";

const CATEGORIES = ["surfaces", "architecture", "design"] as const;

type Category = (typeof CATEGORIES)[number];

const POSTS: Array<{
  slug: string;
  title: string;
  description: string;
  category: Category;
  /** When set, links to this href instead of `/blog/{slug}`. */
  href?: string;
}> = [
  {
    slug: "surfaces",
    title: "Surfaces",
    description:
      "What each workspace mode is for — Chat (with Arcadia & Noesis variants), Strata, Rabbit Holes, Ergon, and Remy.",
    category: "surfaces",
    href: "/blog/surfaces",
  },
  {
    slug: "how-we-secure-memory",
    title: "How we protect your memories",
    description:
      "Why memory matters, what we encrypt in the memory database, how access and logging work, and what we do not claim.",
    category: "architecture",
  },
  {
    slug: "memory-encryption",
    title: "Memory Encryption",
    description:
      "How Organic LLM encrypts messages and summaries at rest: research, design choices, implemented solution, and how long-term memory fits in.",
    category: "architecture",
  },
  {
    slug: "chat-message-flow",
    title: "Chat Message Flow",
    description:
      "From chat UI to the API: the main message path, context assembly, resumable streams, and key features.",
    category: "architecture",
  },
  {
    slug: "adaptive-liquid-chrome",
    title: "Adaptive Liquid Chrome",
    description:
      "Documentation for the full-viewport adaptive background that dims on hover/focus and brightens in two phases.",
    category: "design",
  },
  {
    slug: "export-prompt-presets",
    title: "Export Prompt Presets",
    description:
      "How Organic LLM generates app-specific external prompts with minimalist CTA buttons and structured output contracts.",
    category: "design",
  },
];

const CATEGORY_LABELS: Record<Category, string> = {
  surfaces: "Surfaces",
  architecture: "Architecture",
  design: "Design",
};

export default function BlogPage() {
  return (
    <PageContentFrame maxWidth="2xl">
      <h1 className="text-2xl font-normal text-foreground mb-2">Blog</h1>
      <p className="text-secondary-foreground text-sm mb-8">
        Design and implementation notes. Not linked in the main UI yet.
      </p>
      <div className="space-y-10">
        {CATEGORIES.map((category) => {
          const postsInCategory = POSTS.filter((p) => p.category === category);

          if (postsInCategory.length === 0) return null;

          return (
            <section key={category}>
              <h2 className="text-lg font-medium text-foreground mb-4">
                {CATEGORY_LABELS[category]}
              </h2>
              <ul className="space-y-4">
                {postsInCategory.map((post) => (
                  <li key={post.slug}>
                    <Link
                      className="block rounded-lg border border-border bg-secondary p-4 transition-colors hover:bg-secondary/80 text-foreground no-underline"
                      href={post.href ?? `/blog/${post.slug}`}
                    >
                      <h3 className="font-medium text-foreground">{post.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{post.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PageContentFrame>
  );
}

/**
 * The blog's one list of posts. The index, the "keep reading" footer and the tests all read it,
 * so a post is added here and nowhere else.
 *
 * Order is editorial: the first post is the feature on the index, the next two sit beside it,
 * the rest flow in the grid below. Put what you most want read first.
 */

export type BlogCategory = "voice" | "surfaces" | "architecture" | "design";

/** Which abstract line drawing a card wears (see `components/blog/blog-art.tsx`). */
export type BlogArtId =
  | "voice"
  | "surfaces"
  | "flow"
  | "vault"
  | "memory"
  | "chrome"
  | "export"
  | "composer"
  // One per surface, for the surfaces index.
  | "chat"
  | "arcadia"
  | "noesis"
  | "strata"
  | "rabbit"
  | "ergon"
  | "remy";

export type BlogPost = {
  slug: string;
  title: string;
  /** One or two plain sentences. Shown on the card; keep it free of jargon. */
  description: string;
  category: BlogCategory;
  art: BlogArtId;
  /** Whole minutes, rounded up from the word count at about 200 words a minute. */
  readMinutes: number;
  /** ISO date (YYYY-MM-DD) of the last substantive edit. */
  updated: string;
};

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  voice: "Voice",
  surfaces: "Surfaces",
  architecture: "Architecture",
  design: "Design",
};

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "realtime-voice",
    title: "Talking to Organic LLM",
    description:
      "How a spoken conversation reaches the same memory, tools and threads as the text chat: OpenAI's Realtime API at the edges, our own agent in the middle.",
    category: "voice",
    art: "voice",
    readMinutes: 8,
    updated: "2026-11-18",
  },
  {
    slug: "core-input-v3",
    title: "CoreInput v3",
    description:
      "Rebuilding the message box: what went wrong on a phone, the editors we weighed, and the one-line-to-stacked design that replaced it.",
    category: "design",
    art: "composer",
    readMinutes: 6,
    updated: "2026-11-18",
  },
  {
    slug: "surfaces",
    title: "Surfaces",
    description:
      "Seven ways to work in Organic LLM, from everyday chat to branching research and meal planning, and what each one is for.",
    category: "surfaces",
    art: "surfaces",
    readMinutes: 4,
    updated: "2026-11-18",
  },
  {
    slug: "how-we-secure-memory",
    title: "How we protect your memories",
    description:
      "What we encrypt, who can read what, and where the protection stops. Written for everyone.",
    category: "architecture",
    art: "vault",
    readMinutes: 5,
    updated: "2026-11-18",
  },
  {
    slug: "memory-encryption",
    title: "Memory encryption, in depth",
    description:
      "The options we weighed, the design we chose and how it rolls out safely. The engineer's version of the memory post.",
    category: "architecture",
    art: "memory",
    readMinutes: 12,
    updated: "2026-11-18",
  },
  {
    slug: "chat-message-flow",
    title: "What happens when you press send",
    description:
      "Your message is saved first, the answer streams back, and a refresh in the middle doesn't lose it.",
    category: "architecture",
    art: "flow",
    readMinutes: 5,
    updated: "2026-11-18",
  },
  {
    slug: "adaptive-liquid-chrome",
    title: "A background that steps back",
    description:
      "The living backdrop dims while you type and returns slowly, so it never competes with the words.",
    category: "design",
    art: "chrome",
    readMinutes: 4,
    updated: "2026-11-18",
  },
  {
    slug: "export-prompt-presets",
    title: "Take your work to another AI",
    description:
      "One button that writes a good prompt for the tool you choose, with the context already in it.",
    category: "design",
    art: "export",
    readMinutes: 4,
    updated: "2026-11-18",
  },
];

export function blogPostHref(slug: string): string {
  return `/blog/${slug}`;
}

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/** The posts to suggest after `slug`: the next ones in editorial order, wrapping, never itself. */
export function relatedBlogPosts(slug: string, count = 2): BlogPost[] {
  const i = BLOG_POSTS.findIndex((p) => p.slug === slug);

  if (i === -1) return BLOG_POSTS.slice(0, count) as BlogPost[];

  return Array.from({ length: Math.min(count, BLOG_POSTS.length - 1) }, (_, k) => {
    return BLOG_POSTS[(i + 1 + k) % BLOG_POSTS.length];
  });
}

/** "Nov 2026" — the card and article meta both show month and year only. */
export function formatBlogDate(iso: string): string {
  const [year, month] = iso.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

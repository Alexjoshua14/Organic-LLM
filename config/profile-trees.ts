import type { ProfileTree } from "@/lib/schemas/profileTree";
import type { ProfileSummary } from "@/lib/schemas/profileSummary";

/** Your tailored info as a tiered tree (roles + signature + sections). */
const TAILORED_TREE: ProfileTree = {
  headline:
    "Architecting adaptive AI systems with world-class design and long-term vision",
  roles: ["Software engineer", "Creative technologist"],
  signature: "Building a cohesive AI ecosystem under Coalescence Labs.",
  sections: [
    {
      id: "about",
      title: "About",
      body: "I design full-stack, privacy-conscious systems that blend rigorous engineering with refined, organic interfaces. My work spans AI orchestration, memory-aware systems, and immersive UI/UX—aimed at shaping tools that elevate thinking, learning, and human potential.",
    },
    {
      id: "focus",
      title: "Focus areas",
      items: [
        "AI orchestration",
        "Full-stack systems",
        "Memory-aware AI",
        "Organic interfaces",
        "Human-centered design",
        "Next.js & Supabase",
        "Privacy-first infrastructure",
        "Future-ready engineering",
      ],
    },
  ],
};

/** Realistic placeholder for demo user (exploring the UI). */
const DEMO_TREE: ProfileTree = {
  headline: "Product designer & maker exploring AI-native tools",
  sections: [
    {
      id: "about",
      title: "About",
      body: "Demo profile for exploring the interface. In a real account, your about me can be AI-generated from your activity or written by you. Sections and focus areas are tiered so the profile can grow with richer data or LLM output.",
    },
    {
      id: "focus",
      title: "Focus areas",
      items: [
        "Design systems",
        "Prototyping",
        "AI-assisted workflows",
        "User research",
      ],
    },
    {
      id: "stack",
      title: "Stack",
      items: ["Figma", "React", "LLM APIs"],
    },
  ],
};

/** Empty / prompt-like for other real users (no tailored or demo data). */
const EMPTY_TREE: ProfileTree = {
  headline: "Member",
  sections: [
    {
      id: "about",
      title: "About",
      body: "Your about me will appear here. Generate a summary below or add your own later.",
    },
    {
      id: "focus",
      title: "Interests",
      items: ["Add interests", "skills", "topics"],
    },
  ],
};

const TAILORED_EMAIL = "alexanderjoshua@comcast.net";
const DEMO_EMAIL = "demo@example.com";

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Build a tree from flat LLM summary (for real users who generated but aren't tailored/demo).
 */
function treeFromSummary(summary: ProfileSummary): ProfileTree {
  return {
    headline: summary.headline,
    roles: undefined,
    signature: undefined,
    sections: [
      ...(summary.bio
        ? [{ id: "about", title: "About", body: summary.bio }]
        : []),
      ...(summary.tags?.length
        ? [{ id: "focus", title: "Interests", items: summary.tags }]
        : []),
    ],
  };
}

export type ProfileTreeVariant = "tailored" | "demo" | "generated" | "empty";

export function getProfileTree(
  email: string | null | undefined,
  generatedSummary?: ProfileSummary | null,
): { tree: ProfileTree; variant: ProfileTreeVariant } {
  const norm = email && typeof email === "string" ? normalizedEmail(email) : "";
  if (norm === TAILORED_EMAIL) return { tree: TAILORED_TREE, variant: "tailored" };
  if (norm === DEMO_EMAIL) return { tree: DEMO_TREE, variant: "demo" };
  if (generatedSummary?.headline)
    return { tree: treeFromSummary(generatedSummary), variant: "generated" };
  return { tree: EMPTY_TREE, variant: "empty" };
}

export function isTailoredTree(email: string | null | undefined): boolean {
  return normalizedEmail(email ?? "") === TAILORED_EMAIL;
}
export function isDemoTree(email: string | null | undefined): boolean {
  return normalizedEmail(email ?? "") === DEMO_EMAIL;
}

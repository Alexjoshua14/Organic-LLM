import type { ProfileTree } from "@/lib/schemas/profileTree";
import type { ProfileSummary } from "@/lib/schemas/profileSummary";
import { getOwnerEmail, getOwnerAbout, getOwnerTrajectory } from "./profile-overrides";

/** Tailored info as a tiered tree (roles + signature + sections). */
function buildTailoredTree(): ProfileTree {
  return {
    headline:
      "Architecting adaptive AI systems with world-class design and long-term vision",
    roles: ["Software engineer", "Creative technologist"],
    signature: "Building a cohesive AI ecosystem.",
    sections: [
      {
        id: "about",
        title: "About",
        body: getOwnerAbout(),
      },
    {
      id: "focus",
      title: "Focus areas",
      items: [
        "AI orchestration",
        "Memory-aware systems",
        "Full-stack architecture",
        "Organic interfaces",
        "Privacy-first infrastructure",
        "Agent orchestration patterns",
        "Next.js & Supabase",
      ],
    },
    {
      id: "design",
      title: "Design orientation",
      body: "Interfaces should feel alive but not noisy. Calm, powerful, intentional.",
      items: [
        "Organic-futuristic-modernism",
        "Bauhaus + Japandi restraint",
        "Dimensional dark themes with depth",
        "Generative / morphing UI",
        "Physics-informed animation",
      ],
    },
    {
      id: "kitchen",
      title: "In the Kitchen",
      body: "I approach cooking the same way I approach building software — iterative, detail-oriented, quietly ambitious. The kitchen is both laboratory and studio. Technique first, flavor depth always, aesthetics matter.",
      children: [
        {
          id: "dishes",
          title: "Recent dishes",
          items: [
            "Pear tart with laminated puff pastry",
            "Refined homemade puff pastry",
            "Black garlic salmon",
            "Dialed-in specialty espresso drinks",
          ],
        },
        {
          id: "cuisines",
          title: "Drawn to",
          items: [
            "French-inspired pastry technique",
            "Modern American flavor composition",
            "Mediterranean-leaning ingredients",
            "Deep, layered umami",
          ],
        },
      ],
    },
    {
      id: "lifestyle",
      title: "Lifestyle & Interests",
      items: [
        "Specialty coffee exploration",
        "Strength training & structured fitness",
        "Architecture & design inspiration",
        "Sci-fi reading (Carlo Rovelli, speculative futures)",
        "Local infrastructure (Raspberry Pi \"Aetherion\")",
        "Financial independence & systems thinking",
      ],
    },
    {
      id: "trajectory",
      title: "Trajectory",
      body: getOwnerTrajectory(),
    },
  ],
  };
}

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
    {
      id: "kitchen",
      title: "In the Kitchen",
      body: "Cooking is my reset button — equal parts meditative and creative. I gravitate toward simple dishes done well, with a weakness for anything involving fresh pasta or a perfectly balanced broth. Weekends usually involve a farmers market haul and whatever inspires me in the moment.",
      children: [
        {
          id: "dishes",
          title: "Recent dishes",
          items: [
            "Hand-rolled tagliatelle with brown butter and sage",
            "Slow-roasted tomato galette",
            "Miso-glazed eggplant",
            "Cold-brew tonic with house-made vanilla syrup",
          ],
        },
        {
          id: "cuisines",
          title: "Cuisines",
          items: [
            "Italian comfort",
            "Japanese-inflected home cooking",
            "Seasonal farm-to-table",
          ],
        },
      ],
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
  const ownerEmail = normalizedEmail(getOwnerEmail());
  if (norm && norm === ownerEmail) return { tree: buildTailoredTree(), variant: "tailored" };
  if (norm === DEMO_EMAIL) return { tree: DEMO_TREE, variant: "demo" };
  if (generatedSummary?.headline)
    return { tree: treeFromSummary(generatedSummary), variant: "generated" };
  return { tree: EMPTY_TREE, variant: "empty" };
}

export function isTailoredTree(email: string | null | undefined): boolean {
  return normalizedEmail(email ?? "") === normalizedEmail(getOwnerEmail());
}
export function isDemoTree(email: string | null | undefined): boolean {
  return normalizedEmail(email ?? "") === DEMO_EMAIL;
}

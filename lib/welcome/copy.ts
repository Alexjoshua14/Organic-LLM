export const welcomeCopy = {
  kicker: "Organic LLM · UI & cognition lab",
  headline: {
    line1: "An AI workspace that",
    accent: "remembers",
    line2: "how you think",
  },
  sublineSegments: [
    { type: "text", value: "More than a chat box: branch ideas into " },
    { type: "emphasis", value: "rabbit holes" },
    { type: "text", value: ", turn conversations into a " },
    { type: "emphasis", value: "memory you can browse" },
    { type: "text", value: ", and watch every tool work—" },
    { type: "emphasis", value: "encrypted at rest" },
    { type: "text", value: "." },
  ] as const,
  cta: {
    signUp: "Create account",
    signIn: "Sign in",
  },
  scrollInvite: {
    label: "Scroll to explore the workspace",
  },
  explore: {
    label: "Explore first",
    subtitle: "Public routes · no account needed",
    links: [
      {
        href: "/showcase/anatomy",
        label: "Anatomy of a response",
        description: "One turn, unpacked",
      },
      {
        href: "/showcase",
        label: "Showcase",
        description: "Public demos & memory lens",
      },
      {
        href: "/blog",
        label: "Blog",
        description: "Design & systems",
      },
      {
        href: "/good-news",
        label: "Good News",
        description: "Daily digest preview",
      },
    ],
  },
  footer: {
    organization: "Coalescence Labs",
    tagline: "Organic LLM · UI & cognition lab",
    privacy: {
      href: "/privacy-and-security",
      label: "Privacy & security",
    },
  },
  trust: {
    text: "Message content and summaries are encrypted at rest (AES-256-GCM); TLS in transit.",
  },
  features: {
    heading: "What you can work in",
    intro:
      "Three surfaces for thinking, research, and editorial work—connected by the same memory and thread model.",
    chat: {
      title: "Chat",
      summary:
        "The main assistant: threaded conversations, long-term memory, tools you can inspect, and model choice per thread.",
      showcaseLink: {
        href: "/showcase/anatomy",
        label: "See one turn unpacked",
      },
      modes: [
        {
          id: "main",
          title: "Main chat",
          body: "Your daily driver—web search, memory retrieval, Gen UI in-thread, and encrypted persistence across threads.",
          visualPlaceholder: {
            label: "Screenshot placeholder",
            hint: "Main chat thread with memory search, web search, streaming reply, and read aloud",
          },
        },
        {
          id: "arcadia",
          title: "Arcadia",
          body: "Sandbox lab on the same thread spine. Experiment with concise, tool-forward replies; stable ideas graduate to main chat.",
          visualPlaceholder: {
            label: "Screenshot placeholder",
            hint: "Arcadia mind map of how an idea loses momentum",
          },
        },
        {
          id: "noesis",
          title: "Noesis",
          body: "Starter prompts and suggested replies generated from past interactions.\nBuilt to surface what you want to discuss.",
          visualPlaceholder: {
            label: "Screenshot placeholder",
            hint: "Noesis thread with tailored starter prompts and reply suggestions",
          },
        },
      ],
    },
    rabbitHoles: {
      title: "Rabbit holes",
      body: "Branching research sessions—generated nodes, cited sources, browse and resume where you left off.",
      imageSrc: ["/images/rabbit-holes-1.png", "/images/rabbit-holes-2.png"],
      visualPlaceholder: {
        label: "Screenshot placeholder",
        hint: "Rabbit hole browse view or node graph",
      },
    },
    strata: {
      title: "Strata",
      body: "An editorial canvas—raw text through refined and elaborated sections, with AI-assisted create and update on each page.",
      visualPlaceholder: {
        label: "Screenshot placeholder",
        hint: "Strata section cards or snap-scroll editor",
      },
    },
  },
  highlights: {
    intro: "Built for work that lasts",
    items: [
      {
        id: "security",
        title: "Encrypted at rest",
        body: "Message content and summaries are encrypted with AES-256-GCM before they reach the database. TLS protects data in transit. Application-layer encryption—not end-to-end; the server processes plaintext to generate responses, but stored content stays ciphertext.",
        link: { href: "/privacy-and-security", label: "Privacy & security" },
        reverse: false,
        visualPlaceholder: {
          label: "Screenshot placeholder",
          hint: "Privacy page or ciphertext-at-rest view",
        },
      },
      {
        id: "streaming",
        title: "Pick up where you left off",
        body: "Active streams persist server-side. Refresh the page or reconnect from another device—the same response continues over resumable SSE instead of starting over.",
        reverse: true,
        visualPlaceholder: {
          label: "Screenshot placeholder",
          hint: "Chat mid-stream or resume after refresh",
        },
      },
      {
        id: "models",
        title: "Your model, your turn",
        body: "Choose a model per message from the gateway catalog, or use Auto to resolve by task. Supported models can show a zero-data-retention indicator when available.",
        reverse: false,
        visualPlaceholder: {
          label: "Screenshot placeholder",
          hint: "Composer model picker with Auto and gateway models",
        },
      },
      {
        id: "gen-ui",
        title: "Structured answers you can scan",
        body: "The assistant can render answer cards, decision matrices, plan timelines, and live tool states in-thread—not only markdown walls. You see what ran and what it returned.",
        link: { href: "/showcase/anatomy", label: "Anatomy of a response" },
        reverse: true,
        visualPlaceholder: {
          label: "Screenshot placeholder",
          hint: "In-thread Gen UI block from chat or showcase",
        },
      },
    ],
  },
  sidebar: "Sign in to pick up your threads, memory, and rabbit holes.",
  meta: {
    title: "Organic LLM — an AI workspace with memory",
    description:
      "More than chat: branch research into rabbit holes, build a memory you can browse, and inspect every tool—encrypted at rest.",
  },
} as const;

export type WelcomeHighlightItem = (typeof welcomeCopy.highlights.items)[number];

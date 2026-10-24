import type { UIMessage } from "ai";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

const ROOT_NODE_ID = "550e8400-e29b-41d4-a716-446655440001";
const BRANCH_NODE_ID = "550e8400-e29b-41d4-a716-446655440002";

/** Short thread for {@link ChatThread} in the morph sandbox (no `useChat`). */
export const MORPH_CHAT_RABBIT_MESSAGES: UIMessage[] = [
  {
    id: "morph-msg-u1",
    role: "user",
    parts: [{ type: "text", text: "What is decentralized consensus?" }],
  },
  {
    id: "morph-msg-a1",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Decentralized consensus lets independent nodes agree on a single ordering of events without a central authority. Practical systems balance safety, liveness, and fault tolerance; understanding trade-offs helps when you design or evaluate protocols.",
      },
    ],
  },
];

const ARTICLE_HTML = `
<h2>Why consensus matters</h2>
<p>In open networks, participants may fail, lie, or lose connectivity. Consensus protocols define when a value is considered decided and how new values are committed.</p>
<h2>Common families</h2>
<p>Classical BFT-style protocols target a fixed committee; Nakamoto-style consensus uses longest-chain incentives. Hybrid designs appear in modern L1s and rollups.</p>
<p>This sandbox article is static HTML for layout morphing only.</p>
`.trim();

/** Minimal session for {@link RabbitHolePathRail}, {@link RabbitHoleArticle}, and right column. */
export const MORPH_CHAT_RABBIT_SESSION: RabbitHoleSession = {
  sessionId: "650e8400-e29b-41d4-a716-446655440000",
  rootQuestion: "What is decentralized consensus?",
  rootNodeId: ROOT_NODE_ID,
  path: [
    {
      nodeId: ROOT_NODE_ID,
      label: "What is decentralized consensus?",
      parentNodeId: null,
    },
    {
      nodeId: BRANCH_NODE_ID,
      label: "BFT vs longest-chain trade-offs",
      parentNodeId: ROOT_NODE_ID,
    },
  ],
  nodesById: {
    [ROOT_NODE_ID]: {
      id: ROOT_NODE_ID,
      title: "Decentralized consensus overview",
      rawPrompt: "demo",
      userQuestion: "What is decentralized consensus?",
      refinedQuestion: null,
      preview: null,
      keyTakeaways: [
        "Agreement without a central party is the core problem.",
        "Fault models (crash vs Byzantine) shape what is provable.",
        "Performance and decentralization pull in opposite directions.",
      ],
      articleHtml: "<p>Root node article omitted in demo; open the branch for full article.</p>",
      sources: [],
      branchSuggestions: [],
      createdAt: new Date().toISOString(),
    },
    [BRANCH_NODE_ID]: {
      id: BRANCH_NODE_ID,
      title: "Consensus families in practice",
      rawPrompt: "demo",
      userQuestion: "Compare BFT-style and Nakamoto-style consensus.",
      refinedQuestion: null,
      preview: null,
      keyTakeaways: [
        "BFT protocols finalize quickly with explicit quorum votes.",
        "Nakamoto consensus ties finality to cumulative work and probabilistic depth.",
        "Operator goals—latency, decentralization, accountability—drive the choice.",
      ],
      articleHtml: ARTICLE_HTML,
      sources: [
        {
          status: "complete",
          id: "src-1",
          title: "Example foundation: protocol comparison",
          url: "https://example.com/consensus-overview",
          faviconUrl: null,
          snippet: "High-level survey used for sandbox layout only.",
          publishedDate: null,
          author: null,
          highlights: [],
        },
      ],
      branchSuggestions: [
        {
          id: "br-1",
          label: "Latency under partial synchrony",
          shortDescription: "What happens when the network glitches but comes back?",
        },
        {
          id: "br-2",
          label: "Energy and participation",
          shortDescription: "Incentive alignment vs operational cost.",
        },
      ],
      createdAt: new Date().toISOString(),
    },
  },
  activeNodeId: BRANCH_NODE_ID,
  generatingNodeId: null,
  generationStep: null,
  edges: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MORPH_CHAT_RABBIT_ACTIVE_NODE_ID = BRANCH_NODE_ID;

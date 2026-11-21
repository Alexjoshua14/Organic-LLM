/**
 * Per-archetype state catalogs for the Gen UI Lab gallery.
 * Each preset is a full block so browsing the lab shows the range of each component —
 * not only the single default fixture.
 */

import type { GenUIBlock } from "@/lib/schemas/gen-ui";
import type { GenUIBlockType } from "@/lib/schemas/gen-ui/shared";

import {
  FIXTURE_ANSWER_CARD,
  FIXTURE_AUDIO_SNIPPET,
  FIXTURE_AUDIT_LINE,
  FIXTURE_CONTEXT_SWITCHBOARD,
  FIXTURE_ERGON_BOARD,
  FIXTURE_ERGON_PROPOSAL,
  FIXTURE_HYP_GRAPH,
  FIXTURE_MEASURE,
  FIXTURE_PLAN_TIMELINE,
  FIXTURE_PREVIEW_BLOB,
  FIXTURE_PROFILE_MAP,
  FIXTURE_PROGRESS_TRACK,
  FIXTURE_PROMPT_FIELD,
  FIXTURE_RECIPE_CARD,
  FIXTURE_RESEARCH_REPORT,
  FIXTURE_RESTAURANT_CARD,
  FIXTURE_RIPPLE_PREVIEW,
  FIXTURE_SHOPPING_LIST,
  FIXTURE_STATE_DIAGRAM,
} from "@/lib/schemas/gen-ui/fixtures";

export type GenUiShowcasePreset = {
  id: string;
  name: string;
  intent: string;
  block: GenUIBlock;
};

/**
 * Types with their own lab demos (arrangements / languages / diagrams) are omitted —
 * those pages already cycle presentation states.
 */
export const GEN_UI_LAB_SHOWCASE_TYPES = [
  "answer-card",
  "plan-timeline",
  "audio-snippet",
  "recipe-card",
  "shopping-list",
  "restaurant-card",
  "research-report",
  "measure",
  "profile-map",
  "ergon-board",
  "ergon-proposal",
  "state-diagram",
  "prompt-field",
  "progress-track",
  "context-switchboard",
  "ripple-preview",
  "hyp-graph",
  "audit-line",
  "preview-blob",
] as const satisfies ReadonlyArray<GenUIBlockType>;

export type GenUiShowcaseType = (typeof GEN_UI_LAB_SHOWCASE_TYPES)[number];

export function isGenUiShowcaseType(type: string): type is GenUiShowcaseType {
  return (GEN_UI_LAB_SHOWCASE_TYPES as readonly string[]).includes(type);
}

const SHOWCASES: Record<GenUiShowcaseType, readonly GenUiShowcasePreset[]> = {
  "answer-card": [
    {
      id: "full",
      name: "Full answer",
      intent: "TL;DR, key points, collapsible section, confidence and sources.",
      block: FIXTURE_ANSWER_CARD,
    },
    {
      id: "high-confidence",
      name: "High confidence",
      intent: "Strong footer signal with open detail and no caveats.",
      block: {
        type: "answer-card",
        version: 1,
        title: "Use dual-write for the cutover",
        tldr: "Mirror writes for two weeks, gate the flip on search parity, then drop the legacy index.",
        keyPoints: [
          "Dual-write buys a clean rollback path.",
          "Parity dashboards are the only go/no-go signal.",
          "Keep read feature flags for 48 hours after flip.",
        ],
        sections: [
          {
            heading: "Why not big-bang?",
            body: "A single cutover collapses rollback into a restore. Dual-write keeps both stores warm until the new path proves itself under real traffic.",
            defaultOpen: true,
          },
        ],
        footer: {
          confidence: "high",
          sources: [{ label: "Migration runbook", url: "https://example.com/runbook" }],
          caveats: undefined,
        },
      },
    },
    {
      id: "minimal",
      name: "Minimal",
      intent: "Tight card — one point, no sections or footer.",
      block: {
        type: "answer-card",
        version: 1,
        title: "Quick take",
        tldr: "Ship the gallery states before wiring Mem0 writes.",
        keyPoints: ["Pre-populated fixtures make the lab self-explanatory."],
      },
    },
    {
      id: "low-confidence",
      name: "Low confidence",
      intent: "Caveats forward when the model is unsure.",
      block: {
        type: "answer-card",
        version: 1,
        title: "Estimate only",
        tldr: "Rome’s share of world population is roughly one fifth — figures vary by source.",
        keyPoints: [
          "Ancient demographics are reconstructed, not counted.",
          "Use a range, not a single point, in the measure block.",
        ],
        footer: {
          confidence: "low",
          caveats: ["Population totals for 117 CE differ by tens of millions across historians."],
        },
      },
    },
  ],

  "plan-timeline": [
    {
      id: "mid-flight",
      name: "Mid-flight",
      intent: "Done, now, next, and blocked in one plan.",
      block: FIXTURE_PLAN_TIMELINE,
    },
    {
      id: "all-done",
      name: "All done",
      intent: "Completed plan — every step checked.",
      block: {
        type: "plan-timeline",
        version: 1,
        title: "Gen UI Lab polish",
        steps: [
          { id: "a", label: "Schema + registry", status: "done" },
          { id: "b", label: "Showcase states", status: "done" },
          { id: "c", label: "Unit coverage", status: "done" },
        ],
      },
    },
    {
      id: "blocked",
      name: "Blocked heavy",
      intent: "Dependencies and blockers dominate the board.",
      block: {
        type: "plan-timeline",
        version: 1,
        title: "Speak release",
        steps: [
          { id: "voice", label: "Realtime voice path", status: "done" },
          {
            id: "tts",
            label: "TTS UX sign-off",
            status: "blocked",
            note: "Waiting on design review",
          },
          {
            id: "ship",
            label: "Ship Speak v2",
            status: "next",
            dependsOn: ["tts"],
            estimate: "2d",
          },
        ],
      },
    },
    {
      id: "fresh",
      name: "Just started",
      intent: "First step in progress; the rest still next.",
      block: {
        type: "plan-timeline",
        version: 1,
        title: "Sunday dinner",
        steps: [
          {
            id: "shop",
            label: "Shop",
            status: "now",
            time: "10:00 AM",
            substeps: [
              { label: "Produce", done: false },
              { label: "Dairy", done: false },
            ],
          },
          { id: "prep", label: "Prep", status: "next", time: "2:00 PM", estimate: "45m" },
          { id: "cook", label: "Cook", status: "next", time: "5:30 PM" },
        ],
      },
    },
  ],

  "audio-snippet": [
    {
      id: "concise",
      name: "Concise recap",
      intent: "Short teaser and script — the default listen card.",
      block: FIXTURE_AUDIO_SNIPPET,
    },
    {
      id: "warm",
      name: "Warm narrative",
      intent: "Longer script with a conversational tone.",
      block: {
        type: "audio-snippet",
        version: 1,
        preview: {
          title: "Evening kitchen brief",
          teaser: "What Remy knows about tonight — timing, leftovers, and who is coming.",
          duration: "~2:45",
        },
        script:
          "Tonight is a quiet cook for two. Remy already pulled the lemon bars recipe and marked butter as needed. If Maya is joining after seven, keep the greens cold until plating. Your Sunday batch from last week still covers tomorrow's lunch.",
        meta: { tone: "warm", voice: "default" },
      },
    },
    {
      id: "bare",
      name: "Bare preview",
      intent: "Title and teaser only duration omitted.",
      block: {
        type: "audio-snippet",
        version: 1,
        preview: {
          title: "One beat",
          teaser: "Ship the living profile map before Mem0 writes.",
        },
        script: "ProfileTree first. Memory writes second.",
      },
    },
  ],

  "recipe-card": [
    {
      id: "full",
      name: "Full recipe",
      intent: "Servings, times, ingredients, steps, and notes.",
      block: FIXTURE_RECIPE_CARD,
    },
    {
      id: "weeknight",
      name: "Weeknight short",
      intent: "Few ingredients, no notes — cook for one.",
      block: {
        type: "recipe-card",
        version: 1,
        title: "Garlic oil pasta",
        servings: "1 bowl",
        prepTime: "5 min",
        cookTime: "12 min",
        ingredients: [
          { name: "spaghetti", quantity: "100", unit: "g" },
          { name: "garlic", quantity: "3", unit: "cloves" },
          { name: "olive oil", quantity: "2", unit: "tbsp" },
          { name: "chili flakes", quantity: "1", unit: "pinch" },
        ],
        steps: [
          "Boil pasta in salted water.",
          "Warm oil with sliced garlic and chili until fragrant.",
          "Toss drained pasta with oil; finish with pasta water.",
        ],
      },
    },
  ],

  "shopping-list": [
    {
      id: "mixed",
      name: "Have / need mix",
      intent: "Some pantry items already home; others still to buy.",
      block: FIXTURE_SHOPPING_LIST,
    },
    {
      id: "all-need",
      name: "Empty fridge",
      intent: "Everything still needed — nothing checked.",
      block: {
        type: "shopping-list",
        version: 1,
        title: "First shop of the week",
        groups: [
          {
            category: "Produce",
            items: [
              { name: "spinach", quantity: "1", unit: "bag", status: "need" },
              { name: "lemons", quantity: "4", status: "need" },
            ],
          },
          {
            category: "Dairy",
            items: [{ name: "eggs", quantity: "12", status: "need" }],
          },
        ],
      },
    },
    {
      id: "almost-done",
      name: "Almost done",
      intent: "Mostly checked off mid-aisle.",
      block: {
        type: "shopping-list",
        version: 1,
        title: "Saturday run",
        groups: [
          {
            category: "Produce",
            items: [
              { name: "blueberries", quantity: "1", unit: "pint", status: "need", checked: true },
              { name: "mixed greens", quantity: "1", unit: "bag", status: "need", checked: true },
              { name: "basil", status: "need", checked: false },
            ],
          },
          {
            category: "Pantry",
            items: [
              { name: "poppy seeds", status: "have", checked: true },
              { name: "sugar", quantity: "1", unit: "bag", status: "need", checked: false },
            ],
          },
        ],
      },
    },
  ],

  "restaurant-card": [
    {
      id: "full",
      name: "Full venue",
      intent: "Hero, ratings, hours, menu, popular times, links.",
      block: FIXTURE_RESTAURANT_CARD,
    },
    {
      id: "cafe",
      name: "Compact cafe",
      intent: "Smaller card — rating, hours, short menu, no gallery crush.",
      block: {
        type: "restaurant-card",
        version: 1,
        name: "Sightglass Coffee",
        storeType: "cafe",
        summary: "Roastery cafe with bright pour-overs and a short pastry case.",
        address: "270 7th St, San Francisco, CA 94103",
        rating: {
          average: 4.3,
          reviewCount: 1204,
          sources: [{ name: "google", rating: 4.3, reviewCount: 1204 }],
        },
        heroImage: {
          url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
          alt: "Cafe counter with pour-over gear",
          kind: "interior",
        },
        hours: {
          timezone: "America/Los_Angeles",
          regular: [
            { day: "monday", open: "7:00 AM", close: "6:00 PM" },
            { day: "tuesday", open: "7:00 AM", close: "6:00 PM" },
            { day: "wednesday", open: "7:00 AM", close: "6:00 PM" },
            { day: "thursday", open: "7:00 AM", close: "6:00 PM" },
            { day: "friday", open: "7:00 AM", close: "6:00 PM" },
            { day: "saturday", open: "8:00 AM", close: "6:00 PM" },
            { day: "sunday", open: "8:00 AM", close: "5:00 PM" },
          ],
        },
        menu: {
          lastUpdated: "2026-09-01",
          sections: [
            {
              name: "Coffee",
              items: [
                { name: "Pour over", price: "$6" },
                { name: "Espresso", price: "$4" },
              ],
            },
          ],
        },
        links: {
          website: "https://sightglasscoffee.com",
        },
      },
    },
  ],

  "research-report": [
    {
      id: "full",
      name: "Full report",
      intent: "Synopses, takeaways, quoted evidence, and claim issues.",
      block: FIXTURE_RESEARCH_REPORT,
    },
    {
      id: "thin",
      name: "Thin report",
      intent: "One source, one claim — lighter Lyra output.",
      block: {
        type: "research-report",
        version: 1,
        threadId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        title: "Does dual-write help rollback?",
        summary: "One runbook supports dual-write for rollback; evidence is thin.",
        sources: [
          {
            id: "src-runbook",
            url: "https://example.com/migration-runbook",
            title: "Zero-downtime store migrations",
            provider: "exa",
            fetchedAt: "2026-11-02T18:04:00Z",
            publishedAt: "2026-03-14",
            excerptOnly: false,
            truncated: false,
            capturedChars: 8200,
            pages: [],
            preview: "Dual-write for two weeks, then flip reads.",
            synopsis: "Phased cutover with parity checks.",
            takeaways: ["Keep a feature flag on the read path."],
          },
        ],
        claims: [
          {
            id: "claim-1",
            statement: "Dual-write reduces rollback risk.",
            assessment: "Supported by the runbook.",
            issues: [],
            evidence: [
              {
                sourceId: "src-runbook",
                title: "Zero-downtime store migrations",
                url: "https://example.com/migration-runbook",
                quote: "Either store can serve reads at any point during the window.",
                quoteTruncated: false,
                relation: "supports",
              },
            ],
          },
        ],
        limitations: ["Single source."],
      },
    },
  ],

  measure: [
    {
      id: "share-scale",
      name: "Shared scale",
      intent: "Points and ranges on one domain — the classic measure.",
      block: FIXTURE_MEASURE,
    },
    {
      id: "ranges-only",
      name: "Uncertainty bands",
      intent: "Estimate ranges without pinning a single value.",
      block: {
        type: "measure",
        version: 1,
        title: "Ancient population share",
        subtitle: "Wide bands where sources disagree",
        domain: { min: 0, max: 40 },
        unit: "%",
        rows: [
          {
            id: "rome",
            label: "Rome peak",
            range: [15, 30],
            tone: "action",
            note: "Historians disagree on the denominator",
          },
          { id: "han", label: "Han China", range: [20, 28], tone: "accent" },
          { id: "india", label: "Classical India", range: [18, 26], tone: "muted" },
        ],
        variant: "scale",
        size: "md",
        footnote: "Bands are illustrative for the lab.",
      },
    },
    {
      id: "scores",
      name: "Scorecard",
      intent: "Few rows, accent vs muted — decision support.",
      block: {
        type: "measure",
        version: 1,
        title: "Plan fit scores",
        domain: { min: 0, max: 10 },
        unit: "",
        ticks: [0, 2.5, 5, 7.5, 10],
        rows: [
          { id: "team", label: "Team plan", value: 8.5, tone: "accent", note: "Best seat math" },
          { id: "pro", label: "Pro plan", value: 6, tone: "muted" },
          { id: "ent", label: "Enterprise", value: 3.5, tone: "action", note: "Overkill under 8 seats" },
        ],
        variant: "scale",
        size: "md",
      },
    },
    {
      id: "single",
      name: "Single gauge",
      intent: "One row — progress-like reading on a shared scale.",
      block: {
        type: "measure",
        version: 1,
        title: "Cutover readiness",
        domain: { min: 0, max: 100 },
        unit: "%",
        rows: [{ id: "ready", label: "Parity checks green", value: 74, tone: "accent" }],
        variant: "scale",
        size: "md",
        footnote: "Flip when this clears 90%.",
      },
    },
  ],

  "profile-map": [
    {
      id: "showcase",
      name: "Living showcase",
      intent: "Multi-domain Organic profile — people, projects, goals, tools.",
      block: FIXTURE_PROFILE_MAP,
    },
    {
      id: "starter",
      name: "Starter map",
      intent: "Sparse graph a new profile might begin with.",
      block: {
        type: "profile-map",
        version: 1,
        title: "New profile",
        domains: [{ id: "build", label: "Building", tone: "accent" }],
        nodes: [
          {
            id: "you",
            kind: "person",
            title: "You",
            domain: "build",
            complexity: 2,
            status: "active",
            dependencies: [],
            confidence: 0.7,
            evidence: [],
            summary: "Just getting started.",
          },
          {
            id: "first",
            kind: "project",
            title: "First project",
            domain: "build",
            complexity: 2,
            status: "idea",
            dependencies: ["you"],
            confidence: 0.5,
            evidence: [],
          },
        ],
      },
    },
    {
      id: "statuses",
      name: "Status mix",
      intent: "Active, paused, done, and idea nodes together.",
      block: {
        type: "profile-map",
        version: 1,
        title: "Status showcase",
        domains: [
          { id: "build", label: "Building", tone: "accent" },
          { id: "life", label: "Life", tone: "muted" },
        ],
        nodes: [
          {
            id: "ship",
            kind: "goal",
            title: "Ship gen-UI lab states",
            domain: "build",
            complexity: 3,
            status: "active",
            dependencies: [],
            confidence: 0.9,
            evidence: [],
          },
          {
            id: "ergon",
            kind: "goal",
            title: "Ergon write path",
            domain: "build",
            complexity: 4,
            status: "paused",
            dependencies: ["ship"],
            confidence: 0.6,
            evidence: [],
          },
          {
            id: "old",
            kind: "project",
            title: "Legacy TTS pipeline",
            domain: "build",
            complexity: 2,
            status: "done",
            dependencies: [],
            confidence: 0.95,
            evidence: [],
            summary: "Superseded by Realtime Speak.",
          },
          {
            id: "run",
            kind: "goal",
            title: "Run streak",
            domain: "life",
            complexity: 1,
            status: "idea",
            dependencies: [],
            confidence: 0.4,
            evidence: [],
          },
        ],
      },
    },
  ],

  "ergon-board": [
    {
      id: "preview",
      name: "Light preview",
      intent: "Two columns with a todo and a ticket.",
      block: FIXTURE_ERGON_BOARD,
    },
    {
      id: "full-board",
      name: "Full board",
      intent: "Every column type and priority mix.",
      block: {
        type: "ergon-board",
        version: 1,
        title: "Ergon · Week",
        columns: [
          { id: "backlog", label: "Backlog" },
          { id: "ready", label: "Ready" },
          { id: "active", label: "Active" },
          { id: "review", label: "Review" },
          { id: "done", label: "Done" },
        ],
        items: [
          {
            id: "b1",
            source: "todo",
            title: "Sketch Stage space contract",
            state: "Backlog",
            stateType: "backlog",
            priority: "low",
            group: "Stage",
          },
          {
            id: "r1",
            source: "todo",
            title: "Capture lab screenshots",
            state: "Ready",
            stateType: "ready",
            priority: "medium",
            estMinutes: 20,
          },
          {
            id: "COA-191",
            source: "ticket",
            title: "Ship measure and profile-map",
            state: "Active",
            stateType: "active",
            priority: "high",
            group: "Gen UI",
            assignee: "Alex",
          },
          {
            id: "COA-200",
            source: "ticket",
            title: "Lab state showcase",
            state: "In Review",
            stateType: "review",
            priority: "urgent",
            group: "Gen UI",
            assignee: "Alex",
          },
          {
            id: "d1",
            source: "todo",
            title: "Reset fixtures button",
            state: "Done",
            stateType: "done",
            priority: "none",
          },
        ],
        activeColumn: "active",
        footnote: "Synthetic week board for the lab.",
      },
    },
    {
      id: "emptyish",
      name: "Sparse",
      intent: "One ready item — quiet board.",
      block: {
        type: "ergon-board",
        version: 1,
        title: "Ergon · Quiet",
        columns: [
          { id: "ready", label: "Ready" },
          { id: "active", label: "Active" },
        ],
        items: [
          {
            id: "only",
            source: "todo",
            title: "Open the Gen UI Lab",
            state: "Ready",
            stateType: "ready",
            priority: "medium",
          },
        ],
      },
    },
  ],

  "ergon-proposal": [
    {
      id: "complete",
      name: "Complete one",
      intent: "Single consent gate to mark a todo done.",
      block: FIXTURE_ERGON_PROPOSAL,
    },
    {
      id: "multi",
      name: "Multi-change",
      intent: "Create, update, comment — review before apply.",
      block: {
        type: "ergon-proposal",
        version: 1,
        title: "Apply Ergon batch?",
        source: "ticket",
        changes: [
          {
            id: "c1",
            op: "create",
            title: "File follow-up for Mem0 writes",
            fields: [
              { name: "state", to: "Ready" },
              { name: "priority", to: "high" },
            ],
          },
          {
            id: "c2",
            op: "update",
            targetId: "COA-191",
            title: "Ship measure and profile-map",
            fields: [{ name: "state", from: "Active", to: "In Review" }],
          },
          {
            id: "c3",
            op: "comment",
            targetId: "COA-191",
            title: "Ship measure and profile-map",
            fields: [{ name: "comment", to: "Lab showcase states landed; preview ready." }],
          },
        ],
      },
    },
  ],

  "state-diagram": [
    {
      id: "release",
      name: "Release gate",
      intent: "Linear flow with a changes-requested loop.",
      block: FIXTURE_STATE_DIAGRAM,
    },
    {
      id: "toggle",
      name: "Two-state toggle",
      intent: "Smallest useful diagram.",
      block: {
        type: "state-diagram",
        version: 1,
        title: "Feature flag",
        states: [
          { id: "off", label: "Off" },
          { id: "on", label: "On" },
        ],
        transitions: [
          { from: "off", to: "on", label: "enable" },
          { from: "on", to: "off", label: "disable" },
        ],
      },
    },
    {
      id: "branchy",
      name: "Branchy",
      intent: "Fan-out and merge — denser transition set.",
      block: {
        type: "state-diagram",
        version: 1,
        title: "Support ticket",
        states: [
          { id: "new", label: "New" },
          { id: "triage", label: "Triage" },
          { id: "eng", label: "Engineering" },
          { id: "billing", label: "Billing" },
          { id: "done", label: "Resolved" },
        ],
        transitions: [
          { from: "new", to: "triage" },
          { from: "triage", to: "eng", label: "bug" },
          { from: "triage", to: "billing", label: "invoice" },
          { from: "eng", to: "done" },
          { from: "billing", to: "done" },
          { from: "eng", to: "triage", label: "needs info" },
        ],
        footnote: "Tap a state to highlight its edges.",
      },
    },
  ],

  "prompt-field": [
    {
      id: "drafted",
      name: "Draft + chips",
      intent: "Pre-filled prompt with toggleable suggestions.",
      block: FIXTURE_PROMPT_FIELD,
    },
    {
      id: "empty",
      name: "Empty canvas",
      intent: "Placeholder only — chips seed the draft.",
      block: {
        type: "prompt-field",
        version: 1,
        title: "Ask Remy",
        default: "",
        placeholder: "What should we cook with what’s left?",
        suggestions: [
          { label: "Use leftovers", insertionText: "Prefer ingredients I already have." },
          { label: "Under 30 min", insertionText: "Keep total time under 30 minutes." },
          { label: "No dairy", insertionText: "Skip dairy entirely." },
        ],
        footnote: "Chips toggle in and out of the draft.",
      },
    },
    {
      id: "long",
      name: "Long draft",
      intent: "Multi-sentence default — editing a richer brief.",
      block: {
        type: "prompt-field",
        version: 1,
        title: "Steer Arcadia",
        default:
          "Rewrite the last answer for a designer. Lead with the visual constraint, then the interaction, then the edge case. Keep confidence language honest.",
        suggestions: [
          { label: "Shorter", insertionText: "Cut to three sentences." },
          { label: "Add example", insertionText: "Include one concrete UI example." },
        ],
      },
    },
  ],

  "progress-track": [
    {
      id: "mid",
      name: "Mid progress",
      intent: "Bar between milestones with labels.",
      block: FIXTURE_PROGRESS_TRACK,
    },
    {
      id: "start",
      name: "Just started",
      intent: "Early fill — first milestone still ahead.",
      block: {
        type: "progress-track",
        version: 1,
        title: "ProfileTree rollout",
        total: 100,
        current: 8,
        unit: "%",
        milestones: [
          { label: "Schema", value: 20 },
          { label: "Lab", value: 50 },
          { label: "Chat", value: 80 },
          { label: "Mem0", value: 100 },
        ],
      },
    },
    {
      id: "complete",
      name: "Complete",
      intent: "Filled to the end.",
      block: {
        type: "progress-track",
        version: 1,
        title: "Migration cutover",
        total: 100,
        current: 100,
        unit: "%",
        milestones: [
          { label: "Shadow", value: 25 },
          { label: "Dual-write", value: 50 },
          { label: "Cutover", value: 75 },
          { label: "Cleanup", value: 100 },
        ],
        footnote: "Cleanup complete — legacy path retired.",
      },
    },
    {
      id: "plain",
      name: "No milestones",
      intent: "Bare bar — current vs total only.",
      block: {
        type: "progress-track",
        version: 1,
        title: "Upload",
        total: 40,
        current: 18,
        unit: " MB",
        milestones: [],
      },
    },
  ],

  "context-switchboard": [
    {
      id: "all-on",
      name: "All included",
      intent: "Memories, files, and assumptions shaping the answer.",
      block: FIXTURE_CONTEXT_SWITCHBOARD,
    },
    {
      id: "mixed",
      name: "Mixed toggles",
      intent: "Some context already excluded before rerun.",
      block: {
        type: "context-switchboard",
        version: 1,
        title: "What shaped this answer",
        question: "Would the recommendation change without the March budget?",
        items: [
          {
            id: "mem-budget",
            kind: "memory",
            label: "Budget cap from March",
            detail: "“Keep monthly spend under $40.”",
            included: false,
          },
          {
            id: "file-plan",
            kind: "file",
            label: "pricing-notes.md",
            included: true,
          },
          {
            id: "assume-flat",
            kind: "assumption",
            label: "Usage stays flat",
            included: true,
          },
          {
            id: "other-team",
            kind: "other",
            label: "Seat count from last standup",
            detail: "~6 active seats",
            included: true,
          },
        ],
        footnote: "Toggle off, then rerun — nothing is deleted.",
      },
    },
    {
      id: "memory-heavy",
      name: "Memory heavy",
      intent: "Mostly Mem0-shaped context.",
      block: {
        type: "context-switchboard",
        version: 1,
        title: "Memories in play",
        items: [
          {
            id: "m1",
            kind: "memory",
            label: "Cooks for one on weeknights",
            included: true,
          },
          {
            id: "m2",
            kind: "memory",
            label: "Sunday batch cooking",
            included: true,
          },
          {
            id: "m3",
            kind: "memory",
            label: "Avoids dairy some weeks",
            detail: "Not a hard allergy",
            included: false,
          },
        ],
      },
    },
  ],

  "ripple-preview": [
    {
      id: "approved",
      name: "All approved",
      intent: "Cascading blocked + stale effects ready to apply.",
      block: FIXTURE_RIPPLE_PREVIEW,
    },
    {
      id: "kinds",
      name: "Every ripple kind",
      intent: "blocked, stale, update, warning, info — mixed approval.",
      block: {
        type: "ripple-preview",
        version: 1,
        title: "Ripple preview",
        change: {
          summary: "Rename project “Arcadia” → “Arcadia chat”",
          detail: "ProfileTree + Ergon titles",
        },
        ripples: [
          {
            id: "b",
            kind: "blocked",
            label: "Docs freeze waits on rename PR",
            approved: true,
          },
          {
            id: "s",
            kind: "stale",
            label: "Launch note still says Arcadia",
            approved: true,
          },
          {
            id: "u",
            kind: "update",
            label: "Update Ergon ticket titles",
            detail: "3 tickets match",
            approved: true,
          },
          {
            id: "w",
            kind: "warning",
            label: "External bookmark may 404",
            approved: false,
          },
          {
            id: "i",
            kind: "info",
            label: "Vercel preview host unchanged",
            approved: true,
          },
        ],
        footnote: "Uncheck anything you do not want applied.",
      },
    },
  ],

  "hyp-graph": [
    {
      id: "causal",
      name: "Causal fork",
      intent: "Usage → cost → plan recommendation.",
      block: FIXTURE_HYP_GRAPH,
    },
    {
      id: "chain",
      name: "Linear chain",
      intent: "Simple A → B → C hypothesis.",
      block: {
        type: "hyp-graph",
        version: 1,
        title: "Why dual-write first",
        nodes: [
          { id: "risk", label: "Rollback risk high", tone: "action" },
          { id: "dual", label: "Dual-write buys time", tone: "accent" },
          { id: "flip", label: "Flip after parity", tone: "accent" },
        ],
        edges: [
          { from: "risk", to: "dual", weight: 0.9 },
          { from: "dual", to: "flip", weight: 0.85, label: "once green" },
        ],
      },
    },
    {
      id: "compete",
      name: "Competing paths",
      intent: "Two muted alternatives under one claim.",
      block: {
        type: "hyp-graph",
        version: 1,
        title: "Where to host Stage",
        nodes: [
          { id: "need", label: "Need spatial canvas", tone: "accent" },
          { id: "inapp", label: "In-app Stage", tone: "accent", detail: "Shares auth + gen-UI" },
          { id: "excalidraw", label: "External board", tone: "muted" },
          { id: "figma", label: "Figma only", tone: "muted" },
        ],
        edges: [
          { from: "need", to: "inapp", weight: 0.85 },
          { from: "need", to: "excalidraw", weight: 0.4, label: "fast but siloed" },
          { from: "need", to: "figma", weight: 0.25, label: "design-only" },
        ],
        footnote: "Tap a node to walk its edges.",
      },
    },
  ],

  "audit-line": [
    {
      id: "turn",
      name: "Full turn",
      intent: "User → retrieve → draft → render.",
      block: FIXTURE_AUDIT_LINE,
    },
    {
      id: "short",
      name: "Short",
      intent: "Two events — minimal audit.",
      block: {
        type: "audit-line",
        version: 1,
        title: "How this answer was built",
        events: [
          {
            time: "09:14:02",
            actor: "user",
            action: "ask",
            summary: "Show the living profile map",
          },
          {
            time: "09:14:03",
            actor: "system",
            action: "render",
            summary: "Served pre-populated profile-map fixture",
          },
        ],
      },
    },
    {
      id: "long",
      name: "Long trail",
      intent: "More actors and actions across a denser turn.",
      block: {
        type: "audit-line",
        version: 1,
        title: "Steer + tools",
        events: [
          {
            time: "16:40:01",
            actor: "user",
            action: "ask",
            summary: "Compare Team vs Enterprise",
          },
          {
            time: "16:40:02",
            actor: "system",
            action: "steer",
            summary: "Applied steer: prefer seat math",
          },
          {
            time: "16:40:04",
            actor: "Lyra",
            action: "retrieve",
            summary: "Loaded pricing notes",
          },
          {
            time: "16:40:07",
            actor: "Arcadia",
            action: "tool",
            summary: "render_gen_ui · measure",
          },
          {
            time: "16:40:08",
            actor: "Arcadia",
            action: "tool",
            summary: "render_gen_ui · hyp-graph",
          },
          {
            time: "16:40:09",
            actor: "system",
            action: "render",
            summary: "Attached both blocks to the turn",
          },
        ],
      },
    },
  ],

  "preview-blob": [
    {
      id: "full",
      name: "Preview + expand",
      intent: "Thumbnail, expanded URL, prompt, and cost hint.",
      block: FIXTURE_PREVIEW_BLOB,
    },
    {
      id: "thumb-only",
      name: "Thumbnail only",
      intent: "Cheapest preview — no expanded asset yet.",
      block: {
        type: "preview-blob",
        version: 1,
        title: "Quick sketch",
        previewURL: "https://placehold.co/240x135/png",
        prompt: "One card, muted glass, no chrome",
        costEstimate: "~$0.01 preview",
        footnote: "Commit a full render when the crop looks right.",
      },
    },
  ],
};

/** Catalog presets for a showcase archetype (immutable; first entry is the default fixture). */
export function catalogShowcases(type: GenUiShowcaseType): readonly GenUiShowcasePreset[] {
  return SHOWCASES[type];
}

/**
 * Live page presets: the current `liveBlock` (fixture or AI-generated) replaces the first
 * catalog entry so Generate updates the lead state without dropping the other states.
 */
export function showcasePresetsFor(
  type: GenUiShowcaseType,
  liveBlock: GenUIBlock
): GenUiShowcasePreset[] {
  const catalog = SHOWCASES[type];
  const [lead, ...rest] = catalog;

  if (!lead) {
    return [
      {
        id: "live",
        name: "Current",
        intent: "What's on this page right now.",
        block: liveBlock,
      },
    ];
  }

  return [{ ...lead, block: liveBlock }, ...rest];
}

export function everyShowcaseBlock(): GenUIBlock[] {
  return GEN_UI_LAB_SHOWCASE_TYPES.flatMap((type) => SHOWCASES[type].map((p) => p.block));
}

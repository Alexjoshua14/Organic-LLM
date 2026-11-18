import type { ChecklistStepId } from "./onboarding-state";

/**
 * Guide → Start here checklist. Each step completes from the real action, never from clicking its
 * link (see `onboardingActions.completeStep` call sites):
 *
 * - `first-message`: an accepted send in Chat or Arcadia (`components/chat/chat.tsx`).
 * - `try-arcadia`: an accepted send in Arcadia (same place).
 * - `rabbit-hole`: a rabbit hole node is created (`lib/rabbit-holes/useRabbitHoles.ts`).
 * - `switch-ideas`: the ⌘K launcher opens (`components/aion-launcher/aion-launcher.tsx`).
 */
export type ChecklistStep = {
  id: ChecklistStepId;
  title: string;
  body: string;
  /** Either a route to open or the launcher. */
  action: { kind: "link"; href: string; label: string } | { kind: "launcher"; label: string };
};

export const CHECKLIST_STEPS: ChecklistStep[] = [
  {
    id: "first-message",
    title: "Ask your first question",
    body: "Start a chat and send anything. Search and Memory are on, so replies can use the web and what Organic learns about you.",
    action: { kind: "link", href: "/chat", label: "New chat" },
  },
  {
    id: "try-arcadia",
    title: "Try Arcadia",
    body: "Send a message in Arcadia for quicker, tool-forward answers. Pick a style first: Standard, Ergon board, Remy or Scribe.",
    action: { kind: "link", href: "/sandbox/arcadia", label: "Open Arcadia" },
  },
  {
    id: "rabbit-hole",
    title: "Go down a rabbit hole",
    body: "Ask a research question and Organic writes a cited article you can branch from.",
    action: { kind: "link", href: "/rabbitholes/browse", label: "Open Rabbit Holes" },
  },
  {
    id: "switch-ideas",
    title: "Jump between ideas",
    body: "Open the launcher to find a recent thread or start something new from anywhere.",
    action: { kind: "launcher", label: "Open launcher" },
  },
];

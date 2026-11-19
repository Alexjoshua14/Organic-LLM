import type { ChecklistStepId } from "./onboarding-state";

/**
 * Guide → Start here checklist. Each step completes from the real action, never from clicking its
 * link (see `onboardingActions.completeStep` call sites):
 *
 * - `first-message`: an accepted send in Chat or Arcadia (`components/chat/chat.tsx`).
 * - `try-arcadia`: an accepted send in Arcadia (same place).
 * - `rabbit-hole`: the first research article is accepted for generation.
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
    body: "Send a question you already have. The globe (Search) and brain (Memory) buttons control what replies can draw on.",
    action: { kind: "link", href: "/chat", label: "New chat" },
  },
  {
    id: "try-arcadia",
    title: "Try Arcadia",
    body: "Try a quick request in Arcadia, like sorting tasks into a board or planning a meal.",
    action: { kind: "link", href: "/sandbox/arcadia", label: "Open Arcadia" },
  },
  {
    id: "rabbit-hole",
    title: "Go down a rabbit hole",
    body: "Ask for a research article, or say yes in chat when Organic offers one. Follow a related question to explore it further.",
    action: { kind: "link", href: "/rabbitholes", label: "Start a rabbit hole" },
  },
  {
    id: "switch-ideas",
    title: "Jump to an idea",
    body: "Reopen a recent thread or start something new from any page.",
    action: { kind: "launcher", label: "Jump to an idea" },
  },
];

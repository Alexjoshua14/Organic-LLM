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
    body: "Send a question you already have. The Search and Memory buttons control what each reply can draw on.",
    action: { kind: "link", href: "/chat", label: "New chat" },
  },
  {
    id: "try-arcadia",
    title: "Try Arcadia",
    body: "Send a message in Arcadia. It can use tools to do things like organize tasks or plan meals.",
    action: { kind: "link", href: "/sandbox/arcadia", label: "Open Arcadia" },
  },
  {
    id: "rabbit-hole",
    title: "Go down a rabbit hole",
    body: "Ask a research question and approve the article when prompted. Follow a related question to branch off.",
    action: { kind: "link", href: "/rabbitholes", label: "Start a rabbit hole" },
  },
  {
    id: "switch-ideas",
    title: "Jump between ideas",
    body: "Open the launcher to find a recent thread or start something new from anywhere.",
    action: { kind: "launcher", label: "Open launcher" },
  },
];

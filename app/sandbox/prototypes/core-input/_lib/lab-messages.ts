export type LabThreadMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

/** Placeholder thread rendered above the composer so it sits in a chat-like context. */
export const LAB_THREAD: LabThreadMessage[] = [
  {
    id: "lab-user-1",
    role: "user",
    text: "Help me turn memory into a user-facing trust feature, not just a backend capability.",
  },
  {
    id: "lab-assistant-1",
    role: "assistant",
    text: "Treat memory as an inspectable layer: show what was used, let people correct it, and keep retrieval narrow enough that the interface still feels fast and grounded.",
  },
  {
    id: "lab-user-2",
    role: "user",
    text: "What would the composer need to communicate for that to feel true?",
  },
];

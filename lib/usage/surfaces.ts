import type { ChatExperience } from "@/lib/chat/chat-experience";

export const USAGE_SURFACES = [
  "chat",
  "stage",
  "arcadia",
  "rabbit_holes",
  "speak",
  "remy",
  "background",
  "other",
  "unknown",
] as const;
export type UsageSurface = (typeof USAGE_SURFACES)[number];
export const SURFACE_LABELS: Record<UsageSurface, string> = {
  chat: "Normal chat",
  stage: "Stage",
  arcadia: "Arcadia",
  rabbit_holes: "Rabbit holes",
  speak: "Speak",
  remy: "Remy",
  background: "Background",
  other: "Other experiences",
  unknown: "Unclassified",
};

export function chatUsageSurface(experience?: ChatExperience): UsageSurface {
  if (!experience) return "chat";
  if (experience === "arcadia") return "arcadia";
  if (experience === "strata_hub" || experience === "strata_page") return "stage";
  if (experience === "rabbit_hole") return "rabbit_holes";

  return "other";
}

/** Only classify operations whose execution surface is unambiguous. */
export function operationUsageSurface(operation = "", route = ""): UsageSurface {
  if (
    operation.startsWith("rabbit-holes/") ||
    operation.startsWith("llm/rabbit-hole/") ||
    operation.startsWith("rabbit_hole") ||
    route.startsWith("/api/rabbit-hole")
  )
    return "rabbit_holes";
  if (
    operation.startsWith("strata") ||
    operation.startsWith("llm/strata") ||
    route.startsWith("/api/strata")
  )
    return "stage";
  if (operation.startsWith("speak") || route.startsWith("/api/ai/speak/")) return "speak";
  if (operation.startsWith("remy") || route.startsWith("/api/remy")) return "remy";
  if (operation === "multitask_router" || route.includes("/arcadia/")) return "arcadia";

  return "unknown";
}

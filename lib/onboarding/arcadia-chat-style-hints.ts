import type { ChatStyle } from "@/lib/chat/chat-style";
import type { FeatureHintId } from "@/lib/onboarding/feature-hints";

export const ARCADIA_CHAT_STYLE_HINT_IDS: Record<ChatStyle, FeatureHintId> = {
  default: "arcadia-style-standard",
  ergon: "arcadia-style-ergon",
  scribe: "arcadia-style-scribe",
};

export const ARCADIA_CHAT_STYLE_HINT_ID_LIST = Object.values(ARCADIA_CHAT_STYLE_HINT_IDS);

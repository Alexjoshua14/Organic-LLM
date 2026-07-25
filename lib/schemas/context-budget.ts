import { z } from "zod";

import { CHAT_EXPERIENCES, parseChatExperience } from "@/lib/chat/chat-experience";
import { ChatStyleSchema, parseChatStyle } from "@/lib/chat/chat-style";

export const ContextBudgetRequestSchema = z.object({
  chatId: z.string().uuid(),
  draftText: z.string().max(32_000).optional().default(""),
  modelId: z.string(),
  memory: z.boolean().optional().default(true),
  webSearch: z.boolean().optional().default(true),
  messageSearch: z.boolean().optional().default(true),
  knowledgeSearch: z.boolean().optional().default(false),
  experience: z
    .preprocess((val) => {
      if (val === undefined || val === null) return undefined;
      if (typeof val !== "string") return undefined;

      return parseChatExperience(val);
    }, z.enum(CHAT_EXPERIENCES).optional())
    .optional(),
  chatStyle: z
    .preprocess((val) => {
      if (val === undefined || val === null) return undefined;
      if (typeof val !== "string") return undefined;

      return parseChatStyle(val);
    }, ChatStyleSchema.optional())
    .optional(),
  speechFriendly: z.boolean().optional(),
});

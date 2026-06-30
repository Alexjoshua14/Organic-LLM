import type { z } from "zod";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { DelphiDisplayInput } from "@/lib/memory-ingest/delphi-caption-budget";

import {
  type ChatExperience,
  isArcadiaStyleMemoryReadExperience,
} from "@/lib/chat/chat-experience";
import { SCRIBE_SYSTEM_APPEND } from "@/lib/system-prompt/scribe";
import { getStrataPageById } from "@/data/supabase/strata";
import { getStrataAssistantPersona } from "@/lib/personas/strata-assistant";
import { buildStrataSystemSuffix } from "@/lib/llm/strata-chat-augmentation";
import { getChatResponseLengthInstruction } from "@/lib/llm/helpers";
import {
  getDelphiDisplayContextAugmentation,
  getDelphiSystemPromptAugmentation,
} from "@/lib/personas/delphi";
import { StrataAssistantPersonaRequestSchema } from "@/lib/schemas/chat";
import {
  computeDelphiCaptionBudget,
  delphiScrollCharBudget,
} from "@/lib/memory-ingest/delphi-caption-budget";

type StrataAssistantPersona = z.infer<typeof StrataAssistantPersonaRequestSchema>;

export type AppendStrataMainChatSystemParams = {
  systemPromptForRequest: string;
  experience: ChatExperience | undefined;
  strataPageId: string | undefined;
  sbUserId: string;
  strataAssistantPersona: StrataAssistantPersona | undefined;
};

/** buildStrataSystemSuffix + optional strata page persona augmentation. */
export async function appendStrataMainChatSystemFragments(
  params: AppendStrataMainChatSystemParams
): Promise<string> {
  const { systemPromptForRequest, experience, strataPageId, sbUserId, strataAssistantPersona } =
    params;

  let out = systemPromptForRequest;

  out += await buildStrataSystemSuffix({
    experience,
    strataPageId,
    sbUserId,
    fetchPage: getStrataPageById,
  });

  if (experience === "strata_page" && strataAssistantPersona) {
    out += getStrataAssistantPersona(strataAssistantPersona).getSystemPromptAugmentation();
  }

  return out;
}

const SPEECH_FRIENDLY_APPEND =
  "\n\nOutput format (speech-friendly mode): Format your response for both clear on-screen reading and later use as a script for audio. Use clear structure, headings, and visually appealing formatting. A separate pipeline will convert your text into a speech-friendly script and handle text-to-speech, so focus on clarity, structure, and readability—not on pronouncing abbreviations or avoiding punctuation.";

const ARCADIA_SHORT_REPLY_APPEND =
  "\n\n[Arcadia mode — keep replies short]\n" +
  "- Target ~50–120 words per reply. Minimize vertical height; mobile should rarely need to scroll for a single answer.\n" +
  "- Lead with the answer in 1–2 sentences. Use bullets or a tiny list only when necessary; avoid long paragraphs.\n" +
  '- If more is needed: give a one-screen summary and say "I can expand on X or Y" instead of expanding in the same message.\n' +
  "- Prefer tool use over prose for complex tasks; then respond with a compact synthesis, not raw output.\n" +
  "- When the user asks for depth, add a little at a time (one focused follow-up), not a long block.\n";

export type AppendMainChatPostToolSystemFragmentsParams = {
  systemPromptForRequest: string;
  hasTools: boolean;
  toolInstructions: string;
  speechFriendly: boolean | undefined;
  experience: ChatExperience | undefined;
  chatStyle?: ChatStyle;
  delphiDisplay?: DelphiDisplayInput;
};

/** Tool Instructions block + speech-friendly + Arcadia length/style guidance. */
export function appendMainChatPostToolSystemFragments(
  params: AppendMainChatPostToolSystemFragmentsParams
): string {
  const {
    systemPromptForRequest,
    hasTools,
    toolInstructions,
    speechFriendly,
    experience,
    chatStyle,
    delphiDisplay,
  } = params;

  let out = systemPromptForRequest;

  if (hasTools) {
    out += `\n\nTool Instructions:\n${toolInstructions}`;
  }

  if (speechFriendly) {
    out += SPEECH_FRIENDLY_APPEND;
  }

  if (isArcadiaStyleMemoryReadExperience(experience)) {
    out += ARCADIA_SHORT_REPLY_APPEND;

    if (chatStyle === "scribe") {
      out += SCRIBE_SYSTEM_APPEND;
    }
  }

  if (experience === "delphi") {
    out += getDelphiSystemPromptAugmentation();

    if (delphiDisplay) {
      const budget = computeDelphiCaptionBudget(delphiDisplay);

      out += getDelphiDisplayContextAugmentation(budget);
    }
  }

  return out;
}

export type WrapSystemPromptWithResponseLengthParams = {
  experience?: ChatExperience;
  delphiDisplay?: DelphiDisplayInput;
};

/** Same wrapper as the main chat route before streamText. */
export function wrapSystemPromptWithResponseLength(
  systemPromptForRequest: string,
  params?: WrapSystemPromptWithResponseLengthParams
): string {
  if (params?.experience === "delphi" && params.delphiDisplay) {
    const budget = computeDelphiCaptionBudget(params.delphiDisplay);
    const charBudget = delphiScrollCharBudget(budget);
    const approxWords = Math.round(charBudget / 5);

    return (
      systemPromptForRequest +
      "\n\n<response_length>\n" +
      `This response should fit the user's caption display. Approximate character budget: ${charBudget.toLocaleString()} characters (~${approxWords.toLocaleString()} words). ` +
      `Prefer staying within ${budget.visibleLines} visible lines; do not exceed ${budget.scrollMaxLines} lines total.\n` +
      "</response_length>"
    );
  }

  return (
    systemPromptForRequest +
    "\n\n<response_length>\n" +
    getChatResponseLengthInstruction() +
    "\n</response_length>"
  );
}

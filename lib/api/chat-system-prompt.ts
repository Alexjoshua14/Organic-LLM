import type { z } from "zod";

import type { ChatExperience } from "@/lib/chat/chat-experience";
import { getStrataPageById } from "@/data/supabase/strata";
import { getStrataAssistantPersona } from "@/lib/personas/strata-assistant";
import { buildStrataSystemSuffix } from "@/lib/llm/strata-chat-augmentation";
import { getChatResponseLengthInstruction } from "@/lib/llm/helpers";
import { getDelphiSystemPromptAugmentation } from "@/lib/personas/delphi";
import { StrataAssistantPersonaRequestSchema } from "@/lib/schemas/chat";

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
};

/** Tool Instructions block + speech-friendly + Arcadia length guidance. */
export function appendMainChatPostToolSystemFragments(
  params: AppendMainChatPostToolSystemFragmentsParams
): string {
  const { systemPromptForRequest, hasTools, toolInstructions, speechFriendly, experience } =
    params;

  let out = systemPromptForRequest;

  if (hasTools) {
    out += `\n\nTool Instructions:\n${toolInstructions}`;
  }

  if (speechFriendly) {
    out += SPEECH_FRIENDLY_APPEND;
  }

  if (experience === "arcadia") {
    out += ARCADIA_SHORT_REPLY_APPEND;
  }

  if (experience === "delphi") {
    out += getDelphiSystemPromptAugmentation();
  }

  return out;
}

/** Same wrapper as the main chat route before streamText. */
export function wrapSystemPromptWithResponseLength(systemPromptForRequest: string): string {
  return (
    systemPromptForRequest +
    "\n\n<response_length>\n" +
    getChatResponseLengthInstruction() +
    "\n</response_length>"
  );
}

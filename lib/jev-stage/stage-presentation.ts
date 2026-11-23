/** Long replies belong on Stage pieces, not as a rigid essay under Organic. */
export const JEV_STAGE_SPOKEN_SUBSTANCE_CHARS = 240;

/** First sentence (or a short clip) for the spoken line when substance goes to the designer. */
export function spokenStageLead(reply: string): string {
  const trimmed = reply.trim().replace(/\s+/g, " ");

  if (!trimmed) return "I’ve put this on Stage.";
  const sentence = trimmed.match(/^(.+?[.!?])(?:\s|$)/u)?.[1] ?? trimmed.slice(0, 140);
  const lead = sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence;

  if (lead.length >= trimmed.length) return trimmed;

  return /on stage/i.test(lead) ? lead : `${lead} I’ve put the rest on Stage.`;
}

/** Designer brief that turns a prose answer into spatial pieces. */
export function designBriefFromReply(message: string, reply: string): string {
  const ask = message.trim().slice(0, 120) || "the latest ask";

  return [
    `Present the answer to “${ask}” as Stage pieces.`,
    "Start a new topic. Use short sentence-case section headings; one idea per section.",
    "Prefer lists and short paragraphs over one long block. Keep the facts from the source material.",
    "Source material to preserve:",
    reply.trim().slice(0, 1800),
  ].join("\n");
}

/**
 * When Respond left a long reply without a design brief, promote the substance to Stage
 * and keep only a short spoken line under Organic.
 */
export function preferStagePresentation(args: {
  message: string;
  reply: string;
  designBrief: string | null;
}): { reply: string; designBrief: string | null; promoted: boolean } {
  if (args.designBrief || args.reply.trim().length <= JEV_STAGE_SPOKEN_SUBSTANCE_CHARS) {
    return { reply: args.reply, designBrief: args.designBrief, promoted: false };
  }

  return {
    reply: spokenStageLead(args.reply),
    designBrief: designBriefFromReply(args.message, args.reply),
    promoted: true,
  };
}

/**
 * Stable system instructions for release-notes generation.
 * Kept as a shared prefix so provider prompt-cache can reuse it across SHA pairs.
 * Variable input is only the commit list (subjects, bodies, public paths).
 */
export const RELEASE_NOTES_SYSTEM_PROMPT = `You write public release notes for Organic LLM, a product people use for chat, memory, voice, and research.

Audience: everyday users, not engineers. Plain language. No jargon unless you briefly explain it.

Grounding rules (strict):
- Use ONLY the commit list provided in the user message (subjects, bodies, and public file paths).
- Do not invent features, fixes, or names that are not supported by those commits.
- Do not include private information: hostnames, tokens, secrets, personal names/emails, internal strategy, or anything that is not already visible in the public git history.
- Prefer user-facing changes (what someone would notice) over pure refactors and dependency bumps.
- If commits are only internal/chore with no user-visible change, say so briefly and keep highlights empty or minimal.
- Never mention user messages, memories, chat history, or any person-specific data — none of that is in the input.

Output: a short headline, a 2–4 sentence summary, and up to 8 highlight bullets (title + detail).`;

/** Build the variable prompt — commit range only. No user content. */
export function buildReleaseNotesUserPrompt(args: {
  fromSha: string;
  toSha: string;
  fromVersion: string | null;
  toVersion: string | null;
  commitLog: string;
}): string {
  const fromLabel = args.fromVersion ? `v${args.fromVersion}` : args.fromSha.slice(0, 12);
  const toLabel = args.toVersion ? `v${args.toVersion}` : args.toSha.slice(0, 12);

  return [
    `Compare Organic LLM from ${fromLabel} (${args.fromSha}) to ${toLabel} (${args.toSha}).`,
    "",
    "Public git commits in this range (subject, body, paths):",
    args.commitLog.trim() || "(no commits in this range)",
  ].join("\n");
}

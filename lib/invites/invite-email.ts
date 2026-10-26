import "server-only";

type InviteEnv = Record<string, string | undefined>;
type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export type InviteEmailConfig = { apiKey: string; from: string; replyTo: string | null };
export type InviteEmailInput = {
  to: string;
  inviteUrl: string;
  name?: string;
  note?: string;
  expiresInDays: number;
};

/** The finished surfaces an invited account can open; everything else is admin-only. */
const TRY_LIST = [
  ["Chat", "everyday threads with search and memory that carries across them"],
  ["Arcadia", "fast, tool-forward chat when you want concise answers"],
  ["Rabbit Holes", "branching research with cited sources"],
  ["Ergon", "a keyboard-first todo list that plans by do-date"],
  ["Remy", "meal and event planning"],
  ["Speak", "a realtime voice conversation"],
] as const;

/**
 * Branded invites need a Resend key and a sender on a domain verified in Resend. Without
 * both, the caller falls back to Clerk's own invitation email.
 */
export function inviteEmailConfig(env: InviteEnv = process.env): InviteEmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.INVITE_EMAIL_FROM?.trim();

  if (!apiKey || !from) return null;

  return { apiKey, from, replyTo: env.INVITE_EMAIL_REPLY_TO?.trim() || null };
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function buildInviteEmail(input: InviteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const note = input.note?.trim();
  const intro =
    "You're invited to try Organic LLM: an AI workspace for thinking over time, with memory, research, planning and voice in one place.";
  const plan =
    "Your account starts on the free plan, which includes a weekly usage allowance. If you reach it, new requests pause until the week resets.";
  const expiry = `This invitation expires in ${input.expiresInDays} days.`;

  const text = [
    greeting,
    "",
    ...(note ? [note, ""] : []),
    intro,
    "",
    "Things to try:",
    ...TRY_LIST.map(([label, what]) => `- ${label}: ${what}`),
    "",
    plan,
    "",
    `Accept your invitation: ${input.inviteUrl}`,
    expiry,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#f6f5f2;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;line-height:1.55;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b;">Organic LLM</p>
      <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(greeting)}</p>
      ${note ? `<p style="margin:0 0 16px;font-size:16px;white-space:pre-line;">${escapeHtml(note)}</p>` : ""}
      <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 8px;font-size:16px;">Things to try:</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;">
        ${TRY_LIST.map(([label, what]) => `<li style="margin:0 0 4px;"><strong>${label}</strong>: ${escapeHtml(what)}</li>`).join("\n        ")}
      </ul>
      <p style="margin:0 0 24px;font-size:15px;color:#4a4a4a;">${escapeHtml(plan)}</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:999px;">Accept your invitation</a>
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#6b6b6b;">${escapeHtml(expiry)} If the button doesn't work, open this link:</p>
      <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${escapeHtml(input.inviteUrl)}" style="color:#1a1a1a;">${escapeHtml(input.inviteUrl)}</a></p>
    </div>
  </body>
</html>`;

  return { subject: "You're invited to Organic LLM", html, text };
}

/** One send per invitation; the idempotency key stops a retried request from mailing twice. */
export async function sendInviteEmail(
  config: InviteEmailConfig,
  input: InviteEmailInput & { invitationId: string },
  deps: { fetch?: Fetch } = {}
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const email = buildInviteEmail(input);

  try {
    const response = await (deps.fetch ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": `organic-invite-${input.invitationId}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as {
      id?: unknown;
      message?: unknown;
    } | null;

    if (!response.ok || typeof body?.id !== "string") {
      const message = typeof body?.message === "string" ? `: ${body.message.slice(0, 200)}` : "";

      return { ok: false, error: `Resend returned HTTP ${response.status}${message}` };
    }

    return { ok: true, id: body.id };
  } catch {
    return { ok: false, error: "Resend did not respond." };
  }
}

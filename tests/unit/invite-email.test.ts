import { describe, expect, test } from "bun:test";

import { buildInviteEmail, inviteEmailConfig, sendInviteEmail } from "@/lib/invites/invite-email";

const input = {
  to: "friend@example.com",
  inviteUrl: "https://accounts.example.com/sign-up?__clerk_ticket=t&x=1",
  expiresInDays: 30,
};

describe("invite email", () => {
  test("needs both a Resend key and a verified sender", () => {
    expect(inviteEmailConfig({ RESEND_API_KEY: "re_test" })).toBeNull();
    expect(inviteEmailConfig({ INVITE_EMAIL_FROM: "Organic <a@example.com>" })).toBeNull();
    expect(
      inviteEmailConfig({
        RESEND_API_KEY: "re_test",
        INVITE_EMAIL_FROM: "Organic <a@example.com>",
        INVITE_EMAIL_REPLY_TO: "me@example.com",
      })
    ).toEqual({ apiKey: "re_test", from: "Organic <a@example.com>", replyTo: "me@example.com" });
  });

  test("escapes the admin's name and note and keeps a plain-text link", () => {
    const email = buildInviteEmail({ ...input, name: "<Sam>", note: 'Try "Speak" & tell me' });

    expect(email.html).toContain("Hi &lt;Sam&gt;,");
    expect(email.html).toContain("Try &quot;Speak&quot; &amp; tell me");
    expect(email.html).not.toContain("<Sam>");
    expect(email.html).toContain("__clerk_ticket=t&amp;x=1");
    expect(email.text).toContain(`Accept your invitation: ${input.inviteUrl}`);
    expect(email.text).toContain("free plan");
  });

  test("sends once per invitation through Resend and reports failures", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const config = { apiKey: "re_test", from: "Organic <a@example.com>", replyTo: null };
    const sent = await sendInviteEmail(
      config,
      { ...input, invitationId: "inv_1" },
      {
        fetch: async (url, init) => {
          calls.push({ url, init });

          return Response.json({ id: "email_1" });
        },
      }
    );

    expect(sent).toEqual({ ok: true, id: "email_1" });
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(calls[0]!.init.headers).toMatchObject({
      authorization: "Bearer re_test",
      "idempotency-key": "organic-invite-inv_1",
    });
    expect(JSON.parse(String(calls[0]!.init.body)).to).toEqual(["friend@example.com"]);

    const rejected = await sendInviteEmail(
      config,
      { ...input, invitationId: "inv_2" },
      { fetch: async () => Response.json({ message: "Domain not verified" }, { status: 403 }) }
    );

    expect(rejected).toEqual({ ok: false, error: "Resend returned HTTP 403: Domain not verified" });
  });
});

import { describe, expect, mock, test } from "bun:test";

import {
  createAdminInvitesHandlers,
  INVITE_EXPIRES_IN_DAYS,
  type InvitationSummary,
} from "@/lib/api/admin-invites-handler";

const config = { apiKey: "re_test", from: "Organic LLM <invites@example.com>", replyTo: null };
const invitation: InvitationSummary = {
  id: "inv_1",
  emailAddress: "friend@example.com",
  status: "pending",
  createdAt: 1_760_000_000_000,
  url: "https://accounts.example.com/sign-up?__clerk_ticket=t",
};
const request = (method: string, body: unknown, headers = {}) =>
  new Request("https://organic.test/api/admin/invites", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

function fixture({
  admin = true,
  branded = true,
  sendOk = true,
  createError,
}: {
  admin?: boolean;
  branded?: boolean;
  sendOk?: boolean;
  createError?: unknown;
} = {}) {
  const create = mock(
    async (_params: Parameters<Parameters<typeof createAdminInvitesHandlers>[0]["create"]>[0]) => {
      if (createError) throw createError;

      return invitation;
    }
  );
  const revoke = mock(async () => ({ ...invitation, status: "revoked" }));
  const sendEmail = mock(async () =>
    sendOk
      ? ({ ok: true, id: "email_1" } as const)
      : ({ ok: false, error: "Resend returned HTTP 403" } as const)
  );
  const handlers = createAdminInvitesHandlers({
    requireAdmin: async () => (admin ? { clerkUserId: "admin", sbUserId: "sb_admin" } : null),
    listPending: async () => [invitation],
    create,
    revoke,
    emailConfig: branded ? config : null,
    sendEmail,
    now: () => new Date("2026-10-22T00:00:00.000Z"),
  });

  return { create, revoke, sendEmail, handlers };
}

describe("admin invites", () => {
  test("non-admins cannot list, send or revoke invitations", async () => {
    const { handlers, create, revoke } = fixture({ admin: false });

    expect((await handlers.GET()).status).toBe(403);
    expect((await handlers.POST(request("POST", { email: "friend@example.com" }))).status).toBe(
      403
    );
    expect((await handlers.DELETE(request("DELETE", { id: "inv_1" }))).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  test("rejects cross-site sends and invalid addresses before calling Clerk", async () => {
    const { handlers, create } = fixture();

    expect(
      (
        await handlers.POST(
          request("POST", { email: "friend@example.com" }, { Origin: "https://evil.test" })
        )
      ).status
    ).toBe(403);
    expect((await handlers.POST(request("POST", { email: "not-an-email" }))).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test("a branded invite suppresses Clerk's email and mails the invitation link once", async () => {
    const { handlers, create, sendEmail } = fixture();
    const response = await handlers.POST(
      request("POST", { email: " Friend@Example.com ", name: "Sam", note: "Try Rabbit Holes" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      delivery: "resend",
      invitation: { id: "inv_1" },
    });
    expect(create.mock.calls[0]![0]).toEqual({
      emailAddress: "friend@example.com",
      notify: false,
      expiresInDays: INVITE_EXPIRES_IN_DAYS,
      publicMetadata: { invitedAt: "2026-10-22T00:00:00.000Z" },
    });
    expect(sendEmail).toHaveBeenCalledWith(config, {
      to: "friend@example.com",
      inviteUrl: invitation.url!,
      name: "Sam",
      note: "Try Rabbit Holes",
      expiresInDays: INVITE_EXPIRES_IN_DAYS,
      invitationId: "inv_1",
    });
  });

  test("without a Resend sender, Clerk sends its own invitation", async () => {
    const { handlers, create, sendEmail } = fixture({ branded: false });
    const response = await handlers.POST(request("POST", { email: "friend@example.com" }));

    expect(await response.json()).toMatchObject({ delivery: "clerk" });
    expect(create.mock.calls[0]![0].notify).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("a failed email still hands the admin a usable invitation link", async () => {
    const { handlers } = fixture({ sendOk: false });
    const response = await handlers.POST(request("POST", { email: "friend@example.com" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      inviteUrl: invitation.url,
      error: "Resend returned HTTP 403",
    });
  });

  test("surfaces Clerk's reason when an invitation is rejected", async () => {
    const { handlers } = fixture({
      createError: { errors: [{ longMessage: "That email address is already invited." }] },
    });
    const response = await handlers.POST(request("POST", { email: "friend@example.com" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "That email address is already invited." });
  });

  test("lists pending invitations without their sign-up links and revokes by id", async () => {
    const { handlers, revoke } = fixture();
    const listed = await (await handlers.GET()).json();

    expect(listed.invitations[0]).not.toHaveProperty("url");
    expect(listed.delivery).toBe("resend");
    expect((await handlers.DELETE(request("DELETE", { id: "inv_1" }))).status).toBe(200);
    expect(revoke).toHaveBeenCalledWith("inv_1");
  });
});

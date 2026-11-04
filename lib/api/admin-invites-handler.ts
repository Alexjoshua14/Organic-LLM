import type { AdminContext } from "@/lib/admin/require-admin";
import type { InviteEmailConfig, InviteEmailInput } from "@/lib/invites/invite-email";

import { z } from "zod";

export const INVITE_EXPIRES_IN_DAYS = 30;

export type InvitationSummary = {
  id: string;
  emailAddress: string;
  status: string;
  createdAt: number;
  url?: string;
};

type InvitesDeps = {
  requireAdmin(): Promise<AdminContext | null>;
  listPending(): Promise<InvitationSummary[]>;
  create(params: {
    emailAddress: string;
    notify: boolean;
    expiresInDays: number;
    publicMetadata: Record<string, unknown>;
  }): Promise<InvitationSummary>;
  revoke(id: string): Promise<InvitationSummary>;
  /** Null sends Clerk's own invitation email instead of the branded one. */
  emailConfig: InviteEmailConfig | null;
  sendEmail(
    config: InviteEmailConfig,
    input: InviteEmailInput & { invitationId: string }
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  now?: () => Date;
};

const CreateSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().max(80).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
const RevokeSchema = z.object({ id: z.string().trim().min(1).max(128) }).strict();

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const summary = ({ id, emailAddress, status, createdAt }: InvitationSummary) => ({
  id,
  emailAddress,
  status,
  createdAt,
});

/** Clerk's message for a rejected invitation (already invited, already a user), safe for admins. */
function clerkMessage(error: unknown): string | null {
  const first = (error as { errors?: Array<{ longMessage?: unknown; message?: unknown }> })
    ?.errors?.[0];
  const message = first?.longMessage ?? first?.message;

  return typeof message === "string" ? message.slice(0, 300) : null;
}

function mutationRejected(req: Request): Response | null {
  if (
    req.headers.get("sec-fetch-site") === "cross-site" ||
    (req.headers.has("origin") && req.headers.get("origin") !== new URL(req.url).origin)
  ) {
    return json({ error: "Invalid origin" }, 403);
  }
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "JSON body required" }, 415);

  return null;
}

export function createAdminInvitesHandlers(deps: InvitesDeps) {
  return {
    GET: async () => {
      if (!(await deps.requireAdmin())) return json({ error: "Forbidden" }, 403);
      try {
        return json({
          invitations: (await deps.listPending()).map(summary),
          delivery: deps.emailConfig ? "resend" : "clerk",
        });
      } catch {
        return json({ error: "Invitations unavailable" }, 503);
      }
    },
    POST: async (req: Request) => {
      if (!(await deps.requireAdmin())) return json({ error: "Forbidden" }, 403);
      const rejected = mutationRejected(req);

      if (rejected) return rejected;
      const parsed = CreateSchema.safeParse(await req.json().catch(() => null));

      if (!parsed.success) return json({ error: "Enter a valid email address" }, 400);
      const { email, name, note } = parsed.data;
      const branded = deps.emailConfig;
      let invitation: InvitationSummary;

      try {
        invitation = await deps.create({
          emailAddress: email,
          notify: branded === null,
          expiresInDays: INVITE_EXPIRES_IN_DAYS,
          publicMetadata: { invitedAt: (deps.now?.() ?? new Date()).toISOString() },
        });
      } catch (error) {
        return json({ error: clerkMessage(error) ?? "Clerk could not create the invitation" }, 409);
      }
      if (!branded) return json({ invitation: summary(invitation), delivery: "clerk" });
      if (!invitation.url) {
        return json(
          { invitation: summary(invitation), error: "Clerk returned no invitation link to email" },
          502
        );
      }
      const sent = await deps.sendEmail(branded, {
        to: email,
        inviteUrl: invitation.url,
        name,
        note,
        expiresInDays: INVITE_EXPIRES_IN_DAYS,
        invitationId: invitation.id,
      });

      if (!sent.ok) {
        // The invitation exists; hand the link to the admin rather than leaving it unusable.
        return json(
          { invitation: summary(invitation), inviteUrl: invitation.url, error: sent.error },
          502
        );
      }

      return json({ invitation: summary(invitation), delivery: "resend" });
    },
    DELETE: async (req: Request) => {
      if (!(await deps.requireAdmin())) return json({ error: "Forbidden" }, 403);
      const rejected = mutationRejected(req);

      if (rejected) return rejected;
      const parsed = RevokeSchema.safeParse(await req.json().catch(() => null));

      if (!parsed.success) return json({ error: "Invalid invitation" }, 400);
      try {
        return json({ invitation: summary(await deps.revoke(parsed.data.id)) });
      } catch (error) {
        return json({ error: clerkMessage(error) ?? "Clerk could not revoke the invitation" }, 409);
      }
    },
  };
}

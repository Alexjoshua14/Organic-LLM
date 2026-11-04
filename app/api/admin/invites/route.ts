import { clerkClient } from "@clerk/nextjs/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminInvitesHandlers } from "@/lib/api/admin-invites-handler";
import { inviteEmailConfig, sendInviteEmail } from "@/lib/invites/invite-email";

const handlers = createAdminInvitesHandlers({
  requireAdmin,
  listPending: async () =>
    (await (await clerkClient()).invitations.getInvitationList({ status: "pending", limit: 100 }))
      .data,
  create: async (params) => (await clerkClient()).invitations.createInvitation(params),
  revoke: async (id) => (await clerkClient()).invitations.revokeInvitation(id),
  emailConfig: inviteEmailConfig(),
  sendEmail: (config, input) => sendInviteEmail(config, input),
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;

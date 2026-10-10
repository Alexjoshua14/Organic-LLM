"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { readAdminProfile } from "@/lib/admin/read-admin-profile";

const identitySchema = z
  .object({
    userId: z.string().min(1),
    sessionId: z.string().min(1),
  })
  .strict();

export type GatewayVisibilityIdentity = z.infer<typeof identitySchema>;

/** UI visibility only. The server session, never the supplied cache identity, owns the read. */
export async function getGatewayVisibilityForCurrentUser(
  expectedIdentity?: GatewayVisibilityIdentity
): Promise<boolean> {
  const { userId, sessionId } = await auth();

  if (!userId) return false;

  if (expectedIdentity !== undefined) {
    const parsed = identitySchema.safeParse(expectedIdentity);

    if (!parsed.success || parsed.data.userId !== userId || parsed.data.sessionId !== sessionId) {
      throw new Error("Gateway visibility session changed.");
    }
  }

  const profile = await readAdminProfile(userId);

  return profile?.admin === true;
}

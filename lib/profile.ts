import { supabaseAdmin } from "./supabase/supabase-admin";
import { createLogger } from "./logger";

const logger = createLogger("lib/profile.ts");

/**
 * Creates a new user in Supabase upon creation of a Clerk profile
 */
export async function upsertProfileFromClerk(user: any) {
  const clerk_user_id = user.id as string;
  const { email, displayName } = normalizeUserData(user);

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({ clerk_user_id, email, display_name: displayName });

  if (error) {
    logger.error("upsertProfileFromClerk", "Error upserting profile:", error);
    if (error.code === "23505") {
      logger.log(
        "upsertProfileFromClerk",
        "duplicate profile, for now this is fine",
      );

      return;
    }
    throw new Error("Failed to add user profile to Supabase");
  }
}

function normalizeUserData(user: any) {
  const email =
    user?.email_addresses?.[0]?.email_address ??
    (user?.primary_email_address_id &&
      user.email_addresses?.find(
        (e: any) => e.id === user.primary_email_address_id,
      )?.email_address) ??
    null;

  const displayName =
    user.username ??
    ([user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      email ||
      null);

  return { email, displayName };
}

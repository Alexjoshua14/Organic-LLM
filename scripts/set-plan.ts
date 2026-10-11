#!/usr/bin/env bun
/**
 * Owner tooling: set one user's plan and/or usage-reset credits (account_entitlements), until
 * plans are managed through billing.
 *
 * Usage:
 *   bun run plan:set --email <verified email> [--plan free|plus|pro|max] [--resets N] [--yes]
 *
 * - The email is matched against Clerk, and only a **verified** address on exactly one Clerk user
 *   counts. The write goes by that user's profile id — never by the user-editable profiles.email.
 * - Without --yes it prints what it would change (and which Supabase project) and exits.
 * - Needs CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Bun loads
 *   .env.local), and docs/migrations/account_entitlements.sql applied to that project.
 */

import { createClient } from "@supabase/supabase-js";

import { isPlanId } from "@/lib/plans/plan-tags";

type ClerkEmail = { email_address: string; verification?: { status?: string } | null };
type ClerkUser = { id: string; email_addresses?: ClerkEmail[] };

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);

  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(`set-plan: ${message}`);
  process.exit(1);
}

async function findVerifiedClerkUser(email: string, secret: string): Promise<ClerkUser> {
  const url = new URL("https://api.clerk.com/v1/users");

  url.searchParams.append("email_address", email);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });

  if (!response.ok) fail(`Clerk lookup failed (${response.status}).`);
  const users = (await response.json()) as ClerkUser[];
  const wanted = email.toLowerCase();
  const verified = users.filter((user) =>
    (user.email_addresses ?? []).some(
      (address) =>
        address.email_address.toLowerCase() === wanted &&
        address.verification?.status === "verified"
    )
  );

  if (verified.length !== 1) {
    fail(`Expected exactly one Clerk user with that verified email; found ${verified.length}.`);
  }

  return verified[0]!;
}

async function main() {
  const email = arg("email")?.trim();
  const plan = arg("plan")?.trim();
  const resetsRaw = arg("resets");
  const apply = process.argv.includes("--yes");

  if (!email) fail("Pass --email <verified email>.");
  if (plan !== undefined && !isPlanId(plan)) fail("--plan must be free, plus, pro or max.");
  const resets = resetsRaw === undefined ? undefined : Number(resetsRaw);

  if (
    resets !== undefined &&
    (!Number.isSafeInteger(resets) || resets < 0 || resets > 2_147_483_647)
  ) {
    fail("--resets must be a whole number from 0 to 2147483647.");
  }
  if (plan === undefined && resets === undefined) fail("Pass --plan and/or --resets.");

  const clerkSecret = process.env.CLERK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clerkSecret || !supabaseUrl || !serviceKey) {
    fail("CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const clerkUser = await findVerifiedClerkUser(email, clerkSecret);
  const supabase = createClient(supabaseUrl, serviceKey);
  const profile = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkUser.id)
    .maybeSingle();

  if (profile.error || !profile.data) fail("No profile for that Clerk user.");
  const profileId = profile.data.id as string;
  const current = await supabase
    .from("account_entitlements")
    .select("plan, resets_remaining")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (current.error)
    fail(`Could not read entitlements (${current.error.message}). Is the migration applied?`);

  console.log(`Supabase project: ${new URL(supabaseUrl).host}`);
  console.log(`Clerk user:       ${clerkUser.id}`);
  console.log(
    `Current:          plan=${current.data?.plan ?? "(none)"} resets=${current.data?.resets_remaining ?? "(none)"}`
  );
  console.log(`New:              plan=${plan ?? "(unchanged)"} resets=${resets ?? "(unchanged)"}`);

  if (!apply) {
    console.log("Dry run. Re-run with --yes to apply.");

    return;
  }

  const { error } = await supabase.from("account_entitlements").upsert(
    {
      profile_id: profileId,
      ...(plan !== undefined ? { plan } : {}),
      ...(resets !== undefined ? { resets_remaining: resets } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );

  if (error) fail(`Update failed: ${error.message}`);
  console.log("Updated.");
}

void main();

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getProfileTreeForCurrentUser,
  patchProfileTreeFieldsForCurrentUser,
  upsertProfileTreeForCurrentUser,
} from "@/data/supabase/profiles";
import { clientErrorJson, logRouteError } from "@/lib/api/client-safe-error";
import { createLogger } from "@/lib/logger";
import { checkProfileTreeEditLimit } from "@/lib/rate-limit/profile";
import { ProfileTreeSchema } from "@/lib/schemas/profileTree";

const PatchProfileTreeSchema = z
  .object({
    headline: z.string().trim().min(1).max(120).optional(),
    signature: z.string().trim().max(160).optional(),
  })
  .refine((data) => data.headline !== undefined || data.signature !== undefined, {
    message: "At least one profile field is required",
  });

const logger = createLogger("app/api/profile/tree/route.ts");

export async function GET() {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getProfileTreeForCurrentUser();

  if (result.error) {
    return NextResponse.json({ error: "Failed to load profile tree" }, { status: 500 });
  }

  return NextResponse.json({ data: result.data });
}

export async function POST(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkProfileTreeEditLimit(user.userId);

  if (!limit.success) {
    return NextResponse.json({ error: limit.error ?? "Too many requests" }, { status: 429 });
  }

  let tree;

  try {
    tree = ProfileTreeSchema.parse((await req.json())?.tree);
  } catch {
    return NextResponse.json({ error: "Invalid profile tree" }, { status: 400 });
  }

  const result = await upsertProfileTreeForCurrentUser(tree, "tailored-seed");

  if (result.error) {
    return NextResponse.json({ error: "Failed to save profile tree" }, { status: 500 });
  }

  return NextResponse.json({ data: tree });
}

export async function PATCH(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkProfileTreeEditLimit(user.userId);

  if (!limit.success) {
    return NextResponse.json({ error: limit.error ?? "Too many requests" }, { status: 429 });
  }

  let body: z.infer<typeof PatchProfileTreeSchema>;

  try {
    body = PatchProfileTreeSchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid profile update" }, { status: 400 });
  }

  const result = await patchProfileTreeFieldsForCurrentUser(body);

  if (result.error || !result.data) {
    if (result.error) {
      logRouteError(logger, "PATCH", result.error);
    }

    return clientErrorJson(500);
  }

  return NextResponse.json({ data: result.data });
}

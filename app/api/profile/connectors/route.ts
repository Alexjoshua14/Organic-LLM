import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  loadUserConnectorsProfile,
  saveUserConnectorsProfile,
} from "@/lib/connectors/user-connectors-store";
import { UserConnectorsProfileSchema } from "@/lib/schemas/user-connectors";

/**
 * GET /api/profile/connectors
 *
 * Returns the authenticated user's private connectors & personal dossier.
 */
export async function GET() {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await loadUserConnectorsProfile(user.userId);

  return NextResponse.json({ data: profile });
}

/**
 * PUT /api/profile/connectors
 *
 * Validates, normalizes, and saves the authenticated user's private connectors & personal dossier.
 */
export async function PUT(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UserConnectorsProfileSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid connectors payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const saved = await saveUserConnectorsProfile(user.userId, parsed.data);

  return NextResponse.json({ data: saved });
}

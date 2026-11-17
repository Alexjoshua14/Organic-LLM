import { NextResponse } from "next/server";

import { requireProfileActor } from "@/lib/api/profile-actor";
import { loadUserConnectorsWithErgon } from "@/lib/connectors/durable-ergon-status";
import {
  saveUserConnectorsProfile,
  UserConnectorsStoreError,
} from "@/lib/connectors/user-connectors-store";
import { createLogger } from "@/lib/logger";
import { UserConnectorsProfileSchema } from "@/lib/schemas/user-connectors";

const logger = createLogger("api/profile/connectors");

function unavailable(operation: string, error: unknown) {
  // Log only the short store code; store errors never carry profile content.
  logger.error(operation, "Connectors profile store unavailable", {
    code: error instanceof UserConnectorsStoreError ? (error.code ?? error.operation) : null,
  });

  return NextResponse.json(
    { error: "Your connectors profile is temporarily unavailable. Try again shortly." },
    { status: 503 }
  );
}

/**
 * GET /api/profile/connectors
 *
 * Returns the authenticated user's private connectors & personal dossier. The Ergon status is
 * derived from the durable Ergon connection, never read from the stored profile.
 */
export async function GET() {
  const { actor, error } = await requireProfileActor();

  if (error) return error;

  try {
    return NextResponse.json({ data: await loadUserConnectorsWithErgon(actor.sbUserId) });
  } catch (err) {
    return unavailable("GET", err);
  }
}

/**
 * PUT /api/profile/connectors
 *
 * Validates, normalizes, and saves the authenticated user's private connectors & personal dossier.
 */
export async function PUT(req: Request) {
  const { actor, error } = await requireProfileActor();

  if (error) return error;

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

  // The Ergon connection status is server-owned (derived from the durable connection). A client
  // must not be able to claim "connected" and steer routing, so drop it from client writes.
  const clientFields = { ...parsed.data };

  delete clientFields.ergonConnection;

  try {
    const saved = await saveUserConnectorsProfile(actor.sbUserId, clientFields);

    return NextResponse.json({ data: saved });
  } catch (err) {
    // The save did not happen, so never report success.
    return unavailable("PUT", err);
  }
}

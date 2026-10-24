import { verifyWebhook, WebhookEvent } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";

import { upsertProfileFromClerk } from "@/lib/profile";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/api/webhooks/clerk/route.ts");

export async function POST(req: NextRequest) {
  let evt: WebhookEvent;

  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));

    logger.error("POST", `Error verifying webhook: ${e.name}`);

    return NextResponse.json({ error: "Error verifying webhook" }, { status: 400 });
  }
  const { id } = evt.data;
  const eventType = evt.type;

  logger.log("POST", `Received webhook with ID ${id} and event type of ${eventType}`);

  try {
    switch (evt.type) {
      case "user.created":
        await upsertProfileFromClerk(evt.data);
        break;
      default:
        break;
    }
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));

    logger.error("POST", `Webhook error: ${e.name}`);

    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }

  return NextResponse.json({ data: "Webhook received" }, { status: 200 });
}

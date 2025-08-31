import { verifyWebhook, WebhookEvent } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";

import { upsertProfileFromClerk } from "@/lib/profile";

export async function POST(req: NextRequest) {
  let evt: WebhookEvent;

  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Error verifying webhook:", err);

    return NextResponse.json(
      { error: "Error verifying webhook" },
      { status: 400 },
    );
  }
  // Do something with payload
  // For this guide, log payload to console
  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Received webhook with ID ${id} and event type of ${eventType}`);
  console.log("Webhook payload:", evt.data);

  try {
    switch (evt.type) {
      case "user.created":
        console.log("userId:", evt.data.id);
        await upsertProfileFromClerk(evt.data);
        break;
      default:
        break;
    }
  } catch (err: any) {
    console.log(`Webhook error: ${err.message}`);

    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ data: "Webhook received" }, { status: 200 });
}

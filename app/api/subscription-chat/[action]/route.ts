import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { subscriptionConnection } from "@/lib/subscription-chat/connection";
import { subscriptionModels, subscriptionTurn } from "@/lib/subscription-chat/inference";
import { acquireSubscriptionTurn, subscriptionStore } from "@/lib/subscription-chat/store";
import {
  authorizeSubscriptionRequest,
  chatInputSchema,
  LAB_PATH,
  LOGIN_COOKIE,
  LOGIN_TTL_MS,
  publicSubscriptionError,
  SubscriptionError,
  TURN_TIMEOUT_MS,
} from "@/lib/subscription-chat/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function failure(error: unknown) {
  return NextResponse.json(
    { error: publicSubscriptionError(error) },
    {
      status: error instanceof SubscriptionError ? error.status : 500,
      headers,
    }
  );
}

async function readInput(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new SubscriptionError("Send JSON text messages.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new SubscriptionError("A message is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 300_000) {
        await reader.cancel();
        throw new SubscriptionError("This conversation is too large. Start a new chat.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return chatInputSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    throw new SubscriptionError(
      "Send up to 40 alternating text messages, within 64,000 characters."
    );
  }
}

type RouteContext = { params: Promise<{ action: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    const config = authorizeSubscriptionRequest(request, userId);
    const { action } = await context.params;
    if (action === "callback") {
      const cookieStore = await cookies();
      const release = await acquireSubscriptionTurn(subscriptionStore, config.ownerId);
      let result = "connected";
      try {
        await subscriptionConnection.complete(
          config.ownerId,
          new URL(request.url),
          cookieStore.get(LOGIN_COOKIE)?.value
        );
      } catch {
        result = "failed";
      } finally {
        cookieStore.set(LOGIN_COOKIE, "", { path: "/api/subscription-chat", maxAge: 0 });
        await release();
      }
      return NextResponse.redirect(`${config.origin}${LAB_PATH}?connection=${result}`, {
        status: 303,
        headers,
      });
    }
    if (action !== "status") return new Response(null, { status: 404, headers });
    const state = await subscriptionStore.read(config.ownerId);
    const connected = !!state.registration?.tokens;
    const models = connected
      ? await subscriptionModels(await subscriptionConnection.access(config.ownerId))
      : [];
    return NextResponse.json(
      { connected, account: state.registration?.email ?? null, models },
      { headers }
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let release: (() => Promise<void>) | undefined;
  try {
    const { userId } = await auth();
    const config = authorizeSubscriptionRequest(request, userId);
    const { action } = await context.params;
    if (!["connect", "disconnect", "chat"].includes(action))
      return new Response(null, { status: 404, headers });
    release = await acquireSubscriptionTurn(subscriptionStore, config.ownerId);
    if (action === "connect") {
      const login = await subscriptionConnection.start(config.ownerId, config.origin);
      (await cookies()).set(LOGIN_COOKIE, login.browser, {
        httpOnly: true,
        sameSite: "lax",
        path: "/api/subscription-chat",
        maxAge: LOGIN_TTL_MS / 1000,
      });
      return NextResponse.redirect(login.url, { status: 303, headers });
    }
    if (action === "disconnect") {
      const result = await subscriptionConnection.disconnect(config.ownerId);
      (await cookies()).set(LOGIN_COOKIE, "", { path: "/api/subscription-chat", maxAge: 0 });
      return NextResponse.json(result, { headers });
    }
    const input = await readInput(request);
    const token = await subscriptionConnection.access(config.ownerId);
    const models = await subscriptionModels(token);
    if (!models.some((model) => model.id === input.model))
      throw new SubscriptionError("Select a model available to your ChatGPT account.");

    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    const timer = setTimeout(abort, TURN_TIMEOUT_MS);
    const releaseTurn = release;
    release = undefined; // The stream owns the lease until its terminal event or cancellation.
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(stream) {
        try {
          for await (const event of subscriptionTurn(token, input, controller.signal)) {
            if (controller.signal.aborted) break;
            stream.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          }
        } catch (error) {
          if (!controller.signal.aborted)
            stream.enqueue(
              encoder.encode(
                JSON.stringify({ type: "error", message: publicSubscriptionError(error) }) + "\n"
              )
            );
        } finally {
          clearTimeout(timer);
          request.signal.removeEventListener("abort", abort);
          await releaseTurn();
          try {
            stream.close();
          } catch {
            /* The browser may have canceled its reader. */
          }
        }
      },
      cancel() {
        abort();
      },
    });
    return new Response(body, {
      headers: {
        ...headers,
        "Content-Type": "application/x-ndjson",
        "X-Organic-Funding": "chatgpt-plan",
      },
    });
  } catch (error) {
    return failure(error);
  } finally {
    await release?.();
  }
}

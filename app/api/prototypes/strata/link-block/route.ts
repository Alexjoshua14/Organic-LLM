import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getStrataPageById } from "@/data/supabase/strata";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { searchWeb } from "@/lib/exa/client";
import { generateStrataLinkSummary } from "@/lib/llm/strata-link-block-summary";
import { createLogger } from "@/lib/logger";
import { checkStrataIngestLimit } from "@/lib/rate-limit/strata-ingest";
import { StrataLinkBlockProcessRequestSchema } from "@/lib/schemas/strata";
import { fetchUrlPreviewViaExa } from "@/lib/strata/fetch-url-exa";
import { assertSafePublicHttpsUrl } from "@/lib/strata/safe-url";
import {
  LINK_BLOCK_STATUS_COPY,
  type StrataLinkBlockResult,
  type StrataLinkBlockStatusCode,
  type StrataLinkBlockStatusEvent,
  type StrataLinkBlockStreamChunk,
} from "@/lib/strata/link-block-status";

export const maxDuration = 30;

const logger = createLogger("app/api/prototypes/strata/link-block/route.ts");

const COST_TARGET_USD = 0.005;

export async function POST(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data == null) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const sbUserId = sbUserIdResult.data;

  let bodyJson: unknown;

  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = StrataLinkBlockProcessRequestSchema.safeParse(bodyJson);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { pageId, blockId, url } = parsed.data;
  const safe = assertSafePublicHttpsUrl(url);

  if (!safe.ok) {
    return NextResponse.json({ error: safe.reason }, { status: 400 });
  }

  const limitResult = await checkStrataIngestLimit(sbUserId, pageId);

  if (!limitResult.success) {
    return NextResponse.json({ error: limitResult.error ?? "Too many requests" }, { status: 429 });
  }

  const pageBundle = await getStrataPageById(pageId);

  if (!pageBundle || pageBundle.page.owner_id !== sbUserId) {
    return NextResponse.json({ error: "Strata page not found" }, { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const writeChunk = (chunk: StrataLinkBlockStreamChunk) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
      };
      const writeStatus = (
        code: StrataLinkBlockStatusCode,
        message?: string,
        data?: Record<string, unknown>
      ) => {
        const event: StrataLinkBlockStatusEvent = {
          blockId,
          code,
          message: message ?? LINK_BLOCK_STATUS_COPY[code],
          at: new Date().toISOString(),
          data,
        };

        writeChunk({ type: "status", event });
      };

      (async () => {
        try {
          writeStatus("input_received");
          writeStatus("starting_web_search", `${LINK_BLOCK_STATUS_COPY.starting_web_search} on ${safe.href}`);
          const searchResult = await searchWeb(safe.href, { numResults: 3, type: "auto" });
          const topResult = searchResult.sources[0];

          if (topResult?.title) {
            writeStatus("results_ready", `Search results ready: ${topResult.title.slice(0, 120)}`);
          } else {
            writeStatus("results_ready");
          }

          writeStatus("fetching_content");
          const fetched = await fetchUrlPreviewViaExa(safe.href);

          if (!fetched.ok) {
            throw new Error(fetched.error);
          }

          writeStatus("summarizing");
          const summaryResult = await generateStrataLinkSummary({
            url: safe.href,
            titleHint: topResult?.title || fetched.titleHint || safe.href,
            extractedText: fetched.text,
            contextId: `${pageId}:${blockId}`,
          });

          if (summaryResult.error || !summaryResult.data) {
            throw summaryResult.error ?? new Error("Unable to summarize URL");
          }

          const estimatedCostUsd = Number(summaryResult.data.estimatedCostUsd.toFixed(6));
          const statusMessage =
            estimatedCostUsd > COST_TARGET_USD
              ? `Summary ready (cost guardrail exceeded: $${estimatedCostUsd.toFixed(4)})`
              : `Summary ready (~$${estimatedCostUsd.toFixed(4)})`;

          writeStatus("streaming_response", "Streaming back response");
          const result: StrataLinkBlockResult = {
            blockId,
            url: safe.href,
            title: summaryResult.data.title,
            summary: summaryResult.data.summary,
            estimatedCostUsd,
            canEscalate: true,
          };

          writeChunk({ type: "result", result });
          writeStatus("completed", statusMessage);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Link processing failed";

          logger.error("link_block", message);
          writeStatus("error", message);
          writeChunk({ type: "error", error: message });
        } finally {
          controller.close();
        }
      })().catch((error) => {
        logger.error("link_block", error instanceof Error ? error.message : String(error));
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

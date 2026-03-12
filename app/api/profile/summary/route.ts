import { auth } from "@clerk/nextjs/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ProfileSummarySchema } from "@/lib/schemas/profileSummary";
import { recordLlmCall } from "@/lib/llm/metrics";

const ResponseSchema = z.object({
  headline: z.string().max(120).describe("One short professional headline"),
  bio: z.string().max(500).describe("2-3 sentence professional bio"),
  tags: z.array(z.string().max(32)).max(8).describe("3-6 interest/skill tags"),
});

const SYSTEM = `You generate minimal, professional profile copy. Output only valid JSON with headline, bio, and tags. Be concise and neutral. No emoji.`;

/**
 * Cheap, lightweight LLM call to generate profile summary from display name and optional email.
 * Returns structured summary for caching and display.
 */
export async function POST(req: Request) {
  const user = await auth();
  if (!user?.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { displayName?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "User";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  const prompt = email
    ? `Display name: ${displayName}. Email domain: ${email.split("@")[1] ?? "unknown"}. Generate headline, bio, and tags.`
    : `Display name: ${displayName}. No email. Generate headline, bio, and tags.`;

  try {
    const start = performance.now();
    const { object, usage } = await generateObject({
      model: "google/gemini-3-flash",
      system: SYSTEM,
      prompt,
      schema: ResponseSchema,
      maxOutputTokens: 400,
    });
    const durationMs = performance.now() - start;

    recordLlmCall({
      model: "google/gemini-3-flash",
      usage,
      durationMs,
      metadata: { operation: "profile-summary", route: "/api/profile/summary" },
    });

    const summary = ProfileSummarySchema.parse({
      ...object,
      generatedAt: new Date().toISOString(),
    });

    return Response.json(summary);
  } catch (err) {
    console.error("Profile summary generation failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate profile summary" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

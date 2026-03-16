import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  convertToModelMessages,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { auth } from "@clerk/nextjs/server";
import { getMemories, addMemories } from "@mem0/vercel-ai-provider";
import { UIMessage } from "ai";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { getContext } from "@/lib/chat/chat-store";
import { saveChat } from "@/lib/chat/chat-store";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const logger = createLogger("app/api/ai/remy/route.ts");

const SYSTEM_HIGHLIGHT_PROMPT = `
You are **Remy**, an expert culinary co-chef assistant embedded within Organic LLM. You specialize in meal planning, recipe ideation, and helping users build and organize their smart recipe box. You have deep knowledge of cooking techniques, ingredient substitutions, dietary considerations, and meal preparation workflows.

**Role & Style**: Act as a knowledgeable but approachable culinary partner. Communicate warmly and conversationally, using clear and practical language. When suggesting recipes or meal plans, explain your reasoning briefly (why ingredients work together, what techniques to use, timing considerations). Be encouraging and adaptive to the user's skill level, time constraints, and preferences. Balance creativity with practicality.

**Core Capabilities**:

1. **Co-chef Ideation**: Generate recipe suggestions based on available ingredients, time constraints, mood, or dietary needs. Provide rationale for suggestions and offer alternatives with quick-action options like ingredient swaps, serving adjustments, or dietary modifications.

2. **Meal Planning**:a Help users plan meals across days or weeks. Consider variety, nutrition balance, ingredient reuse to minimize waste, and shopping efficiency. Generate organized shopping lists grouped by category or aisle.

3. **Smart Recipe Management**: Assist with importing, organizing, and retrieving recipes. Help normalize recipe formats into clean, structured cards with ingredients, steps, timers, substitutions, and nutrition info. Support both internal recipe cards and external links.

4. **Cooking Guidance**: Provide step-by-step cooking assistance with timer suggestions, technique tips, and troubleshooting advice. Adapt instructions based on user questions or issues during cooking.

**Memory & Context**: You maintain knowledge of user preferences (dietary restrictions, favorite cuisines, pantry staples, skill level), cooking history (what they've made, ratings, notes), and current context (ingredients on hand, upcoming meal plans). Reference this context naturally to provide personalized suggestions. If you're unsure about a preference or constraint, ask clarifying questions before making recommendations.

**Output Guidelines**:
- **Recipe suggestions**: Present 2-4 options with brief descriptions (cuisine type, prep/cook time, difficulty). Include a quick rationale for each.
- **Recipe cards**: Use structured format with clear sections: title, servings, time, ingredients (with quantities), numbered steps, optional notes for substitutions/tips.
- **Shopping lists**: Group by category (produce, dairy, pantry, etc.) with quantities aggregated across recipes.
- **Substitutions**: When suggesting swaps, explain the impact on flavor/texture and adjust other ingredients if needed.
- **Timing**: Be specific with cooking times and temperatures. Suggest when to set timers for critical steps.

**Constraints**:
- Prioritize food safety: always mention proper cooking temperatures for proteins, storage guidelines, and allergy considerations when relevant.
- If a user requests something outside culinary domains (e.g., non-food topics), politely redirect: "I'm specialized in cooking and meal planning. For that, you might want to check with the main Organic assistant."
- If nutritional information is approximate or unavailable, be transparent about limitations.
- Respect dietary restrictions strictly – never suggest ingredients that violate stated constraints (allergies, religious restrictions, etc.).

**Special Features**:
- When users mention specific ingredients they want to use up, prioritize those in suggestions
- For imported recipes, focus on normalizing format while preserving the creator's voice and key instructions
- Support various input methods: natural language ("what can I make with chicken and peppers?"), structured queries, or importing from URLs
- Mobile-first: Keep primary actions clear and prominent for ease of use while cooking
`;

const retrieveMemories = (memories: Array<{ memory?: string }>) => {
  if (!memories || memories.length === 0) return "";
  const systemPrompt =
    "These are the memories I have stored. Give more weightage to the question by users and try to answer that first. You have to modify your answer based on the memories I have provided. If the memories are irrelevant you can ignore them. Also don't reply to this section of the prompt, or the memories, they are only for your reference. The System prompt starts after text System Message: \n\n";
  const memoriesText = memories
    .map((memory) => memory.memory)
    .filter((memory): memory is string => memory != null)
    .map((memory) => `Memory: ${memory}\n\n`)
    .join("\n\n");

  return `System Message: ${systemPrompt} ${memoriesText}`;
};

export async function POST(req: Request) {
  const body = await req.json();
  const {
    message: incomingMessage,
    messages: incomingMessages,
    id,
    system,
    tools,
    persistToSupabase = true,
    isTmpChat = false,
  } = body;

  // In tmp mode, accept all messages; otherwise use single message
  const isTmpMode = isTmpChat || !persistToSupabase;
  const message = incomingMessage as UIMessage | undefined;
  const messages = incomingMessages as UIMessage[] | undefined;

  // Get authenticated user
  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get Supabase user ID for memory operations
  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return new Response("User not found in supabase", { status: 404 });
  }
  const sbUserId = sbUserIdResult.data;

  const messageLimitResult = await checkLlmMessageLimit(sbUserId);

  if (!messageLimitResult.success) {
    return new Response(
      JSON.stringify({
        error: messageLimitResult.error ?? "Too many requests",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Determine validated messages based on mode
  let validatedMessages: UIMessage[];
  let systemPromptForRequest = SYSTEM_HIGHLIGHT_PROMPT;

  if (isTmpMode && messages) {
    // Tmp mode: use all messages from client
    validatedMessages = messages;
    logger.log("POST", `Tmp mode: Received ${messages.length} messages`);
  } else if (message) {
    // Normal mode: use single message and load context
    logger.log(
      "POST",
      `Received message metadata: id=${message.id ?? "unknown"} role=${message.role} parts=${message.parts?.length ?? 0}`
    );

    // Save the user message (only if persisting to Supabase)
    if (persistToSupabase) {
      try {
        await saveChat({
          chatId: id,
          messages: [message], // Just the user's message
        });
        logger.log("POST", "User message saved optimistically");
      } catch (err) {
        logger.error("POST", `Failed to save user message optimistically: ${err}`);
        // Continue anyway - onFinish will try to save again
      }
    }

    // Load chat context to get full message history
    try {
      const chatContextResult = await getContext({
        chatId: id,
        limit: 10,
        message,
        memoryEnabled: false, // Remy uses its own memory layer
        // persona is optional and defaults to standard chat
      });

      if (chatContextResult.error) {
        logger.error("POST", `Error getting chat context: ${chatContextResult.error}`);
        validatedMessages = [message];
      } else {
        validatedMessages = [...(chatContextResult.data?.messages ?? []), message];
        // Merge any system prompt from context with Remy's system prompt
        if (chatContextResult.data?.context) {
          systemPromptForRequest = [SYSTEM_HIGHLIGHT_PROMPT, chatContextResult.data.context, system]
            .filter(Boolean)
            .join("\n");
        } else {
          systemPromptForRequest = [SYSTEM_HIGHLIGHT_PROMPT, system].filter(Boolean).join("\n");
        }
      }
    } catch (err) {
      logger.error("POST", `Error loading context: ${err}`);
      validatedMessages = [message];
    }
  } else {
    return new Response("Missing message or messages", { status: 400 });
  }

  // Search for relevant memories using Mem0 platform
  // Gracefully handle memory failures
  let memories: Array<{ memory?: string }> = [];
  let mem0Available = false; // Track if Mem0 is available

  if (validatedMessages && Array.isArray(validatedMessages) && validatedMessages.length > 0) {
    // Validate that all messages have the expected structure
    const validMessages = validatedMessages.filter(
      (msg) => msg && typeof msg === "object" && "role" in msg && "parts" in msg
    );

    if (validMessages.length > 0) {
      try {
        // Mem0 platform functions accept UIMessage format
        memories = await getMemories(validMessages as any, {
          user_id: sbUserId,
          rerank: true,
          threshold: 0.1,
        });
        mem0Available = true; // Mem0 is working
      } catch (err) {
        logger.error("POST", `Error searching memories (continuing without memory): ${err}`);
        // Continue without memory if search fails
        memories = [];
        mem0Available = false; // Mem0 is not available
      }
    }
  }
  const mem0Instructions = retrieveMemories(memories);

  // Combine system prompts
  const finalSystemPrompt = [systemPromptForRequest, mem0Instructions].filter(Boolean).join("\n");

  const streamTextConfig: Parameters<typeof streamText>[0] = {
    model: openai("gpt-4o"),
    messages: convertToModelMessages(validatedMessages),
    system: finalSystemPrompt,
    maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
  };

  // Only include tools if they're provided and have execute functions
  // (tools from frontend can't have execute, so we skip them)
  if (tools && typeof tools === "object" && Object.keys(tools).length > 0) {
    // Check if tools have execute functions (they should be Tool objects)
    const validTools = Object.fromEntries(
      Object.entries(tools).filter(
        ([, tool]: [string, unknown]) =>
          tool &&
          typeof tool === "object" &&
          "execute" in tool &&
          typeof (tool as { execute: unknown }).execute === "function"
      )
    );

    if (Object.keys(validTools).length > 0) {
      streamTextConfig.tools = validTools as typeof streamTextConfig.tools;
    }
  }

  const result = streamText(streamTextConfig);

  // Prepare to add memories after streaming (Mem0 platform)
  // Only create the task if we have valid messages AND Mem0 is available
  // Skip entirely if Mem0 is not available (e.g., 401 errors)
  let addMemoriesTask: Promise<Array<{ memory?: string }>> | null = null;

  if (!mem0Available) {
    logger.log(
      "POST",
      "Skipping addMemories - Mem0 is not available (detected from getMemories failure)"
    );
  } else if (
    validatedMessages &&
    Array.isArray(validatedMessages) &&
    validatedMessages.length > 0
  ) {
    // Validate that all messages have the expected structure
    // UIMessage should have: role, parts (array), and each part should have type
    const validMessages = validatedMessages.filter((msg) => {
      if (!msg || typeof msg !== "object") return false;
      if (!("role" in msg) || !("parts" in msg)) return false;
      if (!Array.isArray(msg.parts)) return false;

      // Ensure all parts have a type property
      return msg.parts.every(
        (part: unknown) =>
          part &&
          typeof part === "object" &&
          "type" in part &&
          typeof (part as { type: unknown }).type === "string"
      );
    });

    if (validMessages.length > 0) {
      try {
        // Log the messages being passed to help debug
        logger.log(
          "POST",
          `Attempting to add ${validMessages.length} messages to Mem0. First message structure: ${JSON.stringify(
            validMessages[0]
          )}`
        );
        addMemoriesTask = addMemories(validMessages as any, {
          user_id: sbUserId,
        });
        logger.log("POST", "addMemories task created successfully");
      } catch (err) {
        logger.error("POST", `Error creating addMemories task (continuing without memory): ${err}`);
        if (err instanceof Error) {
          logger.error("POST", `Error stack: ${err.stack}`);
        }
        addMemoriesTask = null;
      }
    } else {
      logger.log(
        "POST",
        `No valid messages found for addMemories (${validatedMessages.length} total messages)`
      );
    }
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Write retrieved memories if any
      if (memories && memories.length > 0) {
        writer.write({
          type: "data-mem0-get",
          data: {
            memories: memories.map((m) => ({
              memory: m.memory,
            })),
          },
        });
      }

      writer.merge(result.toUIMessageStream());

      // Add new memories after streaming completes
      if (addMemoriesTask) {
        try {
          const newMemories = await addMemoriesTask;

          if (newMemories && newMemories.length > 0) {
            writer.write({
              type: "data-mem0-update",
              data: {
                memories: newMemories.map((m: { memory?: string }) => ({
                  memory: m.memory,
                })),
              },
            });
          }
        } catch (err) {
          logger.error("POST", `Error adding messages to memory (continuing): ${err}`);
          // Continue even if memory addition fails
        }
      }
    },
    onFinish: async ({ messages }) => {
      try {
        // Save chat with all messages (only if persisting to Supabase)
        if (persistToSupabase) {
          await saveChat({ chatId: id, messages });

          // If this was a tmp chat with 2+ messages, mark it as saved
          if (isTmpMode && messages.length >= 2) {
            logger.log("POST", `Tmp chat ${id} has ${messages.length} messages, saved to Supabase`);
          }
        } else {
          logger.log(
            "POST",
            `Skipping Supabase save for tmp chat ${id} (${messages.length} messages)`
          );
        }
      } catch (err) {
        logger.error("POST", `Error in onFinish callback: ${err}`);
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}

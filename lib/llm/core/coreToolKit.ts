import { tool, ToolSet } from "ai";
import { z } from "zod";
import { getChats } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";
import { createMemorySearchTool } from "../llm-tool-kit";
import { createChat } from "@/lib/chat/chat-store";

const logger = createLogger("lib/llm/core/coreToolKit");

const PageMetadataSchema = z.object({
  relativeURL: z.url(),
  section: z.enum(["Chat", "Rabbit Holes", "Settings"]),
  description: z.string(),
  additionalDescription: z.string().max(40).optional(),
});

const chat = {
  relativeURL: "/chat",
  section: "Chat",
  description: "Chat page for user conversations. ",
  additionalDescription:
    "Core chat interface. Use this page for existing and new chats.",
};

const chatLoading = {
  relativeURL: "/chat/loading",
  section: "Chat",
  description: "Demonstration loading state for the chat page.",
  additionalDescription: "Temporary demo loading indicator for the chat page.",
};

const rabbitHoles = {
  relativeURL: "/rabbitholes",
  section: "Rabbit Holes",
  description: "Deep-dive exploration page for focused investigations.",
  additionalDescription: "For extended research and multi-step investigations.",
};

const settings = {
  relativeURL: "/settings",
  section: "Settings",
  description: "Page for user and system configuration.",
  additionalDescription: "Use to configure preferences and system options.",
};

export const pageMetadataObjects = {
  chat,
  chatLoading,
  rabbitHoles,
  settings,
};

/**
 * Input schema for the navigate tool
 */
export const NavigablePagesSchema = z.enum([
  ...Object.entries(pageMetadataObjects).map((page) => page[1].relativeURL),
]);

export const NavigablePagesData = [
  pageMetadataObjects.chat,
  pageMetadataObjects.chatLoading,
  pageMetadataObjects.rabbitHoles,
  pageMetadataObjects.settings,
];

export const NavigateToolInputSchema = z.object({
  page: NavigablePagesSchema.describe("The page or section to navigate to"),
  reason: z
    .string()
    .optional()
    .describe("Brief reason for why this route was chosen"),
});

/**
 * Input schema for the listThreads tool
 */
export const ListThreadsToolInputSchema = z.object({
  limit: z
    .number()
    .optional()
    .describe("Maximum number of threads to return (default: all)"),
});

/**
 * Creates the core toolkit with tools that Prometheus can use.
 * These tools enable routing, orchestration, and system coordination.
 *
 * @param userId - Optional user ID for user-specific operations
 * @returns Object containing core tools (navigate, listThreads)
 */
export function createCoreToolKit(userId?: string): {
  toolset: ToolSet;
  instructions?: string;
} {
  const toolset: ToolSet = {};

  if (userId) toolset["memorySearch"] = createMemorySearchTool(userId);

  const navigate = tool({
    description:
      "Navigate to a particular page or section. Use this when the user's intent clearly indicates they should be routed to a specific interface (chat, rabbit-hole, or settings).",
    inputSchema: NavigateToolInputSchema,
    execute: async ({ page, reason }) => {
      logger.log(
        "navigate",
        `Navigating to ${page}. Reason: ${reason || "Not provided"}`
      );

      let routeTarget: string = page;

      // Create new thread if navigating to chat

      if (page === chat.relativeURL) {
        let threadId: string | null = null;
        const chatResult = await createChat();
        if (chatResult.error || !chatResult.data) {
          logger.error(
            "navigate",
            `Failed to create chat thread: ${chatResult.error?.message || "Unknown error"}`
          );
          return {
            success: false,
            route: page,
            reason: reason || "Navigation requested",
            message: `Failed to create chat thread: ${chatResult.error?.message || "Unknown error"}`,
            error: chatResult.error?.message || "Failed to create chat thread",
          };
        }
        threadId = chatResult.data;
        logger.log("navigate", `Created new chat thread: ${threadId}`);
        routeTarget = `/chat/${threadId}`;
      }

      return {
        success: true,
        route: routeTarget,
        reason: reason || "Navigation requested",
        message: `Route target ${page}`,
      };
    },
    onInputStart: () => {
      logger.log("navigate", "Tool call starting");
    },
    onInputDelta: ({ inputTextDelta }) => {
      logger.log("navigate", `Tool call deleta`);
    },
    onInputAvailable: ({ input }) => {
      logger.log("navigate", "Completed input");
    },
  });
  toolset["navigate"] = navigate;

  const listThreads = tool({
    description:
      "Browse the user's existing conversation threads. Use this when you need to check if there are relevant existing conversations before deciding whether to start a new thread or continue an existing one.",
    inputSchema: ListThreadsToolInputSchema,
    execute: async ({ limit }) => {
      logger.log(
        "listThreads",
        `Fetching threads${limit ? ` (limit: ${limit})` : ""}`
      );

      try {
        const result = await getChats();

        if (result.error || !result.data) {
          return {
            success: false,
            threads: [],
            count: 0,
            error: result.error?.message || "Unknown error fetching threads",
          };
        }

        const threads = limit ? result.data.slice(0, limit) : result.data;

        return {
          success: true,
          threads: threads.map((thread) => ({
            id: thread.id,
            title: thread.title || "Untitled",
            updatedAt: thread.updated_at,
            pinned: thread.pinned || false,
          })),
          count: threads.length,
          totalCount: result.data.length,
        };
      } catch (error) {
        logger.error("listThreads", `Error fetching threads: ${error}`);
        return {
          success: false,
          threads: [],
          count: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
  toolset["listThreads"] = listThreads;

  return { toolset, instructions: JSON.stringify(pageMetadataObjects) };
}

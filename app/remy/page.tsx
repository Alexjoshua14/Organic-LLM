"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, ChefHat, MessageSquare, Sparkles, ArrowUp } from "lucide-react";
import { Button } from "@heroui/button";
import { useState, FormEvent, KeyboardEvent, useEffect } from "react";
import { Input } from "@heroui/input";

import { createChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { cleanupExpiredTmpChats } from "@/data/local/remy-chats";
import { glass } from "@/components/design-system/primitives";
import { findMatchingThread } from "@/lib/remy/thread-matching";
import Page from "@/components/layout/page";

const logger = createLogger("app/remy/page.tsx");

// Suggested topics for Remy
const suggestedTopics = [
  { title: "Dinner tonight", prompt: "Help me plan dinner for tonight" },
  { title: "Breakfast", prompt: "What should I make for breakfast?" },
  {
    title: "Hosting Event Saturday Plan",
    prompt: "I'm hosting an event on Saturday. Help me plan the menu and shopping list.",
  },
];

// Example saved recipes (in a real app, these would come from a database)
const savedRecipes = [
  { title: "Chicken Noodle Soup", id: "recipe-1" },
  { title: "Puff Pastry", id: "recipe-2" },
  { title: "Broccolini", id: "recipe-3" },
];

export default function RemyBrowsePage() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");

  // Cleanup expired tmp chats on mount
  useEffect(() => {
    cleanupExpiredTmpChats();
  }, []);

  const handleInputSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = inputText.trim();

    if (!text) {
      return;
    }

    // Clear input
    setInputText("");

    // Check if there's a matching existing thread
    try {
      const matchResult = await findMatchingThread(text);

      if (matchResult.error) {
        logger.error(
          "handleInputSubmit",
          `Error finding matching thread: ${matchResult.error.message}`
        );
        // Fall through to create tmp chat
      } else if (matchResult.data) {
        // Found a matching thread, navigate to it
        logger.log("handleInputSubmit", `Found matching thread: ${matchResult.data}`);
        router.push(`/remy/${matchResult.data}`);

        return;
      }
    } catch (err) {
      logger.error("handleInputSubmit", `Error checking for matching thread: ${err}`);
      // Fall through to create tmp chat
    }

    // No match found, route to tmp chat with initial message
    router.push(`/remy/tmp?initialMessage=${encodeURIComponent(text)}`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleInputSubmit(e as any);
    }
  };

  const handleTopicClick = async (topic: { title: string; prompt: string }) => {
    try {
      // First, check if there's a matching existing thread
      const matchResult = await findMatchingThread(topic.title);

      if (matchResult.error) {
        logger.error(
          "handleTopicClick",
          `Error finding matching thread: ${matchResult.error.message}`
        );
        // Fall through to create new chat
      } else if (matchResult.data) {
        // Found a matching thread, navigate to it
        logger.log("handleTopicClick", `Found matching thread: ${matchResult.data}`);
        router.push(`/remy/${matchResult.data}`);

        return;
      }

      // No match found, create a new chat
      const res = await createChat();

      if (res.error || res.data === null) {
        logger.error("handleTopicClick", "Error creating chat");

        return;
      }
      const id = res.data;

      router.push(`/remy/${id}?initialMessage=${encodeURIComponent(topic.prompt)}`);
    } catch (err) {
      logger.error("handleTopicClick", `Error: ${err}`);
    }
  };

  const handleRecipeClick = (recipeId: string) => {
    // Navigate to recipe view or chat about the recipe
    router.push(`/remy/${recipeId}`);
  };

  const handleNewChat = async () => {
    try {
      const res = await createChat();

      if (res.error || res.data === null) {
        logger.error("handleNewChat", "Error creating chat");

        return;
      }
      const id = res.data;

      router.push(`/remy/${id}`);
    } catch (err) {
      logger.error("handleNewChat", `Error: ${err}`);
    }
  };

  return (
    <Page className="block px-8 py-14">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-commissioner text-4xl font-light tracking-tight text-foreground mb-2">
            Remy
          </h1>
          <p className="text-muted-foreground text-sm">Your culinary co-chef assistant</p>
        </div>
        <Button
          className="bg-foreground text-background hover:opacity-80"
          startContent={<Plus size={16} />}
          onPress={handleNewChat}
        >
          New Chat
        </Button>
      </div>

      {/* Chat Input */}
      <div className="mb-12">
        <form className="w-full relative" onSubmit={handleInputSubmit}>
          <div
            className={cn(
              "relative rounded-lg",
              "before:absolute before:-inset-[2px] before:rounded-lg before:-z-10",
              "before:bg-gradient-to-r before:from-accent/40 before:via-accent/60 before:to-accent/40",
              "before:blur-md before:opacity-70"
            )}
          >
            <div className={cn(glass({ border: "all" }), "rounded-lg relative")}>
              <Input
                classNames={{
                  input: ["text-base", "py-4"],
                  inputWrapper: [
                    "h-auto min-h-[4rem]",
                    "bg-transparent border-0 shadow-none",
                    "hover:shadow-none",
                  ],
                  base: ["w-full"],
                }}
                endContent={
                  <Button
                    isIconOnly
                    className="bg-foreground text-background"
                    isDisabled={!inputText.trim()}
                    size="sm"
                    type="submit"
                  >
                    <ArrowUp size={16} />
                  </Button>
                }
                placeholder="Ask Remy anything about cooking, recipes, or meal planning... (Press Enter)"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
        </form>
      </div>

      {/* Saved Recipes Section */}
      {savedRecipes.length > 0 && (
        <div className="mb-12">
          <h2 className="font-commissioner text-2xl font-light text-foreground mb-4">
            Saved Recipes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedRecipes.map((recipe, index) => (
              <motion.div
                key={recipe.id}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  glass({ border: "all" }),
                  "rounded-lg shadow-sm",
                  "hover:shadow-md transition-all cursor-pointer group",
                  "p-6"
                )}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleRecipeClick(recipe.id)}
              >
                <div className="flex items-start gap-3">
                  <ChefHat className="text-muted-foreground mt-1 shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-commissioner text-lg font-light text-foreground line-clamp-2">
                      {recipe.title}
                    </h3>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Topics Section */}
      <div className="mb-12">
        <h2 className="font-commissioner text-2xl font-light text-foreground mb-4">
          Suggested Topics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suggestedTopics.map((topic, index) => (
            <motion.div
              key={topic.title}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                glass({ border: "all" }),
                "rounded-lg shadow-sm",
                "hover:shadow-md transition-all cursor-pointer group",
                "p-6"
              )}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleTopicClick(topic)}
            >
              <div className="flex items-start gap-3">
                <Sparkles className="text-muted-foreground mt-1 shrink-0" size={20} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-commissioner text-lg font-light text-foreground line-clamp-2">
                    {topic.title}
                  </h3>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Chats Section - Placeholder for now */}
      <div>
        <h2 className="font-commissioner text-2xl font-light text-foreground mb-4">Recent Chats</h2>
        <div className="flex flex-col items-center justify-center py-12 text-center border border-border rounded-lg bg-card/40">
          <MessageSquare className="text-muted-foreground mb-4" size={32} />
          <p className="font-commissioner text-lg text-muted-foreground mb-2 font-light">
            No recent chats yet
          </p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Start a new conversation to see your chats here
          </p>
          <Button
            className="bg-foreground text-background hover:opacity-80"
            startContent={<Plus size={16} />}
            onPress={handleNewChat}
          >
            Start New Chat
          </Button>
        </div>
      </div>
    </Page>
  );
}

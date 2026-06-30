"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { motion } from "framer-motion";

import { glass } from "@/components/design-system/primitives";
import { createChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { cn } from "@/lib/utils";

const logger = createLogger("homepage-primary-actions");

const ACTIONS_SPRING = { type: "spring" as const, stiffness: 300, damping: 32, mass: 0.88 };
const actionsTransition = { ...ACTIONS_SPRING, layout: { ...ACTIONS_SPRING } };

type HomepagePrimaryActionsProps = {
  variant?: "default" | "fullViewSecondary";
  className?: string;
};

export function HomepagePrimaryActions({
  variant = "default",
  className,
}: HomepagePrimaryActionsProps) {
  const router = useRouter();
  const { refreshSidebarChats } = useSharedChatContext();
  const [creating, setCreating] = useState(false);

  const handleLetsChat = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await createChat();

      if (res.error || res.data === null) {
        logger.error("handleLetsChat", res.error ? res.error.message : "Chat ID is null");

        return;
      }
      const id = res.data;

      refreshSidebarChats();
      router.push(`/chat/${id}`);
    } catch (error) {
      logger.error("handleLetsChat", `Error creating chat: ${error}`);
    } finally {
      setCreating(false);
    }
  }, [creating, refreshSidebarChats, router]);

  const isSecondary = variant === "fullViewSecondary";
  const btnClass = cn(
    isSecondary
      ? cn(glass({ opaque: true }), "text-sm opacity-80 hover:opacity-100 backdrop-invert-15")
      : cn(
          glass(),
          "backdrop-invert-25 hover:backdrop-invert-100 transition-all hover:scale-110 duration-1000"
        )
  );

  return (
    <motion.div
      layout
      className={cn(
        "flex min-w-0 flex-wrap justify-center",
        isSecondary ? "gap-x-3 gap-y-2" : "gap-10",
        className
      )}
      transition={actionsTransition}
    >
      <motion.div
        layout
        animate={{ scale: isSecondary ? 0.96 : 1, opacity: isSecondary ? 0.88 : 1 }}
        className="inline-flex"
        transition={actionsTransition}
      >
        <Button className={btnClass} isDisabled={creating} onPress={handleLetsChat}>
          Let&apos;s Chat
        </Button>
      </motion.div>
      <motion.div
        layout
        animate={{ scale: isSecondary ? 0.96 : 1, opacity: isSecondary ? 0.88 : 1 }}
        className="inline-flex"
        transition={actionsTransition}
      >
        <Button className={btnClass} onPress={() => router.push("/rabbitholes/browse")}>
          Rabbit Holes
        </Button>
      </motion.div>
      <motion.div
        layout
        animate={{ scale: isSecondary ? 0.96 : 1, opacity: isSecondary ? 0.88 : 1 }}
        className="inline-flex"
        transition={actionsTransition}
      >
        <Button className={btnClass} onPress={() => router.push("/sandbox/prototypes/strata")}>
          Strata
        </Button>
      </motion.div>
      <motion.div
        layout
        animate={{ scale: isSecondary ? 0.96 : 1, opacity: isSecondary ? 0.88 : 1 }}
        className="inline-flex"
        transition={actionsTransition}
      >
        <Button className={btnClass} onPress={() => router.push("/showcase/anatomy")}>
          Explore demo
        </Button>
      </motion.div>
      <motion.div
        layout
        animate={{ scale: isSecondary ? 0.96 : 1, opacity: isSecondary ? 0.88 : 1 }}
        className="inline-flex"
        transition={actionsTransition}
      >
        <Button className={btnClass} onPress={() => router.push("/settings")}>
          Settings
        </Button>
      </motion.div>
    </motion.div>
  );
}

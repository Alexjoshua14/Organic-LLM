"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AdminBlogLink } from "./admin-blog-link";
import { GatewaySmokeLink } from "./gateway-smoke-link";
import { SandboxGatewayButton } from "./sandbox-gateway-button";
import { ShowcaseGatewayButton } from "./showcase-gateway-button";
import { StatusGatewayButton } from "./status-gateway-button";

import { HomeComposerActionButton } from "@/components/chat/home-composer-action-button";

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

function ActionRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-2", className)}>
      {children}
    </div>
  );
}

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
  const primaryBtnClass = isSecondary ? "opacity-80 hover:opacity-100" : undefined;
  const rowScale = isSecondary ? 0.96 : 1;
  const rowOpacity = isSecondary ? 0.88 : 1;

  const wrap = (key: string, node: ReactNode) => (
    <motion.div
      key={key}
      layout
      animate={{ scale: rowScale, opacity: rowOpacity }}
      className="inline-flex"
      transition={actionsTransition}
    >
      {node}
    </motion.div>
  );

  return (
    <motion.div
      layout
      className={cn("flex min-w-0 flex-col items-center gap-3 sm:gap-3.5", className)}
      transition={actionsTransition}
    >
      <ActionRow>
        {wrap(
          "lets-chat",
          <HomeComposerActionButton
            className={primaryBtnClass}
            disabled={creating}
            onClick={() => void handleLetsChat()}
          >
            Let&apos;s Chat
          </HomeComposerActionButton>
        )}
        {wrap(
          "rabbit-holes",
          <HomeComposerActionButton
            className={primaryBtnClass}
            onClick={() => router.push("/rabbitholes/browse")}
          >
            Rabbit Holes
          </HomeComposerActionButton>
        )}
        {wrap(
          "strata",
          <HomeComposerActionButton
            className={primaryBtnClass}
            onClick={() => router.push("/sandbox/prototypes/strata")}
          >
            Strata
          </HomeComposerActionButton>
        )}
      </ActionRow>

      <ActionRow>
        {wrap("sandbox", <SandboxGatewayButton />)}
        {wrap("showcase", <ShowcaseGatewayButton />)}
        {wrap("blog", <AdminBlogLink />)}
      </ActionRow>

      <ActionRow>
        {wrap("status", <StatusGatewayButton />)}
        {wrap(
          "settings",
          <GatewaySmokeLink ariaLabel="Settings" href="/settings" label="Settings" />
        )}
      </ActionRow>
    </motion.div>
  );
}

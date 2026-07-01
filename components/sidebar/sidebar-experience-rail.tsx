"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { FeatureHint } from "@/components/onboarding/feature-hint";
import { Logger } from "@/lib/logger";
import { createChat } from "@/lib/chat/chat-store";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { cn } from "@/lib/utils";

const logger = new Logger(`components/sidebar/sidebar-experience-rail.tsx`);

type RailItem =
  | { id: "chat"; label: "Chat"; type: "action" }
  | {
      id: string;
      label: string;
      type: "link";
      href: string;
      match: (p: string) => boolean;
    };

const RAIL: RailItem[] = [
  { id: "chat", label: "Chat", type: "action" },
  {
    id: "arcadia",
    label: "Arcadia",
    type: "link",
    href: "/sandbox/arcadia",
    match: (p) => p.startsWith("/sandbox/arcadia"),
  },
  {
    id: "noesis",
    label: "Noesis",
    type: "link",
    href: "/sandbox/topic-explore",
    match: (p) => p.startsWith("/sandbox/topic-explore"),
  },
  {
    id: "strata",
    label: "Strata",
    type: "link",
    href: "/sandbox/prototypes/strata",
    match: (p) => p.startsWith("/sandbox/prototypes/strata"),
  },
  {
    id: "rabbitholes",
    label: "Rabbit",
    type: "link",
    href: "/rabbitholes/browse",
    match: (p) => p.startsWith("/rabbitholes"),
  },
  {
    id: "ergon",
    label: "Ergon",
    type: "link",
    href: "/ergon",
    match: (p) => p.startsWith("/ergon"),
  },
  {
    id: "remy",
    label: "Remy",
    type: "link",
    href: "/remy",
    match: (p) => p.startsWith("/remy"),
  },
];

const segmentClass = cn(
  "flex-1 min-w-0 cursor-pointer select-none text-center text-[10px] font-medium leading-tight",
  "px-1.5 py-2.5 sm:px-2 sm:py-3 sm:text-xs",
  "bg-background-tertiary text-foreground transition-colors",
  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  "active:bg-sidebar-accent active:text-sidebar-accent-foreground",
  "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
  "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
  "border-0 border-border/20 [&:not(:first-child)]:border-l"
);

/**
 * Experimental segmented rail: one contiguous strip (no gutter between cells).
 * Hover uses the same fill as the sidebar “active” treatment (`bg-sidebar-accent`).
 * Surface descriptions live in onboarding guides — not hover tooltips here.
 */
export function SidebarExperienceRail() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { refreshSidebarChats } = useSharedChatContext();

  const onNewChat = () => {
    async function run() {
      logger.log("SidebarExperienceRail", "Chat segment clicked");
      const res = await createChat();

      if (res.error || res.data === null) {
        logger.error("SidebarExperienceRail", "Error creating chat");

        return;
      }
      refreshSidebarChats();
      router.push(`/chat/${res.data}`);
    }
    void run();
  };

  const chatActive = pathname.startsWith("/chat");

  return (
    <FeatureHint id="experience-rail">
      <div className="flex w-full min-w-0 overflow-hidden rounded-md" data-sidebar-experience-rail>
        {RAIL.map((item) => {
          if (item.type === "action") {
            return (
              <button
                key={item.id}
                className={segmentClass}
                data-active={chatActive}
                type="button"
                onClick={onNewChat}
              >
                {item.label}
              </button>
            );
          }

          const active = item.match(pathname);

          return (
            <Link
              key={item.id}
              className={cn(segmentClass, "inline-flex items-center justify-center no-underline")}
              data-active={active}
              href={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </FeatureHint>
  );
}

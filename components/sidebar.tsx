"use client";

import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tooltip } from "@heroui/tooltip";
import {
  CrossIcon,
  LogInIcon,
  Pin,
  PinOff,
  Search,
  SquareMenu,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const SIDEBAR_WIDTH = "20rem";

type Thread = {
  title: string;
  id: string;
};

export function Sidebar() {
  const router = useRouter();

  const toggleThreadPinAction = useCallback(() => {
    console.log("toggleThreadPin");
  }, []);

  const deleteThreadAction = useCallback(() => {
    console.log("deleteThread");
  }, []);

  return (
    <div className="bg-background-secondary h-screen w-64 p-3">
      <div className="w-full h-full flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-center h-8">
          <div className="absolute top-5 left-4 right-0">
            {/*TODO: Fill this in with working menu button*/}
            <SquareMenu className="text-foreground" size={18} />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-lg">Organic LLM</h1>
          </div>
        </div>
        <div className="h-full w-full flex flex-col gap-4">
          <div className="w-full flex flex-col gap-2">
            {/* New Chat Button */}
            <div className="w-full rounded-md">
              <Button className="w-full">New Chat</Button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
              <Input
                label={<Search size={18} />}
                labelPlacement="outside-left"
                placeholder="Search your threads..."
                classNames={{
                  input: ["bg-transparent", "hover:bg-transparent"],
                  innerWrapper: ["bg-transparent", "hover:bg-transparent"],
                  inputWrapper: [
                    "bg-transparent",
                    "hover:bg-transparent",
                    "group-data-[focus=true]:bg-transparent",
                    "data-[hover=true]:bg-transparent",
                  ],
                  mainWrapper: [
                    "bg-transparent",
                    "focus-within:bg-transparent",
                  ],
                  base: ["border-b-1", "border-background-tertiary"],
                }}
              />
            </div>
          </div>

          {/* Threads */}
          <div className="flex-1 flex flex-col gap-4 w-full px-1">
            {/* Pinned threads */}
            <ChatThreadsList
              threads={pinned_threads}
              variant="pinned"
              toggleThreadPinAction={toggleThreadPinAction}
              deleteThreadAction={deleteThreadAction}
            />
            <ChatThreadsList
              threads={all_threads}
              toggleThreadPinAction={toggleThreadPinAction}
              deleteThreadAction={deleteThreadAction}
            />
          </div>
        </div>
        <div className="w-full flex gap-4">
          {/*TODO: Change py to 6 or so*/}
          <Button
            className="w-full border-0 flex justify-start px-4 py-8"
            variant="ghost"
          >
            <LogInIcon size={18} />
            <p>Login</p>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const ChatThreadsList = ({
  threads,
  variant,
  toggleThreadPinAction,
  deleteThreadAction,
}: {
  threads: Thread[];
  variant?: "DEFAULT" | "pinned";
  toggleThreadPinAction: () => void;
  deleteThreadAction: () => void;
}) => {
  return (
    <section className="w-full flex flex-col">
      {/*TODO Make collapsable*/}
      <div className="flex w-full items-end gap-1 text-xs font-bold">
        {variant === "pinned" ? (
          <>
            <Pin size={12} />
            <h2 className="">Pinned</h2>
          </>
        ) : (
          <>
            <h2 className="">Yesterday</h2>
          </>
        )}
      </div>
      <div className="flex flex-col">
        {threads.map((thread) => {
          // router.prefetch(`localhost:3000/chat/${thread.id}`);
          return (
            <Link
              key={thread.id}
              href={`localhost:3000/chat/${thread.id}`}
              className="font-medium text-sm w-full rounded hover:bg-background px-3 py-1 transition-colors duration-150 group overflow-hidden"
            >
              <div className="w-full flex text-foreground-secondary">
                <h3 className="flex-1 truncate py-1">{thread.title}</h3>
                <div className="relative w-14 z-10">
                  <div className="absolute -right-18 opacity-0 group-hover:right-0 group-hover:opacity-100 grid grid-cols-2 items-center transition-all duration-250 h-full">
                    <Tooltip
                      placement="bottom"
                      content={
                        variant === "pinned" ? "Unpin Thread" : "Pin Thread"
                      }
                      size="sm"
                      offset={1}
                      closeDelay={50}
                    >
                      <div
                        className="hover:bg-background-tertiary w-full h-full flex items-center justify-center rounded px-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleThreadPinAction();
                        }}
                      >
                        {variant === "pinned" ? (
                          <PinOff size={18} />
                        ) : (
                          <Pin size={18} />
                        )}
                      </div>
                    </Tooltip>
                    <Tooltip
                      placement="bottom"
                      content={"Delete Thread"}
                      size="sm"
                      offset={1}
                      closeDelay={50}
                    >
                      <div
                        className="hover:bg-background-tertiary w-full h-full flex items-center justify-center rounded px-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteThreadAction();
                        }}
                      >
                        <XIcon size={18} />
                      </div>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

const pinned_threads: Thread[] = [
  {
    title: "AI Explained",
    id: "550e8400-e29b-41d4-a716-446655440000",
  },
];

const all_threads: Thread[] = [
  {
    title: "Introspection",
    id: "920e2901-e29b-41d4-a716-40127594991",
  },
  {
    title: "Random title that is too long for displaying",
    id: "891a1200-b93e-22b9-c9544-882931002384",
  },
  {
    title: "AI Explained",
    id: "550e8400-e29b-41d4-a716-446655440000",
  },
];

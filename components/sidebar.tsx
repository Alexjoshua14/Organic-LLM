"use client";

import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { LogInIcon, Pin, Search, SquareMenu } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SIDEBAR_WIDTH = "20rem";

type Thread = {
  title: string;
  id: string;
};

export function Sidebar() {
  const router = useRouter();

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

  return (
    <div className="bg-secondary h-screen w-64 p-3">
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
                  base: ["border-b-1", "border-border"],
                }}
              />
            </div>
          </div>

          {/* Threads */}
          <div className="flex-1 flex flex-col gap-6 w-full px-2">
            {/* Pinned threads */}
            <div className="w-full flex flex-col gap-3">
              {/*TODO Make collapsable*/}
              <div className="flex w-full items-end gap-1">
                <Pin size={12} />
                <h2 className="text-xs font-bold">Pinned</h2>
              </div>
              <div className="flex flex-col gap-2 px-2">
                {pinned_threads.map((thread) => {
                  // router.prefetch(`localhost:3000/chat/${thread.id}`);
                  return (
                    <Link
                      key={thread.id}
                      href={`localhost:3000/chat/${thread.id}`}
                      className="font-medium text-sm"
                    >
                      <h3 className="truncate">{thread.title}</h3>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="w-full flex flex-col gap-3">
              {/*TODO Make collapsable*/}
              <div className="flex w-full items-end gap-1">
                <h2 className="text-xs font-bold">Yesterday</h2>
              </div>
              <div className="flex flex-col gap-2 px-2">
                {all_threads.map((thread, index) => {
                  // if (index < 3) {
                  //   router.prefetch(`localhost:3000/chat/${thread.id}`);
                  // }
                  return (
                    <Link
                      key={thread.id}
                      href={`localhost:3000/chat/${thread.id}`}
                      className="font-medium text-sm"
                    >
                      <h3 className="truncate">{thread.title}</h3>
                    </Link>
                  );
                })}
              </div>
            </div>
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

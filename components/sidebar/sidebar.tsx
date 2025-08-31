import { Calendar, Home, Inbox, Search, Settings } from "lucide-react";
import { Input } from "@heroui/input";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignOutButton,
  SignUpButton,
} from "@clerk/nextjs";

import { SidebarChats } from "./sidebar-chats";
import { SidebarNewChat } from "./sidebar-new-chat";

import { ThreadLink } from "@/types";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const items = [
  {
    title: "Home",
    url: "#",
    icon: Home,
  },
  {
    title: "Inbox",
    url: "#",
    icon: Inbox,
  },
  {
    title: "Calendar",
    url: "#",
    icon: Calendar,
  },
  {
    title: "Search",
    url: "#",
    icon: Search,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
];

export function Sidebar() {
  return (
    <ShadcnSidebar>
      <SidebarHeader className="h-12 pl-7 grid place-content-center bg-background-secondary subpixel-antialiased">
        <h1 className="font-bold tracking-tight text-lg">Organic LLM</h1>
      </SidebarHeader>
      <SidebarContent className="bg-background-secondary subpixel-antialiased">
        <SignedOut>
          <SidebarGroup>
            <SidebarGroupContent className="w-full flex flex-col gap-4 items-center justify-center">
              <SidebarMenuButton asChild>
                <SignInButton />
              </SidebarMenuButton>

              <SidebarMenuButton asChild>
                <SignUpButton />
              </SidebarMenuButton>
            </SidebarGroupContent>
          </SidebarGroup>
        </SignedOut>
        <SignedIn>
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarNewChat />
                <Input
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
                  label={<Search size={18} />}
                  labelPlacement="outside-left"
                  placeholder="Search your threads..."
                />
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarChats />
            {/*<Collapsible className="group/collapsible" defaultOpen>
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger>
                    <div className="flex items-end gap-1 text-foreground">
                      <Pin size={13} />
                      <h2>Pinned</h2>
                    </div>
                    <ChevronUp className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarChatList
                    threads={all_threads.filter((t) => t.pinned)}
                  />
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
            <SidebarGroup>
              <SidebarGroupLabel>
                <div className="text-foreground">
                  <h2>All Threads</h2>
                </div>
              </SidebarGroupLabel>
              <SidebarChatList threads={all_threads.filter((t) => !t.pinned)} />
            </SidebarGroup>*/}
          </>
        </SignedIn>
      </SidebarContent>
      <SidebarFooter>
        <SignedIn>
          <SignOutButton />
        </SignedIn>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}

const all_threads: ThreadLink[] = [
  {
    title: "Introspection",
    id: "920e2901-e29b-41d4-a716-40127594991",
    pinned: false,
    date: "2025-08-21T00:00:00.000Z",
  },
  {
    title: "Random title that is too long for displaying",
    id: "891a1200-b93e-22b9-c9544-882931002384",
    pinned: false,
    date: "2025-08-20T00:00:00.000Z",
  },
  {
    title: "AI Explained",
    id: "550e8400-e29b-41d4-a716-446655440000",
    pinned: true,
    date: "2025-08-21T00:00:00.000Z",
  },
];

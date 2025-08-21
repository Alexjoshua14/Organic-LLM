import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Home,
  Inbox,
  Pin,
  Search,
  Settings,
} from "lucide-react";

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { Input } from "@heroui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

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
      <SidebarHeader className="h-12 bg-pink-200 pl-7 grid place-content-center">
        <h1 className="font-bold tracking-tight text-lg">Organic LLM</h1>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenuButton asChild>
              <Link
                href="/"
                className="w-full rounded bg-background-tertiary cursor-pointer flex items-center justify-center py-5 px-4 text-sm font-medium"
              >
                New Chat
              </Link>
            </SidebarMenuButton>
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
                mainWrapper: ["bg-transparent", "focus-within:bg-transparent"],
                base: ["border-b-1", "border-background-tertiary"],
              }}
            />
          </SidebarGroupContent>
        </SidebarGroup>
        <Collapsible className="group/collapsible" defaultOpen>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <div className="flex items-end gap-1">
                  <Pin size={13} />
                  <h2 className="">Pinned</h2>
                </div>
                <ChevronUp className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <a href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
    </ShadcnSidebar>
  );
}

type Thread = {
  title: string;
  id: string;
  pinned: boolean;
};

const all_threads: Thread[] = [
  {
    title: "Introspection",
    id: "920e2901-e29b-41d4-a716-40127594991",
    pinned: false,
  },
  {
    title: "Random title that is too long for displaying",
    id: "891a1200-b93e-22b9-c9544-882931002384",
    pinned: false,
  },
  {
    title: "AI Explained",
    id: "550e8400-e29b-41d4-a716-446655440000",
    pinned: true,
  },
];

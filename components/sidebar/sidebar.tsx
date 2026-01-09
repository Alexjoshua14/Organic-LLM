import { Search } from "lucide-react";
import { Input } from "@heroui/input";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignOutButton,
  SignUpButton,
} from "@clerk/nextjs";
import Link from "next/link";

import { SidebarChats } from "./sidebar-chats";
import { SidebarNewChat } from "./sidebar-new-chat";

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenuButton,
} from "@/components/third-party/ui/sidebar";
import { SidebarProjectLink } from "./sidebar-project-link";
import { Suspense } from "react";

export function Sidebar() {
  return (
    <ShadcnSidebar>
      <SidebarHeader className="h-16 pl-7 grid place-content-center bg-background-secondary subpixel-antialiased">
        <Link
          className="group/brand cursor-pointer active:scale-95 transition-transform duration-150 font-commissioner"
          href="/"
        >
          <h1 className="font-medium tracking-tight text-lg bg-linear-to-tl from-foreground-secondary to-foreground text-transparent bg-clip-text group-hover/brand:from-foreground duration-300 transition-colors">
            Organic LLM
          </h1>
        </Link>
      </SidebarHeader>
      <SidebarContent className="bg-background-secondary subpixel-antialiased flex flex-col overflow-hidden">
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
            <SidebarGroup className="flex-1">
              <SidebarGroupContent className="flex flex-col gap-3">
                <SidebarNewChat />
                <SidebarProjectLink href="/rabbitholes/browse" title="Rabbit Holes" tooltip="Browse rabbit holes" />
                <SidebarProjectLink href="/remy" title="Remy" tooltip="Chat with Remy, your culinary co-chef" />
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
            <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
              <SidebarChats />
            </Suspense>
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

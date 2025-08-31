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
import Link from "next/link";

export function Sidebar() {
  return (
    <ShadcnSidebar>
      <SidebarHeader className="h-12 pl-7 grid place-content-center bg-background-secondary subpixel-antialiased">
        <Link href="/" className="group/brand cursor-pointer active:scale-95 transition-transform duration-150">
          <h1 className="font-bold tracking-tight text-lg bg-gradient-to-tl from-foreground-secondary to-foreground text-transparent bg-clip-text group-hover/brand:from-foreground duration-300 transition-colors">Organic LLM</h1>
        </Link>
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

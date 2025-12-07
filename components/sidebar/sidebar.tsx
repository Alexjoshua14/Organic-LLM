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

export function Sidebar() {
  return (
    <ShadcnSidebar>
      <SidebarHeader className="h-12 pl-7 grid place-content-center bg-background-secondary subpixel-antialiased">
        <Link
          className="group/brand cursor-pointer active:scale-95 transition-transform duration-150"
          href="/"
        >
          <h1 className="font-bold tracking-tight text-lg bg-gradient-to-tl from-foreground-secondary to-foreground text-transparent bg-clip-text group-hover/brand:from-foreground duration-300 transition-colors">
            Organic LLM
          </h1>
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
              <SidebarGroupContent className="flex flex-col gap-3">
                <SidebarNewChat />
                <SidebarMenuButton
                  asChild
                  tooltip="Browse rabbit holes"
                  className="w-full rounded bg-background-tertiary cursor-pointer flex items-center justify-center py-5 px-4 text-sm font-medium"
                >
                  <Link href="/rabbitholes/browse" className="w-full text-center">
                    Rabbit Holes
                  </Link>
                </SidebarMenuButton>
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

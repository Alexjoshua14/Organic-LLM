"use client";
import { SidebarMenuButton } from "../third-party/ui/sidebar";

import Link from "next/link";

interface SidebarProjectLinkProps {
  href: string,
  title: string,
  tooltip?: string
}

export const SidebarProjectLink = ({ href, title, tooltip }: SidebarProjectLinkProps) => {
  return (
    <SidebarMenuButton
      asChild
      tooltip={tooltip ?? title}
      className="w-full rounded bg-background-tertiary cursor-pointer flex items-center justify-center py-5 px-4 text-sm font-medium"
    >
      <Link href={href} className="w-full text-center">
        {title}
      </Link>
    </SidebarMenuButton>
  );
};


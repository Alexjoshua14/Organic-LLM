"use client";
import Link from "next/link";

import { SidebarMenuButton } from "../third-party/ui/sidebar";

interface SidebarProjectLinkProps {
  href: string;
  title: string;
  tooltip?: string;
}

export const SidebarProjectLink = ({ href, title, tooltip }: SidebarProjectLinkProps) => {
  return (
    <SidebarMenuButton
      asChild
      className="w-full rounded bg-background-tertiary cursor-pointer flex items-center justify-center py-5 px-4 text-sm font-medium"
      tooltip={tooltip ?? title}
    >
      <Link className="w-full text-center select-none" href={href}>
        {title}
      </Link>
    </SidebarMenuButton>
  );
};

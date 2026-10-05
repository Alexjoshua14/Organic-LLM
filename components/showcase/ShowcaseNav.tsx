"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Code2 } from "lucide-react";

import { ThemeSwitch } from "@/components/shared/theme-switch";

export function ShowcaseNav() {
  const pathname = usePathname();
  const inShowcase = pathname === "/showcase" || pathname?.startsWith("/showcase/");

  return (
    <header className="showcase-nav">
      <Link className="showcase-wordmark" href="/">
        Organic LLM
      </Link>
      <nav aria-label="Showcase navigation" className="showcase-nav-links">
        <Link
          aria-current={pathname === "/showcase" ? "page" : undefined}
          className="showcase-nav-detail"
          data-active={inShowcase ? "true" : undefined}
          href="/showcase"
        >
          Showcase
        </Link>
        <a
          aria-label="Organic LLM on GitHub"
          className="showcase-icon-link"
          href="https://github.com/Alexjoshua14/Organic-LLM"
          rel="noreferrer"
          target="_blank"
        >
          <Code2 aria-hidden size={18} />
        </a>
        <ThemeSwitch className="size-11" variant="compact" />
        <Link className="showcase-app-link" href="/chat">
          Open app <ArrowUpRight aria-hidden size={15} />
        </Link>
      </nav>
    </header>
  );
}

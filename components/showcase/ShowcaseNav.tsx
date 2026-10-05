"use client";

import Link from "next/link";
import { ArrowUpRight, Code2 } from "lucide-react";

import { ThemeSwitch } from "@/components/shared/theme-switch";

export function ShowcaseNav() {
  return (
    <header className="showcase-nav">
      <Link className="showcase-wordmark" href="/showcase">
        Organic LLM
      </Link>
      <nav aria-label="Showcase navigation" className="showcase-nav-links">
        <Link className="showcase-nav-detail" href="/showcase#demos">
          Demos
        </Link>
        <Link className="showcase-nav-detail" href="/showcase#engineering">
          How it works
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

"use client";

import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";

import styles from "./public-site-header.module.css";

import { welcomeCopy } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

type PublicSiteHeaderProps = {
  className?: string;
};

/**
 * Public navigation for the signed-out welcome page and Showcase. Rendering it hides the app
 * sidebar and control cluster. Sign in shows until Clerk confirms a session, so signed-out
 * visitors never see it pop in.
 */
export function PublicSiteHeader({ className }: PublicSiteHeaderProps) {
  const { isSignedIn } = useAuth();

  return (
    <header className={cn(styles.header, className)}>
      <Link className={styles.brand} href="/" aria-label="Organic LLM home">
        {welcomeCopy.headline}
      </Link>
      <nav className={styles.navigation} aria-label="Site navigation">
        <Link className={styles.navLink} href="/showcase">
          Showcase
        </Link>
        {isSignedIn ? null : (
          <SignInButton mode="modal">
            <button className={styles.navLink} type="button">
              {welcomeCopy.cta.signIn}
            </button>
          </SignInButton>
        )}
      </nav>
    </header>
  );
}

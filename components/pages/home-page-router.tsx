"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";

import { HomePageShell } from "./home-page-shell";
import { WelcomeHero } from "./welcome/welcome-hero";

export function HomePageRouter() {
  return (
    <>
      <SignedOut>
        <WelcomeHero />
      </SignedOut>
      <SignedIn>
        <HomePageShell />
      </SignedIn>
    </>
  );
}

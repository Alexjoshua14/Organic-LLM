"use client";

import { SignedIn, useAuth } from "@clerk/nextjs";

import { HomePageShell } from "./home-page-shell";
import { WelcomeHero } from "./welcome/welcome-hero";

type HomePageRouterProps = {
  /**
   * Server auth hint. Lets the welcome page render in the first HTML, so its CSS hides the
   * app sidebar and control cluster before Clerk loads. Clerk's client state wins once loaded.
   */
  initialSignedOut?: boolean;
};

export function HomePageRouter({ initialSignedOut = false }: HomePageRouterProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const signedOut = isLoaded ? !isSignedIn : initialSignedOut;

  return (
    <>
      {signedOut ? <WelcomeHero /> : null}
      <SignedIn>
        <HomePageShell />
      </SignedIn>
    </>
  );
}

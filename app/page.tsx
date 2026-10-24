import type { Metadata } from "next";

import { auth } from "@clerk/nextjs/server";

import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";
import Home from "@/components/pages/home";
import { welcomeCopy } from "@/lib/welcome/copy";

export const metadata: Metadata = {
  title: {
    absolute: welcomeCopy.meta.title,
  },
  description: welcomeCopy.meta.description,
};

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <>
      <LiquidChromeSsrFill id="home-liquid-chrome-ssr-fill" />
      <Home initialSignedOut={!userId} />
    </>
  );
}

import type { Metadata } from "next";

import { SpeakShell } from "./_components/SpeakShell";

import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Speak"),
};

export default function SpeakPage() {
  return <SpeakShell />;
}

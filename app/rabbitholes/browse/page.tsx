import type { Metadata } from "next";

import { RabbitHolesBrowseContent } from "./_components/BrowseContent";

import { getAllSessions } from "@/data/supabase/rabbitholes";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Rabbit holes"),
};

export default async function RabbitHolesBrowsePage() {
  const res = await getAllSessions();
  const initialSessions = res.data ?? [];

  return <RabbitHolesBrowseContent initialSessions={initialSessions} />;
}

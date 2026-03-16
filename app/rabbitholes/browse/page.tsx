import { RabbitHolesBrowseContent } from "./_components/BrowseContent";

import { getAllSessions } from "@/data/supabase/rabbitholes";

export default async function RabbitHolesBrowsePage() {
  const res = await getAllSessions();
  const initialSessions = res.data ?? [];

  return <RabbitHolesBrowseContent initialSessions={initialSessions} />;
}

import { getAllSessions } from "@/data/supabase/rabbitholes";
import { RabbitHolesBrowseContent } from "./_components/BrowseContent";

export default async function RabbitHolesBrowsePage() {
  const res = await getAllSessions();
  const initialSessions = res.data ?? [];

  return <RabbitHolesBrowseContent initialSessions={initialSessions} />;
}

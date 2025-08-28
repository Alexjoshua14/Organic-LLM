"use server";

import { supabaseServer } from "@/lib/supabase/server";

export async function listTasks(): Promise<any> {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("tasks").select("*");
  if (error) throw error;
  return data;
}

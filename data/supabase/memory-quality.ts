import "server-only";

import type {
  MemoryFeedbackRow,
  MemoryFeedbackSignal,
  MemoryFeedbackSource,
  MemoryQualityDailyRow,
  MemoryQualityEventType,
  MemoryQualitySource,
} from "@/lib/schemas/memory-quality";

import { supabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("data/supabase/memory-quality");

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function insertMemoryFeedbackRow(args: {
  userId: string;
  memoryId: string;
  signal: MemoryFeedbackSignal;
  source: MemoryFeedbackSource;
  chatId?: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: true };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from("memory_feedback").insert({
    user_id: args.userId,
    memory_id: args.memoryId,
    signal: args.signal,
    source: args.source,
    chat_id: args.chatId ?? null,
    note: args.note ?? null,
  });

  if (error) {
    logger.error("insertMemoryFeedbackRow", error.message);

    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function insertMemoryQualityEventRow(args: {
  userId: string;
  event: MemoryQualityEventType;
  source: MemoryQualitySource;
  memoryId?: string;
  charCount?: number;
  wordCount?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: true };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from("memory_quality_events").insert({
    user_id: args.userId,
    event: args.event,
    source: args.source,
    memory_id: args.memoryId ?? null,
    char_count: args.charCount ?? null,
    word_count: args.wordCount ?? null,
    metadata: args.metadata ?? {},
  });

  if (error) {
    logger.error("insertMemoryQualityEventRow", error.message);

    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function listMemoryFeedback(args: {
  userId?: string;
  limit?: number;
}): Promise<{ data: MemoryFeedbackRow[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null };
  }

  const sb = await supabaseServer();
  let query = sb
    .from("memory_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 50);

  if (args.userId) {
    query = query.eq("user_id", args.userId);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as MemoryFeedbackRow[], error: null };
}

export async function listMemoryQualityDaily(args: {
  userId: string;
  days?: number;
}): Promise<{ data: MemoryQualityDailyRow[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null };
  }

  const sb = await supabaseServer();
  const since = new Date();

  since.setDate(since.getDate() - (args.days ?? 30));

  const { data, error } = await sb
    .from("memory_quality_daily")
    .select("*")
    .eq("user_id", args.userId)
    .gte("day", since.toISOString().slice(0, 10))
    .order("day", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as MemoryQualityDailyRow[], error: null };
}

export async function upsertMemoryQualityDailyRow(
  row: Omit<MemoryQualityDailyRow, "id" | "updated_at"> & { id?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: true };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from("memory_quality_daily").upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,day,source" }
  );

  if (error) {
    logger.error("upsertMemoryQualityDailyRow", error.message);

    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function fetchMemoryQualityEventsForDay(args: {
  userId: string;
  day: string;
}): Promise<{
  data: Array<{
    event: MemoryQualityEventType;
    source: MemoryQualitySource;
    char_count: number | null;
    metadata: Record<string, unknown>;
  }>;
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null };
  }

  const sb = await supabaseServer();
  const start = `${args.day}T00:00:00.000Z`;
  const end = `${args.day}T23:59:59.999Z`;

  const { data, error } = await sb
    .from("memory_quality_events")
    .select("event, source, char_count, metadata")
    .eq("user_id", args.userId)
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) {
    return { data: [], error: error.message };
  }

  return {
    data: (data ?? []) as Array<{
      event: MemoryQualityEventType;
      source: MemoryQualitySource;
      char_count: number | null;
      metadata: Record<string, unknown>;
    }>,
    error: null,
  };
}

export async function fetchFeedbackCountsForDay(args: {
  userId: string;
  day: string;
}): Promise<{ up: number; down: number; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { up: 0, down: 0, error: null };
  }

  const sb = await supabaseServer();
  const start = `${args.day}T00:00:00.000Z`;
  const end = `${args.day}T23:59:59.999Z`;

  const { data, error } = await sb
    .from("memory_feedback")
    .select("signal")
    .eq("user_id", args.userId)
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) {
    return { up: 0, down: 0, error: error.message };
  }

  const rows = data ?? [];
  const up = rows.filter((r) => r.signal === "up").length;
  const down = rows.filter((r) => r.signal === "down").length;

  return { up, down, error: null };
}

export async function fetchLastEvalRun(userId: string): Promise<{
  data: {
    mode: string;
    total: number;
    passed: number;
    failed: number;
    avgCharCount: number;
    at: string;
  } | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: null };
  }

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("memory_quality_events")
    .select("metadata, created_at")
    .eq("user_id", userId)
    .eq("event", "eval_run")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data?.metadata || typeof data.metadata !== "object") {
    return { data: null, error: null };
  }

  const meta = data.metadata as Record<string, unknown>;

  return {
    data: {
      mode: String(meta.dryRun === true ? "dry" : "live"),
      total: Number(meta.total ?? 0),
      passed: Number(meta.passed ?? 0),
      failed: Number(meta.failed ?? 0),
      avgCharCount: Number(meta.avgCharCount ?? 0),
      at: data.created_at,
    },
    error: null,
  };
}

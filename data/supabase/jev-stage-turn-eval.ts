import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import {
  decryptFromStorage,
  encryptForStorage,
  isEncryptedPayload,
} from "@/lib/crypto/message-encryption";

export type JevStageTurnEvalRow = {
  turnId: string;
  signal: "up" | "down";
  note: string | null;
  revision: number;
};

function decodeNote(userId: string, turnId: string, ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  if (!isEncryptedPayload(ciphertext)) return null;

  try {
    return decryptFromStorage(ciphertext, {
      userId,
      threadId: `jev-stage-eval:${turnId}`,
      fieldName: "jev-stage.eval.note",
    });
  } catch {
    return null;
  }
}

export async function upsertJevStageTurnEval(args: {
  userId: string;
  turnId: string;
  signal: "up" | "down";
  note?: string | null;
}): Promise<{ data: JevStageTurnEvalRow | null; error: string | null }> {
  const supabase = await supabaseServer();
  const note = args.note?.trim() ? args.note.trim().slice(0, 500) : null;
  const note_ciphertext = note
    ? encryptForStorage(note, {
        userId: args.userId,
        threadId: `jev-stage-eval:${args.turnId}`,
        fieldName: "jev-stage.eval.note",
      })
    : null;

  const { data, error } = await supabase
    .from("jev_stage_turn_eval")
    .upsert(
      {
        user_id: args.userId,
        turn_id: args.turnId,
        signal: args.signal,
        note_ciphertext,
      },
      { onConflict: "user_id,turn_id" }
    )
    .select("turn_id, signal, note_ciphertext, revision")
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return {
    data: {
      turnId: data.turn_id,
      signal: data.signal as "up" | "down",
      note: decodeNote(args.userId, data.turn_id, data.note_ciphertext),
      revision: data.revision,
    },
    error: null,
  };
}

export async function getJevStageTurnEval(args: {
  userId: string;
  turnId: string;
}): Promise<{ data: JevStageTurnEvalRow | null; error: string | null }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("jev_stage_turn_eval")
    .select("turn_id, signal, note_ciphertext, revision")
    .eq("user_id", args.userId)
    .eq("turn_id", args.turnId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return {
    data: {
      turnId: data.turn_id,
      signal: data.signal as "up" | "down",
      note: decodeNote(args.userId, data.turn_id, data.note_ciphertext),
      revision: data.revision,
    },
    error: null,
  };
}

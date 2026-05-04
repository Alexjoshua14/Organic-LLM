import { mock } from "bun:test";

import { MockSupabaseClient } from "./mock-supabase";

/**
 * Single `supabaseServer` mock used across preload and unit tests so last-loaded
 * test file cannot replace the registry and strand another suite on the wrong client.
 */
export const supabaseServerMock = mock(async () => new MockSupabaseClient());

export function registerSharedSupabaseServerMock(): void {
  mock.module("@/lib/supabase/server", () => ({
    supabaseServer: supabaseServerMock,
  }));
}

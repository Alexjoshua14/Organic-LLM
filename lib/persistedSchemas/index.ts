"use server";

import { Result } from "@/types";
import {
  PersistedSchema,
  PersistedSchemaType,
} from "@/app/sandbox/aion/_components/persisted-schemas-container";
import { supabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/persistedSchemas/index.ts");

export async function getPersistedSchemas(
  threadId: string
): Promise<Result<PersistedSchemaType[]>> {
  try {
    const sb = await supabaseServer();

    const { data, error } = await sb
      .from("threads")
      .select("persisted_schemas")
      .eq("id", threadId)
      .single();

    logger.log(
      "getPersistedSchemas",
      `Fetched persisted_schemas for threadId=${threadId}: ${JSON.stringify(data?.persisted_schemas)}`
    );

    if (error) {
      if (error.code === "PGRST116") {
        // No row found, return empty array
        return {
          data: [],
          error: null,
        };
      }
      logger.error(
        "getPersistedSchemas",
        `Error fetching schemas: ${error.message}`
      );
      return {
        data: [],
        error: error,
      };
    }

    // Decode schemas with zod to ensure correct types/validation before returning
    let decodedSchemas: PersistedSchemaType[] = [];
    if (data?.persisted_schemas && Array.isArray(data.persisted_schemas)) {
      try {
        decodedSchemas = data.persisted_schemas.map((item: any) =>
          PersistedSchema.decode(item)
        );
      } catch (e) {
        logger.error(
          "getPersistedSchemas",
          `Error decoding persisted schemas with Zod: ${e}`
        );
        // Optionally fall back to empty array if decode fails entirely
        return {
          data: [],
          error: e instanceof Error ? e : new Error(String(e)),
        };
      }
    }

    return {
      data: decodedSchemas,
      error: null,
    };
  } catch (error) {
    logger.error("getPersistedSchemas", `Unexpected error: ${error}`);
    return {
      data: [],
      error:
        error instanceof Error
          ? error
          : new Error("Failed to get persisted schemas"),
    };
  }
}

export async function setPersistedSchemas(
  threadId: string,
  schemas: PersistedSchemaType[]
): Promise<Result<boolean>> {
  try {
    const sb = await supabaseServer();

    const { error } = await sb
      .from("threads")
      .update({ persisted_schemas: schemas })
      .eq("id", threadId);

    if (error) {
      logger.error(
        "setPersistedSchemas",
        `Error saving schemas: ${error.message}`
      );
      return {
        data: false,
        error: error,
      };
    }

    return {
      data: true,
      error: null,
    };
  } catch (error) {
    logger.error("setPersistedSchemas", `Unexpected error: ${error}`);
    return {
      data: false,
      error:
        error instanceof Error
          ? error
          : new Error("Failed to set persisted schemas"),
    };
  }
}

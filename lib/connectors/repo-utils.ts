const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PostgREST puts the failing row (ciphertext included) in an error's `details`, so connector
 * repositories never log or rethrow database errors wholesale. Only this short code survives.
 */
export function safeDbCode(error: unknown): string | null {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : null;

  return typeof code === "string" && /^[A-Za-z0-9_]{1,16}$/.test(code) ? code : null;
}

/** Owner ids are Organic profile UUIDs; anything else is rejected before a query is built. */
export function isProfileUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

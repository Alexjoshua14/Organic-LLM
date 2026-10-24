/**
 * Cloudflare Access service-token headers for server-to-server calls to origins that sit behind
 * an Access application (Memory/Qdrant, Ollama). Each service has its own token so one can be
 * rotated or revoked without touching the other. Not `server-only`: Bun CLI scripts share the
 * Qdrant client factory that uses this.
 */
export type CloudflareAccessService = "memory" | "ollama";

const ENV_PREFIX: Record<CloudflareAccessService, string> = {
  memory: "MEMORY",
  ollama: "OLLAMA",
};

const CLIENT_ID_HEADER = "CF-Access-Client-Id";
const CLIENT_SECRET_HEADER = "CF-Access-Client-Secret";

function readCredentials(service: CloudflareAccessService) {
  const prefix = ENV_PREFIX[service];

  return {
    clientId: process.env[`${prefix}_CF_ACCESS_CLIENT_ID`]?.trim(),
    clientSecret: process.env[`${prefix}_CF_ACCESS_CLIENT_SECRET`]?.trim(),
  };
}

/** True only when both halves of the service token are set; a lone half is never sent. */
export function isCloudflareAccessConfigured(service: CloudflareAccessService): boolean {
  const { clientId, clientSecret } = readCredentials(service);

  return Boolean(clientId && clientSecret);
}

/** Empty when the service token is not configured, so local and non-Access setups are unchanged. */
export function cloudflareAccessHeaders(service: CloudflareAccessService): Record<string, string> {
  const { clientId, clientSecret } = readCredentials(service);

  if (!clientId || !clientSecret) return {};

  return {
    [CLIENT_ID_HEADER]: clientId,
    [CLIENT_SECRET_HEADER]: clientSecret,
  };
}

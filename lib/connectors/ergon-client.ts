import "server-only";

import {
  DEFAULT_ERGON_BASE_URL,
  parseErgonWorkspaceUrl,
} from "@/lib/schemas/ergon-connection";
import type { ErgonConfig } from "@/lib/llm/ergon-config";

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export type ProbeErgonConnectionResult =
  | { ok: true; baseUrl: string }
  | { ok: false; error: string; status?: number };

/**
 * Verify a token against Ergon REST (`list_projects`) before storing it.
 */
export async function probeErgonConnection(args: {
  token: string;
  baseUrl?: string | null;
  fetchImpl?: Fetch;
}): Promise<ProbeErgonConnectionResult> {
  const baseUrl =
    parseErgonWorkspaceUrl(args.baseUrl) ??
    parseErgonWorkspaceUrl(DEFAULT_ERGON_BASE_URL) ??
    null;

  if (!baseUrl) {
    return { ok: false, error: "Invalid Ergon base URL. Use an HTTPS origin.", status: 400 };
  }

  const token = args.token.trim();

  if (token.length < 8) {
    return { ok: false, error: "Ergon API token is missing or too short.", status: 400 };
  }

  const doFetch = args.fetchImpl ?? fetch;

  try {
    const projectsRes = await doFetch(`${baseUrl}/api/rpc/list_projects`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (projectsRes.status === 401 || projectsRes.status === 403) {
      return {
        ok: false,
        error: "Ergon rejected this token. Create an API token in Ergon and try again.",
        status: projectsRes.status,
      };
    }

    if (!projectsRes.ok) {
      return {
        ok: false,
        error: `Ergon returned HTTP ${projectsRes.status} while testing the connection.`,
        status: projectsRes.status,
      };
    }

    return { ok: true, baseUrl };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Failed to reach Ergon: ${error.message}`
          : "Failed to reach Ergon.",
      status: 502,
    };
  }
}

/** POST `{url}/api/rpc/<name>` with the resolved bearer token. */
export async function callErgonRpc(args: {
  config: Pick<ErgonConfig, "url" | "token">;
  name: string;
  input: unknown;
  fetchImpl?: Fetch;
  timeoutMs?: number;
}): Promise<{ ok: true; body: unknown } | { ok: false; error: string; status?: number }> {
  try {
    const response = await (args.fetchImpl ?? fetch)(
      `${args.config.url}/api/rpc/${args.name}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${args.config.token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(args.input),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(args.timeoutMs ?? 10_000),
      }
    );

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
          ? `: ${(body as { message: string }).message.slice(0, 300)}`
          : "";

      return {
        ok: false,
        error:
          detail.length > 0
            ? `Ergon returned HTTP ${response.status}${detail}`
            : `Ergon returned HTTP ${response.status}. Check the ticket before retrying a write.`,
        status: response.status,
      };
    }

    return { ok: true, body };
  } catch {
    return {
      ok: false,
      error:
        "Ergon did not confirm the request. Check the ticket list before retrying a create or comment.",
    };
  }
}

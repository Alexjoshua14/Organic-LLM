import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { SWRConfig } from "swr";
import * as clerk from "@clerk/nextjs";
import * as gateway from "@/data/supabase/gateway-visibility";

import { BlogLink } from "@/components/pages/blog-link";
import { SandboxGatewayButton } from "@/components/pages/sandbox-gateway-button";
import { StatusGatewayButton } from "@/components/pages/status-gateway-button";
import {
  GatewayVisibilityProvider,
  useGatewayVisibility,
  type InitialGatewayVisibility,
} from "@/hooks/use-gateway-visibility";
import { resolveInitialGatewayVisibility } from "@/lib/admin/initial-gateway-visibility";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { deferred } from "../helpers/mock-realtime-voice";
import { mockModulePreservingReal } from "../helpers/module-mock";

let identity: { isLoaded: boolean; userId: string | null; sessionId: string | null };
let restore: Array<() => void>;
let cache: Map<string, unknown>;
let state: ReturnType<typeof useGatewayVisibility>;
let admin: ReturnType<typeof useIsAdmin>;
const readVisibility = mock(async (_identity?: gateway.GatewayVisibilityIdentity) => true);

function Probe() {
  state = useGatewayVisibility();
  admin = useIsAdmin();

  return null;
}

function App({
  gateways = false,
  initial = null,
}: {
  gateways?: boolean;
  initial?: InitialGatewayVisibility | null;
}) {
  return (
    <StrictMode>
      <GatewayVisibilityProvider initial={initial}>
        <SWRConfig value={{ provider: () => cache, onErrorRetry: () => {} }}>
          <Probe />
          {gateways ? (
            <>
              <SandboxGatewayButton />
              <BlogLink />
              <StatusGatewayButton />
            </>
          ) : null}
        </SWRConfig>
      </GatewayVisibilityProvider>
    </StrictMode>
  );
}

beforeEach(() => {
  cache = new Map();
  identity = { isLoaded: true, userId: "user_a", sessionId: "session_a" };
  readVisibility.mockClear();
  readVisibility.mockResolvedValue(true);
  restore = [
    mockModulePreservingReal("@clerk/nextjs", clerk, {
      useAuth: (() => identity) as never,
    }),
    mockModulePreservingReal("@/data/supabase/gateway-visibility", gateway, {
      getGatewayVisibilityForCurrentUser: readVisibility,
    }),
  ];
});

afterEach(() => {
  cleanup();
  for (const reset of restore.reverse()) reset();
});

describe("shared gateway visibility", () => {
  test("admin gateways share one pending request under StrictMode while Blog is immediately public", async () => {
    const pending = deferred<boolean>();
    readVisibility.mockImplementation(() => pending.promise);
    const view = render(<App gateways />);

    await waitFor(() => expect(readVisibility).toHaveBeenCalledTimes(1));
    expect(view.getAllByRole("link")).toHaveLength(1);
    expect(view.getByRole("link", { name: "Blog" }).getAttribute("href")).toBe("/blog");
    expect(state.visible).toBeNull();

    await act(async () => pending.resolve(true));
    await waitFor(() => expect(view.getAllByRole("link")).toHaveLength(3));
    expect(admin).toBe(true);
    expect(readVisibility).toHaveBeenCalledTimes(1);
    expect(readVisibility).toHaveBeenCalledWith({ userId: "user_a", sessionId: "session_a" });

    view.unmount();
    render(<App gateways />);
    await act(async () => {});
    expect(readVisibility).toHaveBeenCalledTimes(1);
    expect(state.visible).toBe(true);
  });

  test("auth loading and sign-out never send visibility requests", async () => {
    identity = { isLoaded: false, userId: "user_a", sessionId: "session_a" };
    const view = render(<App gateways />);
    expect(state.visible).toBe(false);
    expect(view.getAllByRole("link")).toHaveLength(1);
    expect(view.getByRole("link", { name: "Blog" }).getAttribute("href")).toBe("/blog");

    identity = { isLoaded: true, userId: null, sessionId: null };
    view.rerender(<App gateways />);
    await act(async () => {});
    expect(state.visible).toBe(false);
    expect(admin).toBe(false);
    expect(readVisibility).not.toHaveBeenCalled();
    expect(view.getAllByRole("link")).toHaveLength(1);
    expect(view.getByRole("link", { name: "Blog" }).getAttribute("href")).toBe("/blog");
  });

  test("an account switch hides the previous grant before resolving the new account", async () => {
    const view = render(<App gateways />);
    await waitFor(() => expect(state.visible).toBe(true));

    const pending = deferred<boolean>();
    readVisibility.mockImplementation(() => pending.promise);
    identity = { isLoaded: true, userId: "user_b", sessionId: "session_b" };
    view.rerender(<App gateways />);
    expect(state.visible).toBeNull();
    expect(admin).toBeNull();
    expect(view.getAllByRole("link")).toHaveLength(1);

    await act(async () => pending.resolve(false));
    await waitFor(() => expect(state.visible).toBe(false));
    expect(readVisibility).toHaveBeenCalledTimes(2);
    expect(view.getAllByRole("link")).toHaveLength(1);
    expect(view.getByRole("link", { name: "Blog" }).getAttribute("href")).toBe("/blog");
  });

  test("a late result from an old session cannot grant the current session", async () => {
    const old = deferred<boolean>();
    readVisibility.mockImplementationOnce(() => old.promise);
    const view = render(<App />);
    await waitFor(() => expect(readVisibility).toHaveBeenCalledTimes(1));

    readVisibility.mockResolvedValue(false);
    identity = { isLoaded: true, userId: "user_b", sessionId: "session_b" };
    view.rerender(<App />);
    await waitFor(() => expect(state.visible).toBe(false));
    await act(async () => old.resolve(true));
    expect(state.visible).toBe(false);
    expect(admin).toBe(false);
  });

  test("a new session for the same user makes a fresh request; sign-out hides cached access", async () => {
    const view = render(<App />);
    await waitFor(() => expect(state.visible).toBe(true));
    identity = { ...identity, sessionId: "session_new" };
    view.rerender(<App />);
    await waitFor(() => expect(readVisibility).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(state.visible).toBe(true));
    expect(readVisibility).toHaveBeenLastCalledWith({ userId: "user_a", sessionId: "session_new" });

    identity = { isLoaded: true, userId: null, sessionId: null };
    view.rerender(<App />);
    expect(state.visible).toBe(false);
    expect(admin).toBe(false);
  });

  test("a failed revalidation hides stale access and a later refresh can recover", async () => {
    const view = render(<App gateways />);
    await waitFor(() => expect(state.visible).toBe(true));
    readVisibility.mockRejectedValue(new Error("Unavailable"));

    await act(async () => {
      await state.refresh().catch(() => {});
    });
    expect(state.visible).toBe(false);
    expect(admin).toBe(false);
    expect(view.getAllByRole("link")).toHaveLength(1);
    expect(state.error?.message).toBe("Unavailable");

    readVisibility.mockResolvedValue(true);
    await act(async () => {
      await state.refresh();
    });
    expect(state.visible).toBe(true);
    expect(state.error).toBeUndefined();
  });

  test("refreshing a revoked grant updates every consumer", async () => {
    const view = render(<App gateways />);
    await waitFor(() => expect(state.visible).toBe(true));
    readVisibility.mockResolvedValue(false);
    await act(async () => {
      await state.refresh();
    });

    expect(state.visible).toBe(false);
    expect(admin).toBe(false);
    expect(view.getAllByRole("link")).toHaveLength(1);
  });
});

describe("server-rendered seed", () => {
  test("a matching seed shows admin UI on the first render, before the client check returns", () => {
    readVisibility.mockImplementation(() => deferred<boolean>().promise);
    const view = render(<App gateways initial={{ userId: "user_a", visible: true }} />);

    expect(state.visible).toBe(true);
    expect(admin).toBe(true);
    expect(view.getAllByRole("link")).toHaveLength(3);
  });

  test("the client check still runs and corrects a stale seed", async () => {
    readVisibility.mockResolvedValue(false);
    const view = render(<App gateways initial={{ userId: "user_a", visible: true }} />);

    await waitFor(() => expect(state.visible).toBe(false));
    expect(readVisibility).toHaveBeenCalledWith({ userId: "user_a", sessionId: "session_a" });
    expect(view.getAllByRole("link")).toHaveLength(1);
  });

  test("a seed read for another user is ignored", () => {
    readVisibility.mockImplementation(() => deferred<boolean>().promise);
    render(<App gateways initial={{ userId: "user_other", visible: true }} />);

    expect(state.visible).toBeNull();
    expect(admin).toBeNull();
  });

  test("a seed never applies while signed out", () => {
    identity = { isLoaded: true, userId: null, sessionId: null };
    render(<App gateways initial={{ userId: "user_a", visible: true }} />);

    expect(state.visible).toBe(false);
    expect(readVisibility).not.toHaveBeenCalled();
  });
});

describe("resolveInitialGatewayVisibility", () => {
  test("seeds nothing when signed out, without reading", async () => {
    const read = mock(async () => ({ id: "p", admin: true }));

    expect(await resolveInitialGatewayVisibility(null, read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  test("seeds the admin read for the signed-in user", async () => {
    expect(
      await resolveInitialGatewayVisibility("user_a", async () => ({ id: "p", admin: true }))
    ).toEqual({ userId: "user_a", visible: true });
    expect(await resolveInitialGatewayVisibility("user_a", async () => null)).toEqual({
      userId: "user_a",
      visible: false,
    });
  });

  test("seeds nothing when the read fails, leaving the answer to the client check", async () => {
    const failing = async () => {
      throw new Error("Unavailable");
    };

    expect(await resolveInitialGatewayVisibility("user_a", failing)).toBeNull();
  });
});

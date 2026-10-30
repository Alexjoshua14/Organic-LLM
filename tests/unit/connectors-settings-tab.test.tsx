import { afterEach, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";

import { ConnectorsSettingsTab } from "@/components/settings/connectors/ConnectorsSettingsTab";
import {
  normalizeUserConnectorsProfile,
  type GithubConnectorSnapshot,
  type UserConnectorsProfile,
} from "@/lib/schemas/user-connectors";
import { USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";
import { render } from "../helpers/render";

afterEach(() => {
  cleanup();
  localStorage.removeItem(USER_SETTINGS_STORAGE_KEY);
});

const snapshot: GithubConnectorSnapshot = {
  username: "Alexjoshua14",
  profileUrl: "https://github.com/Alexjoshua14",
  fetchedAt: "2026-10-21T12:00:00.000Z",
  profile: {
    login: "Alexjoshua14",
    name: "Alex",
    bio: "Design lab",
    html_url: "https://github.com/Alexjoshua14",
    public_repos: 1,
    followers: 0,
    company: null,
    location: null,
    blog: null,
  },
  repos: [
    {
      name: "organic-llm",
      description: "A design lab",
      language: "TypeScript",
      html_url: "https://github.com/Alexjoshua14/organic-llm",
      updated_at: "2026-10-01T00:00:00Z",
      stargazers_count: 1,
      fork: false,
      topics: ["llm"],
    },
  ],
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("shows specialist routing and saves the dossier", async () => {
  const calls: Array<{ url: string; method?: string; body?: string }> = [];
  const onSave = mock((_profile: UserConnectorsProfile) => {});
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    const sent = init?.body ? (JSON.parse(String(init.body)) as UserConnectorsProfile) : null;

    return jsonResponse(
      sent ? normalizeUserConnectorsProfile(sent) : normalizeUserConnectorsProfile({})
    );
  }) as typeof fetch;

  const view = render(
    <ConnectorsSettingsTab
      fetchImpl={fetchImpl}
      initialProfile={{
        educationAndTranscripts: "Williams College CS",
        careerHistory: "Built Organic",
        autoShareWithSubagents: true,
      }}
      onSave={onSave}
    />
  );

  expect(view.getByRole("heading", { name: "Connectors & Personal Dossier" })).toBeTruthy();
  expect(view.getAllByText("Reed").length).toBeGreaterThan(0);
  expect(view.getAllByText("Lyra").length).toBeGreaterThan(0);
  expect(view.getAllByText("Archer").length).toBeGreaterThan(0);
  expect(view.getAllByText(/connector:github/).length).toBeGreaterThan(0);
  expect(view.getAllByText(/connector:education/).length).toBeGreaterThan(0);
  expect(view.getByLabelText(/Education & Transcripts/)).toHaveProperty(
    "value",
    "Williams College CS"
  );

  const career = view.getByLabelText(/Career History/);

  await act(async () => {
    fireEvent.change(career, { target: { value: "Built Organic and a home server" } });
  });
  expect(view.getByText(/unsaved connector or dossier edits/)).toBeTruthy();

  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Save Connectors & Dossier" }));
  });

  const put = calls.find((call) => call.method === "PUT");

  expect(put?.url).toBe("/api/profile/connectors");
  expect(put?.body).toContain("Built Organic and a home server");
  expect(put?.body).toContain("Williams College CS");
  expect(view.getByRole("status").textContent).toContain("Saved");
  expect(onSave).toHaveBeenCalled();
});

test("syncs a GitHub profile and refuses an invalid handle", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.includes("/github")) return jsonResponse(snapshot);

    const sent = init?.body ? (JSON.parse(String(init.body)) as UserConnectorsProfile) : {};

    return jsonResponse(normalizeUserConnectorsProfile(sent));
  }) as typeof fetch;

  const view = render(
    <ConnectorsSettingsTab
      fetchImpl={fetchImpl}
      initialProfile={{ githubUrl: "", autoShareWithSubagents: true }}
    />
  );

  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Test / Sync GitHub Repos" }));
  });
  expect(view.getByText(/Enter a valid GitHub username/)).toBeTruthy();

  await act(async () => {
    fireEvent.change(view.getByRole("textbox", { name: "GitHub Profile URL or Username" }), {
      target: { value: "https://github.com/Alexjoshua14" },
    });
  });
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Test / Sync GitHub Repos" }));
  });

  expect(
    calls.some((call) => call.includes("/api/profile/connectors/github?username=Alexjoshua14"))
  ).toBe(true);
  expect(calls.some((call) => call.startsWith("PUT /api/profile/connectors"))).toBe(true);
  expect(view.getByText(/organic-llm/)).toBeTruthy();
  expect(view.getByRole("status").textContent).toContain("Synced 1 public");
});

test("turning off automatic sharing persists the switch", async () => {
  const bodies: string[] = [];
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof init?.body === "string") bodies.push(init.body);

    return jsonResponse(
      normalizeUserConnectorsProfile(
        init?.body ? (JSON.parse(String(init.body)) as UserConnectorsProfile) : {}
      )
    );
  }) as typeof fetch;

  const view = render(
    <ConnectorsSettingsTab
      fetchImpl={fetchImpl}
      initialProfile={{ careerHistory: "Research engineer", autoShareWithSubagents: true }}
    />
  );
  const toggle = view.getByRole("switch", {
    name: "Automatically share connectors with subagents",
  });

  await act(async () => {
    fireEvent.click(toggle);
  });

  expect(bodies.at(-1)).toContain('"autoShareWithSubagents":false');
  expect(view.getByText(/will not receive automatic connector slices/)).toBeTruthy();
});

test.each([
  [503, "status", "Ergon connections aren’t available yet."],
  [500, "alert", "Couldn’t connect to Ergon. Please try again."],
] as const)("Ergon %s responses use production-safe feedback", async (status, role, message) => {
  const view = render(
    <ConnectorsSettingsTab
      initialProfile={{}}
      fetchImpl={
        (async () =>
          new Response(
            JSON.stringify({
              error: "Internal setup detail: ERGON_OAUTH_CLIENT_ID and WorkOS registration",
              ...(status === 503 ? { oauthReady: false } : {}),
            }),
            { status }
          )) as typeof fetch
      }
    />
  );

  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Connect Ergon with OAuth" }));
  });
  expect(view.getByRole(role).textContent).toContain(message);
  expect(view.queryByText("Setup details")).toBeNull();
  expect(view.container.textContent).not.toContain("ERGON_OAUTH_CLIENT_ID");
  expect(view.container.textContent).not.toContain("WorkOS");
  expect(view.getByRole("button", { name: "Connect Ergon with OAuth" })).toHaveProperty(
    "disabled",
    false
  );
});

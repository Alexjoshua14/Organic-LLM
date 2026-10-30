import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";

import { DossierAiAction } from "@/components/settings/connectors/DossierAiAction";
import { ConnectorsSettingsTab } from "@/components/settings/connectors/ConnectorsSettingsTab";
import {
  DOSSIER_PROMPTS,
  getDossierPrompt,
  type DossierField,
} from "@/lib/connectors/dossier-prompts";
import { exportLastProviderStorageKey } from "@/lib/export/last-provider-storage";
import { USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";
import { render } from "../helpers/render";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
let restoreOpen: (() => void) | undefined;

afterEach(() => {
  cleanup();
  restoreOpen?.();
  restoreOpen = undefined;
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
  localStorage.removeItem(USER_SETTINGS_STORAGE_KEY);
  for (const field of Object.keys(DOSSIER_PROMPTS)) {
    localStorage.removeItem(exportLastProviderStorageKey(`dossier-${field}`));
  }
});

async function openMenu(button: HTMLElement) {
  await act(async () => fireEvent.keyDown(button, { key: "Enter" }));
}

test("each dossier action exports the matching request without sending or replacing existing profile text", async () => {
  const fetchImpl = mock(async () => new Response(JSON.stringify({ data: {} })));
  const view = render(
    <ConnectorsSettingsTab
      fetchImpl={fetchImpl as typeof fetch}
      initialProfile={{
        educationAndTranscripts: "PRIVATE EDUCATION",
        careerHistory: "PRIVATE CAREER",
        resumeText: "PRIVATE RESUME",
        workingPreferences: "PRIVATE PREFERENCES",
      }}
    />
  );

  for (const field of Object.keys(DOSSIER_PROMPTS) as DossierField[]) {
    await openMenu(
      view.getByRole("button", { name: `Ask AI for ${DOSSIER_PROMPTS[field].label}` })
    );
    for (const [name, param] of [
      ["Open in ChatGPT", "prompt"],
      ["Open in Claude", "q"],
    ] as const) {
      const link = view.getByRole("menuitem", { name: new RegExp(name) }) as HTMLAnchorElement;
      const prompt = new URL(link.href).searchParams.get(param);

      expect(prompt).toBe(getDossierPrompt(field));
      expect(prompt).not.toContain("PRIVATE");
      expect(prompt).toContain("Do not claim access to other chats");
      expect(prompt).toContain("No preamble, code fences, JSON");
    }
    await act(async () => fireEvent.keyDown(view.getByRole("menu"), { key: "Escape" }));
  }
  expect(view.getByLabelText(/Education & Transcripts/)).toHaveProperty(
    "value",
    "PRIVATE EDUCATION"
  );
  expect(view.getByLabelText(/Career History/)).toHaveProperty("value", "PRIVATE CAREER");
  expect(view.getByLabelText(/Resume \/ CV/)).toHaveProperty("value", "PRIVATE RESUME");
  expect(view.getByLabelText(/Working Preferences/)).toHaveProperty("value", "PRIVATE PREFERENCES");
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("Gemini copies the complete prompt before navigating and removes the new window's opener", async () => {
  const popup = { opener: window, location: { href: "about:blank" }, close: mock(() => {}) };
  const open = spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  restoreOpen = () => open.mockRestore();
  const copy = mock(async (_text: string) => {
    expect(popup.location.href).toBe("about:blank");
  });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  const view = render(<DossierAiAction field="workingPreferences" />);
  await openMenu(view.getByRole("button", { name: /Ask AI/ }));
  await act(async () =>
    fireEvent.click(view.getByRole("menuitem", { name: /Copy prompt & open Gemini/ }))
  );

  expect(copy).toHaveBeenCalledWith(getDossierPrompt("workingPreferences"));
  expect(popup.opener).toBeNull();
  expect(popup.location.href).toBe("https://gemini.google.com/app");
  expect(view.getByRole("status").textContent).toContain("Paste it into Gemini");
});

test("a clipboard failure closes the blank tab and keeps the dossier action available", async () => {
  const popup = { opener: null, close: mock(() => {}) };
  const open = spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  restoreOpen = () => open.mockRestore();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: mock(async () => {
        throw new Error("denied");
      }),
    },
  });
  const view = render(<DossierAiAction field="resumeText" />);
  await openMenu(view.getByRole("button", { name: /Ask AI/ }));
  await act(async () =>
    fireEvent.click(view.getByRole("menuitem", { name: /Copy prompt & open Gemini/ }))
  );

  expect(popup.close).toHaveBeenCalled();
  expect(view.getByRole("status").textContent).toContain("Allow clipboard access");
  expect(view.getByRole("button", { name: /Ask AI/ })).toBeTruthy();
});

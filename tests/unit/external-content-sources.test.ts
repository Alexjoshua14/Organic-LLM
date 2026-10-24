import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.EXA_API_KEY = process.env.EXA_API_KEY ?? "test-exa-key";

mock.module("server-only", () => ({}));

mock.module("@/lib/exa/client", () => ({
  searchWeb: async () => ({ sources: [], error: null }),
  getContents: async () => ({ contents: [], error: null }),
}));

const mockFetchExternalContentText = mock(async () => "Sanitized page text");

mock.module("@/lib/security/external-content/fetch-external-content", () => ({
  fetchExternalContentText: mockFetchExternalContentText,
  fetchExternalContent: mock(async () => ({
    ok: true,
    text: "Sanitized page text",
    finalUrl: "https://example.com",
    source: "origin",
    truncated: false,
  })),
}));

import { getWebpageContent } from "@/lib/exa/sources";

describe("getWebpageContent DMZ delegation", () => {
  beforeEach(() => {
    mockFetchExternalContentText.mockClear();
    mockFetchExternalContentText.mockResolvedValue("Sanitized page text");
  });

  test("delegates to fetchExternalContentText with auto mode", async () => {
    const text = await getWebpageContent("https://example.com/article");

    expect(text).toBe("Sanitized page text");
    expect(mockFetchExternalContentText.mock.calls.length).toBe(1);
    expect((mockFetchExternalContentText.mock.calls[0] as [string, object])[0]).toBe(
      "https://example.com/article"
    );
    expect((mockFetchExternalContentText.mock.calls[0] as [string, object])[1]).toEqual({
      mode: "auto",
      maxChars: 5000,
      initiatedBy: "server",
    });
  });
});

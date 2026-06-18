import { describe, expect, test } from "bun:test";

import { diagnoseMemoryStoreFailure } from "@/lib/memory/memory-store-failure";

describe("diagnoseMemoryStoreFailure", () => {
  test("classifies Mem0 Ollama embedder connectivity failures", () => {
    const diagnosis = diagnoseMemoryStoreFailure(
      new Error(
        "Mem0 Ollama embedder (https://ollama.example.com, model=nomic-embed-text): Ollama /api/embed request failed — embedder unreachable",
        { cause: new TypeError("fetch failed") },
      ),
    );

    expect(diagnosis.kind).toBe("embedder");
    expect(diagnosis.hint).toContain("OLLAMA_URL");
    expect(diagnosis.hint).toContain("OLLAMA_EMBED_MODEL");
  });

  test("classifies mem0 ensureModelExists fetch failures", () => {
    const diagnosis = diagnoseMemoryStoreFailure(
      new Error("Error ensuring model exists: TypeError: fetch failed"),
    );

    expect(diagnosis.kind).toBe("embedder");
  });

  test("classifies better-sqlite3 binding failures", () => {
    const diagnosis = diagnoseMemoryStoreFailure(
      new Error("Could not locate the bindings file. Tried: node-v137-darwin-arm64"),
    );

    expect(diagnosis.kind).toBe("sqlite");
    expect(diagnosis.hint).toContain("better-sqlite3");
  });

  test("classifies Qdrant auth failures", () => {
    const diagnosis = diagnoseMemoryStoreFailure(new Error("Qdrant unauthorized 401"));

    expect(diagnosis.kind).toBe("qdrant");
    expect(diagnosis.hint).toContain("MEMORY_API");
  });

  test("classifies OpenAI fact-extraction failures", () => {
    const diagnosis = diagnoseMemoryStoreFailure(
      new Error("401 Incorrect API key provided: sk-***"),
    );

    expect(diagnosis.kind).toBe("mem0_llm");
    expect(diagnosis.hint).toContain("OPENAI_API_KEY");
  });
});

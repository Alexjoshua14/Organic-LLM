#!/usr/bin/env node
/**
 * Embedding latency benchmark against Ollama.
 *
 * Usage:
 *   OLLAMA_URL=http://aetherion.local:11434 node bench-embeddings.mjs
 *
 * Optional env:
 *   MODELS - comma-separated list (default: all-minilm,nomic-embed-text,qwen3-embedding:0.6b)
 *   ITERATIONS - measured runs per (model, text size) (default: 20)
 *   WARMUP - unmeasured warmup runs to load model into RAM (default: 3)
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODELS = (process.env.MODELS ?? "all-minilm,nomic-embed-text,qwen3-embedding:0.6b").split(
  ","
);
const ITERATIONS = parseInt(process.env.ITERATIONS ?? "20");
const WARMUP = parseInt(process.env.WARMUP ?? "3");

// Three text lengths to expose context-window differences
const TEST_TEXTS = {
  short: "Quick thought about React hooks and effects timing.",

  medium:
    "I've been thinking about how to architect a memory system for a " +
    "personal AI tool. The core tension is between privacy and retrieval " +
    "quality. Embeddings need to stay searchable, but the underlying text " +
    "should be encrypted at rest. The key has to live somewhere that " +
    "doesn't co-locate with the application secrets, otherwise the " +
    "encryption layer is theatrical rather than meaningfully protective.",

  long:
    "Today I worked through the architecture of the encrypted memory " +
    "layer for Organic LLM. The starting point was identifying the real " +
    "threat model: not nation-state attackers, but the realistic case of " +
    "Vercel env vars leaking, an SD card being lifted from the Pi, or a " +
    "compromised home network device pivoting laterally. Against those " +
    "threats, plaintext storage in Qdrant is meaningfully insufficient. " +
    "The plan that emerged: AES-256-GCM with version-prefixed ciphertexts " +
    "(v1:iv:tag:ct) so future key rotation or algorithm changes can be " +
    "handled gracefully. Embeddings stay unencrypted because they have " +
    "to be searchable, with a known caveat that embedding inversion " +
    "research has shown partial reconstruction is possible. The honest " +
    "framing is 'encrypted at rest, embeddings remain searchable' rather " +
    "than 'fully private.' For now the key lives in Vercel env vars; " +
    "passphrase-derived keys are a v2 concern. The migration script " +
    "needs to do three things: re-embed under the new model, encrypt the " +
    "memory text, and write to a new collection so rollback is possible " +
    "until we drop the old one. Sequencing matters: collection swap " +
    "first, then encryption layer, then run migration, verify, drop old. " +
    "What I want to avoid is doing all the work and then discovering " +
    "retrieval quality regressed because of the embedder change rather " +
    "than anything in the encryption path. That requires an evaluation " +
    "harness — a small set of 'I know this query should retrieve that " +
    "memory' golden cases, scored before and after.",
};

async function embed(model, text) {
  const start = performance.now();
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: text,
      keep_alive: "30m",
    }),
  });
  const elapsed = performance.now() - start;
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { elapsed, dimensions: data.embedding?.length ?? 0 };
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
  };
}

async function benchModel(model) {
  console.log(`\n=== ${model} ===`);
  const out = { model, dimensions: 0, results: {} };

  for (const [size, text] of Object.entries(TEST_TEXTS)) {
    // Warmup runs (excluded from stats — eliminates cold-start bias)
    for (let i = 0; i < WARMUP; i++) {
      await embed(model, text);
    }

    const samples = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const { elapsed, dimensions } = await embed(model, text);
      samples.push(elapsed);
      out.dimensions = dimensions;
    }

    out.results[size] = stats(samples);
  }

  console.log(`Dimensions: ${out.dimensions}`);
  console.log(
    `Text sizes:  short=${TEST_TEXTS.short.length}c  ` +
      `medium=${TEST_TEXTS.medium.length}c  ` +
      `long=${TEST_TEXTS.long.length}c`
  );
  console.log(`\nLatency (ms):`);
  console.log(`  size       mean    p50    p95    min    max`);
  for (const [size, s] of Object.entries(out.results)) {
    console.log(
      `  ${size.padEnd(8)} ` +
        `${s.mean.toFixed(0).padStart(5)}  ` +
        `${s.p50.toFixed(0).padStart(5)}  ` +
        `${s.p95.toFixed(0).padStart(5)}  ` +
        `${s.min.toFixed(0).padStart(5)}  ` +
        `${s.max.toFixed(0).padStart(5)}`
    );
  }

  return out;
}

async function main() {
  console.log(`Benchmarking against: ${OLLAMA_URL}`);
  console.log(`Iterations: ${ITERATIONS} (+ ${WARMUP} warmup) per text size`);

  const all = [];
  for (const model of MODELS) {
    try {
      all.push(await benchModel(model.trim()));
    } catch (err) {
      console.error(`\nFailed to benchmark ${model}: ${err.message}`);
    }
  }

  console.log(`\n\n=== Summary (mean latency, ms) ===`);
  console.log(`  ${"model".padEnd(28)}  dims   short  medium    long`);
  for (const r of all) {
    console.log(
      `  ${r.model.padEnd(28)}  ${String(r.dimensions).padStart(4)}  ` +
        `${r.results.short.mean.toFixed(0).padStart(5)}  ` +
        `${r.results.medium.mean.toFixed(0).padStart(6)}  ` +
        `${r.results.long.mean.toFixed(0).padStart(6)}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

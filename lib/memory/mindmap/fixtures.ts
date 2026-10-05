import type { MemoryTrace } from "./types";

/**
 * Fixture corpus for the sandbox lab. Topics only on a few rows so clustering
 * has to earn the rest of the map from the actual wording.
 */
export const FIXTURE_MEMORY_TRACES: MemoryTrace[] = [
  { id: "m1", text: "Lives in Portland, Oregon.", topic: "Places" },
  { id: "m2", text: "Favorite walking route is the Eastbank Esplanade in Portland." },
  { id: "m3", text: "Building Organic LLM as a private cognition lab." },
  { id: "m4", text: "Organic LLM runs on a Raspberry Pi named Aetherion." },
  { id: "m5", text: "Aetherion is the home server for Qdrant and chat." },
  { id: "m6", text: "Prefers bun over npm for JavaScript tooling." },
  { id: "m7", text: "Writes TypeScript and React for the product UI." },
  { id: "m8", text: "Drinks pour-over coffee every morning." },
  { id: "m9", text: "Takes coffee black, no sugar." },
  { id: "m10", text: "Works late and prefers dark, dim rooms." },
  { id: "m11", text: "Uses dark mode across every editor and app." },
  { id: "m12", text: "Collaborates with Alex on Organic LLM direction." },
  { id: "m13", text: "Alex prefers visual prototypes before production wiring." },
  { id: "m14", text: "Keeps a memory ingest chamber called Delphi." },
  { id: "m15", text: "Delphi is the persona for talking directly to Memory." },
];

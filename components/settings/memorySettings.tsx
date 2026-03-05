/**
 * Memory settings: persisted memory lens (what Organic LLM has stored and can retrieve).
 */

import { MemoryLens } from "@/components/memory/memory-lens";

const MemorySettings = () => {
  return (
    <section className="flex flex-col gap-8">
      <MemoryLens variant="inline" />
    </section>
  );
};

export default MemorySettings;
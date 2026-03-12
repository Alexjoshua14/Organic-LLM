/**
 * Memory settings: persisted memory lens (what Organic LLM has stored and can retrieve).
 */

import { MemoryLens } from "@/components/memory/memory-lens";

const MemorySettings = () => {
  return (
    <section className="flex flex-col gap-8 w-full" aria-label="Memory settings">
      <MemoryLens variant="inline" hideHeading className="w-full" />
    </section>
  );
};

export default MemorySettings;
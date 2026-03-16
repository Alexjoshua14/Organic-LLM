/**
 * Memory settings: persisted memory lens (what Organic LLM has stored and can retrieve).
 */

import { MemoryLens } from "@/components/memory/memory-lens";

const MemorySettings = () => {
  return (
    <section aria-label="Memory settings" className="flex flex-col gap-8 w-full">
      <MemoryLens hideHeading className="w-full" variant="inline" />
    </section>
  );
};

export default MemorySettings;

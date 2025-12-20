/**
 * Container for Memory Settings Component
 */

import { MemoryCard } from '@/components/memory/memoryCard'
import { sampleMemories } from '@/test-data/memory'
import { Suspense, useMemo } from 'react'
import { Separator } from '../third-party/ui/separator';
import { Button } from '../third-party/ui/button';
import { MemoryContainer } from '../memory/memoryContainer';


const MemorySettings = () => {

  const memories = useMemo(() => {
    return sampleMemories;
  }, []);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">
          {`Memories`}
        </h1>

        <div className="flex gap-4">
          <Button variant="outline" size="sm" >
            {`Add new memory`}
          </Button>
        </div>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <MemoryContainer />
      </Suspense>

    </section>
  )
}

export default MemorySettings;
import React from "react";
import { Separator } from "@/components/third-party/ui/separator";
import { MemoryItemType } from "@/lib/schemas/memory";

type MemoryListProps = {
  memories: MemoryItemType[];
};

type MemoryItemProps = {
  memory: MemoryItemType;
};
const MemoryItem: React.FC<MemoryItemProps> = ({ memory }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-foreground">{memory.memory}</span>
    </div>
  );
};

const MemoryList: React.FC<MemoryListProps> = ({ memories }) => {
  if (!memories || memories.length === 0) return <div>No items to display.</div>;

  return (
    <div className="flex flex-col gap-2">
      {memories.map((memory, idx) => (
        <React.Fragment key={idx}>
          <MemoryItem memory={memory} />
          {idx < memories.length - 1 && (
            <Separator orientation="horizontal" className="w-full bg-foreground/15 my-2" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MemoryList;

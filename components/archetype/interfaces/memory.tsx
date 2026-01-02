import React from "react";
import { Separator } from "@/components/third-party/ui/separator";
import { MemoryItemType } from "@/lib/schemas/memory";
import { Settings, Settings2, Trash, Trash2 } from "lucide-react";
import { Button } from "@/components/third-party/ui/button";

type MemoryListProps = {
  memories: MemoryItemType[];
};

type MemoryItemProps = {
  memory: MemoryItemType;
};
const MemoryItem: React.FC<MemoryItemProps> = ({ memory }) => {
  return (
    <div className="flex gap-2 items-center">
      <span className="flex-1 text-sm text-foreground line-clamp-2 text-ellipsis">{memory.memory}</span>
      <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-150 h-full flex items-center justify-center">
        <Button variant="glass" size="icon" className="cursor-pointer">
          <Settings size={18} color="var(--secondary-foreground)" />
        </Button>
      </div>
    </div>
  );
};

const MemoryList: React.FC<MemoryListProps> = ({ memories }) => {
  if (!memories || memories.length === 0) return <div>No items to display.</div>;

  return (
    <div className="flex flex-col">
      {memories.map((memory, idx) => (
        <div key={idx} className="group">
          <MemoryItem memory={memory} />
          {idx < memories.length - 1 && (
            <Separator orientation="horizontal" className="w-full bg-foreground/15 my-2" />
          )}
        </div>
      ))}
    </div>
  );
};

export default MemoryList;

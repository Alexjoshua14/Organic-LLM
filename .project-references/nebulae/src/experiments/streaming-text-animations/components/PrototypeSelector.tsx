"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrototypeConfig } from "./prototypes/types";

interface PrototypeSelectorProps {
  value: string;
  onChange: (id: string) => void;
  prototypes: PrototypeConfig[];
}

export function PrototypeSelector({
  value,
  onChange,
  prototypes,
}: PrototypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full sm:w-auto">
      <Select
        value={value}
        onValueChange={onChange}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger
          className={`glass-input w-full sm:w-[280px] bg-neutral-50! dark:bg-neutral-900! ${!isOpen ? 'animate-subtle-pulse-gentle' : ''}`}
        >
          <SelectValue placeholder="Select prototype..." />
        </SelectTrigger>
        <SelectContent className="bg-neutral-50! dark:bg-neutral-900!">
          {prototypes.map((prototype) => (
            <SelectItem key={prototype.id} value={prototype.id}>
              {prototype.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}


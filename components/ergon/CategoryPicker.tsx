"use client";

import type { TaskCategoryRow } from "@/lib/ergon/types";

import { useState } from "react";
import { Plus } from "lucide-react";

import { CategoryChip } from "@/components/ergon/CategoryChip";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_COLORS = ["#128C74", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9"];

type CategoryPickerProps = {
  categories: TaskCategoryRow[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  onCreateCategory: (input: { name: string; color?: string }) => Promise<TaskCategoryRow>;
  className?: string;
};

export function CategoryPicker({
  categories,
  value,
  onChange,
  onCreateCategory,
  className,
}: CategoryPickerProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [pending, setPending] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim();

    if (!name) return;

    setPending(true);

    try {
      const row = await onCreateCategory({ name, color: newColor });

      onChange(row.id);
      setCreating(false);
      setNewName("");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Select
        value={value ?? "none"}
        onValueChange={(next) => onChange(next === "none" ? null : next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No category</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: category.color ?? "var(--border)" }}
                />
                {category.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!creating ? (
        <Button
          className="h-8 gap-1.5 px-2 text-xs"
          type="button"
          variant="ghost"
          onClick={() => setCreating(true)}
        >
          <Plus className="size-3.5" />
          New category
        </Button>
      ) : (
        <div className="space-y-2 rounded-lg border border-border/50 p-3">
          <Input
            placeholder="Category name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                aria-label={`Color ${color}`}
                className={cn(
                  "size-6 rounded-full border-2 transition-transform",
                  newColor === color ? "scale-110 border-foreground" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
                type="button"
                onClick={() => setNewColor(color)}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              disabled={pending || !newName.trim()}
              size="sm"
              type="button"
              onClick={() => void handleCreate()}
            >
              Add
            </Button>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoryFilterChips({
  categories,
  selectedIds,
  onToggle,
}: {
  categories: TaskCategoryRow[];
  selectedIds: string[];
  onToggle: (categoryId: string) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => (
        <CategoryChip
          key={category.id}
          color={category.color}
          label={category.name}
          selected={selectedIds.includes(category.id)}
          onClick={() => onToggle(category.id)}
        />
      ))}
    </div>
  );
}

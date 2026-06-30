"use client";

import type { TaskCategoryRow } from "@/lib/ergon/types";
import type { CategoryPatch } from "@/lib/schemas/task-categories";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";

import { CategoryChip } from "@/components/ergon/CategoryChip";
import { Input } from "@/components/third-party/ui/input";

const DEFAULT_COLORS = ["#128C74", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9"];

type CategoryManagerProps = {
  categories: TaskCategoryRow[];
  onUpdate: (id: string, patch: CategoryPatch) => Promise<TaskCategoryRow>;
  onDelete: (id: string) => Promise<void>;
};

/** Category edit modal — opened from the filter/settings sheet. */
export function CategoryManager({ categories, onUpdate, onDelete }: CategoryManagerProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!editingId) return;

    const category = categories.find((item) => item.id === editingId);

    if (!category) return;

    setName(category.name);
    setColor(category.color ?? DEFAULT_COLORS[0]);
  }, [categories, editingId]);

  const startEdit = (category: TaskCategoryRow) => {
    setEditingId(category.id);
    setName(category.name);
    setColor(category.color ?? DEFAULT_COLORS[0]);
    setOpen(true);
  };

  const save = async () => {
    if (!editingId) return;

    setPending(true);

    try {
      await onUpdate(editingId, { name: name.trim(), color });
      setOpen(false);
      setEditingId(null);
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!editingId) return;

    setPending(true);

    try {
      await onDelete(editingId);
      setOpen(false);
      setEditingId(null);
    } finally {
      setPending(false);
    }
  };

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No categories yet.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button key={category.id} type="button" onClick={() => startEdit(category)}>
            <CategoryChip color={category.color} label={category.name} />
          </button>
        ))}
      </div>

      <Modal isOpen={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>Edit category</ModalHeader>
          <ModalBody className="gap-3">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  aria-label={`Color ${swatch}`}
                  className="size-7 rounded-full border-2 data-[active=true]:border-foreground"
                  data-active={color === swatch}
                  style={{ backgroundColor: swatch }}
                  type="button"
                  onClick={() => setColor(swatch)}
                />
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              isDisabled={pending}
              variant="light"
              onPress={() => void remove()}
            >
              Delete
            </Button>
            <Button isDisabled={pending || !name.trim()} onPress={() => void save()}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

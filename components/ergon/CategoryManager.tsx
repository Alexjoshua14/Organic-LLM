"use client";

import type { TaskCategoryRow } from "@/lib/ergon/types";
import type { CategoryPatch } from "@/lib/schemas/task-categories";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
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

  if (categories.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Manage</span>
        {categories.map((category) => (
          <button key={category.id} type="button" onClick={() => startEdit(category)}>
            <CategoryChip color={category.color} label={category.name} />
          </button>
        ))}
        <Button
          isIconOnly
          aria-label="Manage categories"
          size="sm"
          variant="light"
          onPress={() => {
            setEditingId(categories[0]?.id ?? null);
            if (categories[0]) startEdit(categories[0]);
            else setOpen(true);
          }}
        >
          <Settings2 className="size-4" />
        </Button>
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

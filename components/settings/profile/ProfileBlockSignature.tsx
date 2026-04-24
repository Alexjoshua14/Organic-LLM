"use client";

import type { ProfileBlockProps } from "./profile-block-types";

import { useEffect, useState } from "react";

import { SignatureBlock } from "./SignatureBlock";

export function ProfileBlockSignature({
  tree,
  canEditTree,
  isSavingTree,
  onTreeFieldPatch,
}: ProfileBlockProps) {
  const signature = tree?.signature?.trim() ?? "";
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [signatureDraft, setSignatureDraft] = useState(signature);

  useEffect(() => {
    setSignatureDraft(signature);
  }, [signature]);

  const saveSignature = async () => {
    const nextSignature = signatureDraft.trim();

    if (nextSignature === signature) {
      setIsEditingSignature(false);

      return;
    }

    try {
      await onTreeFieldPatch?.({ signature: nextSignature });
      setIsEditingSignature(false);
    } catch {
      // ProfileView renders the save error and reverts optimistic state.
    }
  };

  if (!signature && !canEditTree) return null;

  if (isEditingSignature) {
    return (
      <div className="flex flex-col gap-2">
        <input
          aria-label="Profile signature"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          disabled={isSavingTree}
          maxLength={160}
          placeholder="Add a short signature line"
          value={signatureDraft}
          onChange={(event) => setSignatureDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void saveSignature();
            if (event.key === "Escape") {
              setSignatureDraft(signature);
              setIsEditingSignature(false);
            }
          }}
        />
        <div className="flex gap-2 text-[11px]">
          <button
            className="text-foreground underline decoration-foreground/30 disabled:text-muted-foreground"
            disabled={isSavingTree}
            type="button"
            onClick={() => void saveSignature()}
          >
            Save
          </button>
          <button
            className="text-muted-foreground underline decoration-muted-foreground/30"
            disabled={isSavingTree}
            type="button"
            onClick={() => {
              setSignatureDraft(signature);
              setIsEditingSignature(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/signature relative">
      {signature ? (
        <SignatureBlock signature={signature} />
      ) : (
        <button
          className="rounded-lg border border-dashed border-border px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground"
          type="button"
          onClick={() => setIsEditingSignature(true)}
        >
          Add a signature line
        </button>
      )}
      {signature && canEditTree && onTreeFieldPatch && (
        <button
          className="absolute -right-1 -top-5 text-[11px] text-muted-foreground opacity-0 underline decoration-muted-foreground/30 transition-opacity hover:text-foreground group-hover/signature:opacity-100 focus-visible:opacity-100"
          type="button"
          onClick={() => setIsEditingSignature(true)}
        >
          Edit
        </button>
      )}
    </div>
  );
}

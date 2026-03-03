"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { Button } from "@/components/third-party/ui/button";

export function AccountDeletion() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-foreground">Account deletion</h4>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data. This action is destructive and cannot be undone.
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="w-fit"
          onClick={() => setModalOpen(true)}
        >
          Delete account
        </Button>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Account deletion</DialogTitle>
            <DialogDescription>
              Account deletion is not yet implemented in the app. To request deletion of your account and data, please contact us at{" "}
              <a href="mailto:coalescencelabs@gmail.com" className="text-primary underline hover:no-underline">
                coalescencelabs@gmail.com
              </a>
              .
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

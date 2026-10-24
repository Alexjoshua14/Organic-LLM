"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/third-party/ui/button";

type Invitation = { id: string; emailAddress: string; status: string; createdAt: number };
type Delivery = "resend" | "clerk";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function InvitesDashboard() {
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const pending = useRef(false);

  const load = async () => {
    try {
      const response = await fetch("/api/admin/invites", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error ?? "Could not load invitations");
      setInvitations(result.invitations);
      setDelivery(result.delivery);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load invitations");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const send = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(null);
    setFallbackUrl(null);
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const result = await response.json();

      if (result.invitation) {
        setInvitations((previous) => [
          result.invitation,
          ...(previous ?? []).filter((i) => i.id !== result.invitation.id),
        ]);
      }
      if (result.inviteUrl) setFallbackUrl(result.inviteUrl);
      if (!response.ok) throw new Error(result.error ?? "Could not send the invitation");
      setMessage(
        `Invitation sent to ${result.invitation.emailAddress}${result.delivery === "clerk" ? " by Clerk" : ""}.`
      );
      setEmail("");
      setName("");
      setNote("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the invitation");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const revoke = async (invitation: Invitation) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invitation.id }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error ?? "Could not revoke the invitation");
      setInvitations((previous) => (previous ?? []).filter((i) => i.id !== invitation.id));
      setMessage(`Revoked the invitation for ${invitation.emailAddress}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not revoke the invitation");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Invites</h2>
        <p className="text-sm text-muted-foreground">
          Invited accounts start on the free plan and see only finished surfaces. Invitations expire
          after 30 days.
          {delivery === "clerk"
            ? " Branded email is off (set RESEND_API_KEY and INVITE_EMAIL_FROM); Clerk sends its own invitation."
            : null}
        </p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
            <span>Email</span>
            <input
              autoComplete="off"
              className={inputClass}
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
            <span>First name (optional)</span>
            <input
              autoComplete="off"
              className={inputClass}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        </div>
        <label className="block space-y-1 text-xs text-muted-foreground">
          <span>Personal note (optional)</span>
          <textarea
            className={`${inputClass} h-20 py-2`}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <Button disabled={busy} type="submit">
          Send invitation
        </Button>
      </form>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {fallbackUrl ? (
        <p className="text-sm">
          The invitation exists but the email failed. Share this link directly:{" "}
          <span className="break-all font-mono text-xs">{fallbackUrl}</span>
        </p>
      ) : null}
      <section className="space-y-3" aria-label="Pending invitations">
        <h3 className="text-sm font-medium">Pending invitations</h3>
        {invitations === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{invitation.emailAddress}</p>
                  <p className="text-xs text-muted-foreground">
                    Sent {new Date(invitation.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  disabled={busy}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => void revoke(invitation)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

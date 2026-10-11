"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/third-party/ui/button";
import { formatTokenCount, formatUsd } from "@/lib/usage/format";

type Charge = {
  id: string;
  model_id: string;
  cost_usd: number;
  total_tokens: number;
  created_at: string;
};
type Adjustment = {
  id: string;
  event_id: string | null;
  delta_usd: number;
  reason: string;
  created_by: string;
  created_at: string;
  effective_at: string;
};
type Ledger = { charges: Charge[]; adjustments: Adjustment[]; offset: number; pageSize: number };
const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function UsageLedgerDashboard({ initialOwnerId }: { initialOwnerId: string }) {
  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [ledgerOwner, setLedgerOwner] = useState("");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [eventId, setEventId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef(false);
  const correction = useRef<{ fingerprint: string; id: string } | null>(null);

  const load = async (offset = 0) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/usage-ledger?ownerId=${encodeURIComponent(ownerId.trim())}&offset=${offset}`,
        { cache: "no-store" }
      );
      if (!response.ok)
        throw new Error("Could not load the ledger. Check the profile ID and try again.");
      setLedger(await response.json());
      setLedgerOwner(ownerId.trim());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the ledger");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const append = async () => {
    if (pending.current || ledgerOwner !== ownerId.trim()) return;
    const payload = {
      ownerId: ledgerOwner,
      eventId: eventId.trim() || null,
      deltaUsd: Number(delta),
      reason: reason.trim(),
    };
    const fingerprint = JSON.stringify(payload);
    if (correction.current?.fingerprint !== fingerprint)
      correction.current = { fingerprint, id: crypto.randomUUID() };
    pending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/usage-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: correction.current.id, ...payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not append the adjustment");
      setMessage("Adjustment recorded. The original charge is preserved.");
      correction.current = null;
      setLedger((previous) =>
        previous
          ? { ...previous, adjustments: [result.adjustment, ...previous.adjustments] }
          : previous
      );
      setDelta("");
      setReason("");
      setEventId("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not append the adjustment");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Usage ledger</h2>
        <p className="text-sm text-muted-foreground">
          Original charges and admin adjustments. Entries cannot be edited or deleted.
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
          <span>Profile ID</span>
          <input
            className={inputClass}
            required
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
          />
        </label>
        <Button disabled={busy} type="submit" variant="secondary">
          Load ledger
        </Button>
      </form>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {ledger && ledgerOwner === ownerId.trim() ? (
        <>
          <section className="space-y-3" aria-label="Original charges">
            <h3 className="text-sm font-medium">Original charges</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="p-3">Recorded</th>
                    <th className="p-3">Model</th>
                    <th className="p-3 text-right">Tokens</th>
                    <th className="p-3 text-right">Cost</th>
                    <th className="p-3">
                      <span className="sr-only">Correct charge</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.charges.map((charge) => (
                    <tr key={charge.id} className="border-b border-border/40 last:border-0">
                      <td className="p-3 whitespace-nowrap">
                        {new Date(charge.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">{charge.model_id}</td>
                      <td className="p-3 text-right tabular-nums">
                        {formatTokenCount(charge.total_tokens)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatUsd(Number(charge.cost_usd))}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setEventId(charge.id)}
                        >
                          Correct
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ledger.charges.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No charges in this page.</p>
              ) : null}
            </div>
          </section>
          <section className="space-y-3" aria-label="Admin adjustments">
            <h3 className="text-sm font-medium">Admin adjustments</h3>
            {ledger.adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No adjustments in this page.</p>
            ) : (
              ledger.adjustments.map((item) => (
                <div
                  key={item.id}
                  className="space-y-1 rounded-lg border border-border p-3 text-xs"
                >
                  <p className="font-medium tabular-nums">
                    {Number(item.delta_usd) > 0 ? "+" : "−"}
                    {formatUsd(Math.abs(Number(item.delta_usd)))} ·{" "}
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                  <p>{item.reason}</p>
                  <p className="break-all text-muted-foreground">
                    Admin {item.created_by} · Effective{" "}
                    {new Date(item.effective_at).toLocaleString()}
                    {item.event_id ? ` · Charge ${item.event_id}` : ""}
                  </p>
                </div>
              ))
            )}
          </section>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || ledger.offset === 0}
              onClick={() => void load(Math.max(0, ledger.offset - 100))}
            >
              Newer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || (ledger.charges.length < 100 && ledger.adjustments.length < 100)}
              onClick={() => void load(ledger.offset + 100)}
            >
              Older
            </Button>
          </div>
          <form
            className="space-y-3 rounded-lg border border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void append();
            }}
          >
            <h3 className="text-sm font-medium">Append an adjustment</h3>
            <p className="text-xs text-muted-foreground">
              Negative amounts credit the allowance; positive amounts add spend. A charge correction
              applies to the original charge’s window. Leave the charge ID empty for a
              current-window adjustment.
            </p>
            <label className="block space-y-1 text-xs text-muted-foreground">
              <span>Charge ID (optional)</span>
              <input
                className={inputClass}
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              <span>Adjustment in USD</span>
              <input
                type="number"
                step="0.000001"
                min="-100000"
                max="100000"
                required
                className={inputClass}
                value={delta}
                onChange={(event) => setDelta(event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">
              <span>Reason</span>
              <input
                required
                maxLength={1000}
                className={inputClass}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <Button
              type="submit"
              variant="secondary"
              disabled={busy || !Number(delta) || !reason.trim()}
            >
              Append adjustment
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}

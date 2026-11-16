"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/third-party/ui/button";

type Status = {
  enabled: boolean;
  connected: boolean;
  planAuthorized?: boolean;
  account: string | null;
  reason?: string;
};
const API = "/api/subscription-chat";

export default function SubscriptionConnectionSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const response = await fetch(`${API}/status`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error ?? "Could not check your connection.");
    setStatus(data);
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("connection") === "failed")
      setError("ChatGPT sign-in could not be verified. Please try again.");
    void refresh().catch(() => setError("Could not check your connection. Reload to retry."));
  }, []);
  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/disconnect`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Could not disconnect.");
      setNotice(
        data.revoked
          ? "Disconnected."
          : "Disconnected from Organic. Remove the connection in ChatGPT settings to confirm remote revocation."
      );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-stack-lg py-8">
      <Link href="/settings?tab=connectors" className="text-sm underline">
        Back to connections
      </Link>
      <h1 className="font-commissioner text-3xl font-light">Your AI subscriptions</h1>
      <div className="space-y-stack-md rounded-2xl border border-border p-inset-lg">
        <h2 className="text-lg">ChatGPT</h2>
        <p className="text-sm text-muted-foreground">
          Connect your own account. Only your Organic profile can use or manage this connection.
        </p>
        <p className="text-sm" role="status">
          {!status
            ? "Checking connection…"
            : !status.enabled
              ? status.reason
              : status.connected && !status.planAuthorized
                ? "Connected — allow ChatGPT plan usage to use this subscription."
                : status.connected
                  ? `Connected${status.account ? ` as ${status.account}` : ""}`
                  : "Not connected"}
        </p>
        {status?.enabled && (
          <div className="flex flex-wrap gap-inline-sm">
            <form action={`${API}/connect`} method="post">
              <Button data-oai-siwc-button type="submit" disabled={busy} variant="outline">
                {status.connected ? "Reconnect with ChatGPT" : "Continue with ChatGPT"}
              </Button>
            </form>
            {status.connected && (
              <Button disabled={busy} variant="ghost" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Choosing a subscription in the model selector is coming separately. Connecting here does
          not change how your chats are billed.
        </p>
        <a
          href="https://chatgpt.com/settings/usage"
          target="_blank"
          rel="noreferrer"
          className="text-sm underline"
        >
          Manage ChatGPT plan usage
        </a>
        <p className="text-xs text-muted-foreground">
          Disable extra-credit spending in ChatGPT settings if you want to use included allowance
          only.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}

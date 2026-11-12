"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/third-party/ui/button";
import { Textarea } from "@/components/third-party/ui/textarea";
import { readSubscriptionStream } from "@/lib/subscription-chat/client-stream";
import type { SubscriptionMessage } from "@/lib/subscription-chat/policy";

type Connection = {
  connected: boolean;
  account: string | null;
  models: { id: string; name: string }[];
};
const API = "/api/subscription-chat";

export default function SubscriptionChat() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [model, setModel] = useState("");
  const [messages, setMessages] = useState<SubscriptionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [partial, setPartial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [usage, setUsage] = useState("");
  const controller = useRef<AbortController | null>(null);

  async function refresh() {
    const response = await fetch(`${API}/status`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not check the connection.");
    setConnection(data);
    setModel((selected) =>
      data.models.some((item: { id: string }) => item.id === selected)
        ? selected
        : (data.models[0]?.id ?? "")
    );
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("connection") === "failed") {
      setError(
        "ChatGPT sign-in could not be verified. Allow plan usage and try again with the same account."
      );
    }
    void refresh().catch((cause) => setError(cause.message));
    return () => controller.current?.abort();
  }, []);

  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/disconnect`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessages([]);
      setPartial("");
      setUsage("");
      setNotice(
        data.revoked
          ? "Disconnected."
          : "Disconnected locally. Remote revocation was not confirmed; remove Organic LLM in ChatGPT settings."
      );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !draft.trim() || !model) return;
    const prompt = draft.trim();
    const history: SubscriptionMessage[] = [...messages, { role: "user", content: prompt }];
    setBusy(true);
    setError("");
    setNotice("");
    setPartial("");
    setUsage("");
    setDraft("");
    setPendingPrompt(prompt);
    const abort = new AbortController();
    controller.current = abort;
    let answer = "";
    try {
      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: history }),
        signal: abort.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "The turn failed.");
      if (!response.body) throw new Error("The response did not contain a stream.");
      await readSubscriptionStream(response.body, (item) => {
        if (item.type === "delta") {
          answer += item.text;
          setPartial(answer);
        }
        if (item.type === "completed")
          setUsage(
            `${item.inputTokens.toLocaleString()} input · ${item.outputTokens.toLocaleString()} output tokens`
          );
      });
      if (!answer) throw new Error("No text was returned. Try another model.");
      setMessages([...history, { role: "assistant", content: answer }]);
      setPartial("");
    } catch (cause) {
      setDraft(prompt);
      setUsage("");
      setError(
        abort.signal.aborted
          ? "Turn stopped. The partial answer is not included in conversation history."
          : cause instanceof Error
            ? cause.message
            : "The turn failed."
      );
    } finally {
      setPendingPrompt("");
      controller.current = null;
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Local experiment
        </p>
        <h1 className="font-commissioner text-3xl font-light tracking-tight">
          Chat with your ChatGPT plan
        </h1>
        <p className="text-sm text-muted-foreground">
          A text-only conversation funded by your connected plan. No API-key or Gateway fallback.
        </p>
      </header>
      <div className="space-y-3 rounded-2xl border border-border bg-background/70 p-5">
        <p className="text-sm">
          {connection?.connected
            ? `Connected${connection.account ? ` as ${connection.account}` : ""}`
            : connection
              ? "Connect your ChatGPT account to begin."
              : error
                ? "Connection unavailable. Try signing in again."
                : "Checking your connection…"}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <form action={`${API}/connect`} method="post">
            <Button data-oai-siwc-button disabled={busy} type="submit" variant="outline">
              Continue with ChatGPT
            </Button>
          </form>
          {connection?.connected && (
            <Button disabled={busy} onClick={() => void disconnect()} variant="ghost">
              Disconnect
            </Button>
          )}
          <a
            className="text-sm underline underline-offset-4"
            href="https://chatgpt.com/settings/usage"
            rel="noreferrer"
            target="_blank"
          >
            Manage plan usage
          </a>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          In ChatGPT settings, disable credit use after your plan limit if you want no additional
          spending. This lab cannot change that provider setting. It makes no background model
          calls. Messages stay in this tab and clear on reload; memory, tools, and saved threads are
          not connected yet.
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
      {connection?.connected && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm" htmlFor="subscription-model">
              Model
            </label>
            <select
              className="min-w-0 max-w-full rounded-md border border-border bg-background p-2 text-sm focus-visible:outline focus-visible:outline-2"
              disabled={busy}
              id="subscription-model"
              onChange={(event) => setModel(event.target.value)}
              value={model}
            >
              {connection.models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Button
              disabled={busy}
              onClick={() => {
                setMessages([]);
                setPartial("");
                setError("");
                setUsage("");
              }}
              variant="ghost"
            >
              New chat
            </Button>
          </div>
          <ol aria-label="Conversation" className="space-y-5">
            {messages.map((message, index) => (
              <li key={index} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {message.role === "user" ? "You" : "Organic"}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {message.content}
                </p>
              </li>
            ))}
            {pendingPrompt && (
              <li className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">You</p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {pendingPrompt}
                </p>
              </li>
            )}
          </ol>
          {partial && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {busy ? "Organic · responding" : "Partial answer · not saved"}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{partial}</p>
            </div>
          )}
          <form className="space-y-3" onSubmit={(event) => void send(event)}>
            <label className="text-sm" htmlFor="subscription-message">
              Message
            </label>
            <Textarea
              disabled={busy}
              id="subscription-message"
              maxLength={16_000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="What would you like to explore?"
              rows={4}
              value={draft}
            />
            <div className="flex items-center justify-between gap-3">
              <p aria-live="polite" className="text-xs text-muted-foreground">
                {busy
                  ? "Responding using your ChatGPT plan…"
                  : usage || "Subscription connection only"}
              </p>
              {busy ? (
                <Button onClick={() => controller.current?.abort()} type="button" variant="outline">
                  Stop
                </Button>
              ) : (
                <Button disabled={!model || !draft.trim()} type="submit">
                  Send
                </Button>
              )}
            </div>
          </form>
        </>
      )}
    </section>
  );
}

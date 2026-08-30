# Debugging server errors

How to find out what actually broke when a chat turn fails — in Arcadia or any other
chat surface.

## What changed and why

`POST /api/chat` used to let an unhandled throw escape into Next.js, which answered
with an HTML error document (`A server error occurred. Reload to try again.`). The AI
SDK rejects with the response body as the error message, so that whole document ended
up as the toast text: thousands of characters of markup and no indication of what
failed. Anything raised *after* the response headers were sent was worse — the SDK
masks it as a flat `An error occurred.`

Now every failure path produces:

- a **structured JSON response** (never HTML), carrying an `errorId` and the `stage`
  that failed;
- one **greppable log line** tagged `ORGANIC_SERVER_ERROR`;
- an entry in the **recent-errors ring buffer** behind `/admin/errors`;
- for admins and in development, the **full report** (message, stack, provider status,
  request context) inline in the chat UI.

## Three places to look

### 1. The chat UI (admins and dev)

A diagnostics panel appears above the composer showing the stage, HTTP status, error
id, and — when you're an admin — the underlying error and stack. Everyone else sees a
short toast plus the error id.

Admin here means `profiles.admin = true`, the same gate as `/admin` and the sandbox
gateway (`lib/admin/require-admin.ts`). On a preview deploy where no account is
flagged yet, set `ORGANIC_EXPOSE_ERROR_DETAIL=true` to return detail to every caller.
Leave it off in production.

### 2. `/admin/errors`

The last 100 server errors, newest first, with route/stage filtering and full stacks.
Backed by Upstash when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are set;
otherwise it falls back to an in-process buffer that only covers the instance serving
the request (fine locally, thin on serverless).

### 3. Server logs

Each report is also printed as a single line:

```
ORGANIC_SERVER_ERROR {"errorId":"err_7360cf188888","route":"/api/chat","stage":"auth_gate", ...}
```

so it can be piped straight through `jq`:

```bash
vercel logs --since 1h | grep ORGANIC_SERVER_ERROR | sed 's/^.*ORGANIC_SERVER_ERROR //' | jq -r '[.at,.stage,.name,.message]|@tsv'
```

Or search for a specific `errorId` a user reported.

## Reading a report

| Field | Meaning |
|-------|---------|
| `stage` | Where in the turn it broke — see below |
| `errorId` | Ties the toast, the log line, and `/admin/errors` together |
| `status` | HTTP status we responded with; `200` means the failure happened mid-stream |
| `statusCode` | *Upstream* status (model gateway, Supabase), when the error carries one |
| `context` | `chatId`, `experience`, `model`, `clerkUserId`, `elapsedMs` |
| `stack` | Always captured server-side; returned only to privileged viewers |

Stages, in the order they run (`CHAT_STAGES` in `lib/observability/server-error.ts`):

`parse_body` → `validate_body` → `auth_gate` → `model_gate` → `request_setup` →
`load_context` → `system_prompt` → `arcadia_shortcut` → `compile_tools` →
`context_budget` → `llm_stream`, plus `persist_user_message`, `stream_transport` and
`resumable_stream` for work that runs alongside the turn.

Two stages are worth calling out:

- **`auth_gate`** covers Clerk, the Supabase profile lookup, *and* the Upstash rate
  limiter. A misconfigured or unreachable Upstash (rotated `UPSTASH_REDIS_REST_TOKEN`,
  wrong URL) throws here — that's the failure that used to surface as an opaque HTML
  500 with no hint that Redis was involved.
- **`resumable_stream`** is best-effort. It needs `REDIS_URL`; when it fails the turn
  still streams normally and only stream resumption is lost.

`validate_body` failures name the offending field path and Zod issue code (values are
never logged), so a schema drift between client and server is readable at a glance.

## If the client still shows an HTML page

That means the response never reached our handler — a middleware, proxy, or platform
error page. The client detects this shape and, when Next.js stamped a `digest` on it,
surfaces that digest; grep the server logs for the digest to find the matching stack.

## Where the code lives

| File | Role |
|------|------|
| `lib/observability/server-error.ts` | Report shape, error ids, stages, JSON response builder (isomorphic) |
| `lib/observability/report-server-error.ts` | Build + log + record, in one call |
| `lib/observability/error-store.ts` | Redis/in-memory ring buffer |
| `lib/observability/error-access.ts` | Who may see `detail` |
| `lib/chat/error-messages.ts` | Client-side parsing; keeps HTML out of toasts |
| `components/chat/chat-error-panel.tsx` | In-chat diagnostics panel |
| `app/admin/errors/` · `app/api/admin/errors/` | Admin dashboard and its API |

## Adding this to another route

```ts
const report = reportServerError({
  error,
  route: "/api/whatever",
  stage: "load_context",
  context: { chatId },
});

return serverErrorResponse(report, {
  includeDetail: await canSeeErrorDetail(clerkUserId),
});
```

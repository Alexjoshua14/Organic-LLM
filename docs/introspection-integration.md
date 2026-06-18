# Introspection integration

Organic LLM accepts encrypted bootstrap payloads from the **Introspection** app and hosts them in a **guided experience shell** (`/introspection/{threadId}`) instead of a flat chat scroll.

## Environment

Both apps must share the same secret:

```bash
# .env (Organic LLM and Introspection)
INTROSPECTION_ORGANIC_SHARED_SECRET=<base64-encoded-32+-byte-key>
```

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Apply the database migration before first use:

- [`docs/migrations/threads_introspection_config.sql`](./migrations/threads_introspection_config.sql)

## Button URL

After encrypting the payload (see below), redirect the signed-in user to:

```
{ORGANIC_BASE_URL}/introspection/start?p={encryptedPayload}
```

Examples:

- Production: `https://organic.coalescencelabs.app/introspection/start?p=...`
- Local override: `http://192.168.4.31:3000/introspection/start?p=...`

Organic LLM will:

1. Require Clerk sign-in (modal on `/introspection/start` if needed)
2. Decrypt and validate the payload (expiry + one-time nonce)
3. Create a thread with `feature=introspection`
4. Store hidden orchestration config encrypted at rest
5. Redirect to `/introspection/{threadId}` and strip `?p=` from history

## Payload schema (plaintext, before encryption)

```typescript
{
  v: 1,
  exp: number,              // Unix seconds — reject after this time
  nonce: string,            // Unique per handoff (replay-protected)
  title?: string,
  goal?: string,
  systemInstructions: string, // Hidden from user; server-only
  steps?: { id: string; title: string; hint?: string }[],
  initialOverview?: string,
}
```

## Encryption (Introspection side)

Wire format after encryption:

```
intro:v1:{ivBase64url}:{tagBase64url}:{ciphertextBase64url}
```

Algorithm: **AES-256-GCM** with the shared secret (first 32 decoded bytes).

### Node.js example

```javascript
import { createCipheriv, randomBytes } from "node:crypto";

const secret = Buffer.from(process.env.INTROSPECTION_ORGANIC_SHARED_SECRET, "base64");
const key = secret.subarray(0, 32);

function encryptPayload(payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "intro", "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

const payload = {
  v: 1,
  exp: Math.floor(Date.now() / 1000) + 3600,
  nonce: randomBytes(16).toString("hex"),
  title: "Daily reflection",
  goal: "Surface one actionable insight",
  systemInstructions: "You are a compassionate guide…",
  initialOverview: "## Daily reflection\n\nWe'll explore one core tension together.",
};

const p = encryptPayload(payload);
const url = `${process.env.ORGANIC_BASE_URL}/introspection/start?p=${encodeURIComponent(p)}`;
```

Organic LLM implements the same format in [`lib/crypto/introspection-payload.ts`](../lib/crypto/introspection-payload.ts).

## Runtime behavior

- **Hidden instructions**: `systemInstructions` are appended to the server system prompt only; they never appear in React props, API responses to the client, or user-visible messages.
- **Stable UI**: The LLM updates the overview via the `update_introspection_view` tool; streaming text appears in a collapsible “Latest response” panel.
- **Auto-start**: On first load, the client sends `"I'm ready to begin."` to kick off the guided flow.

## Security notes

- Use HTTPS in production; treat `?p=` like a short-lived credential (short `exp`, unique `nonce`).
- Nonces are stored on the thread row and rejected on reuse.
- Rotate `INTROSPECTION_ORGANIC_SHARED_SECRET` by deploying both apps together.

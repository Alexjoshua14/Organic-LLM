import { mock } from "bun:test";
import { use, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";

// Isolate Next's build-time font transform and request-bound session tree in this process.
mock.module("@/config/fonts", () => ({
  fontInter: { variable: "font-inter" },
  fontSatoshi: { variable: "font-satoshi" },
  fontCommissioner: { variable: "font-commissioner" },
}));

let resolveSession!: () => void;
const session = new Promise<void>((resolve) => {
  resolveSession = resolve;
});
mock.module("@/app/session-shell", () => ({
  SessionShell({ children }: { children: ReactNode }) {
    use(session);
    return <div data-session-resolved>{children}</div>;
  },
}));

const { default: RootLayout } = await import("@/app/layout");
const abort = new AbortController();
const timeout = setTimeout(() => abort.abort(), 2000);
try {
  const stream = await renderToReadableStream(
    <RootLayout>
      <div data-private-page>Resolved home</div>
    </RootLayout>,
    { signal: abort.signal }
  );
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const first = await reader.read();
  const initial = decoder.decode(first.value);
  // The fallback must arrive while the session is still unresolved.
  resolveSession();
  let rest = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    rest += decoder.decode(chunk.value);
  }
  console.log(JSON.stringify({ initial, rest }));
} finally {
  clearTimeout(timeout);
}

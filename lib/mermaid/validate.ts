/**
 * Server-side Mermaid syntax validation.
 *
 * Kept separate from lib/mermaid/source.ts (which must stay client-safe) because
 * this module imports Mermaid itself and patches its sanitizer. Only import it
 * from server code.
 */
import { createLogger } from "@/lib/logger";
import { annotateMermaidParseError, classifyMermaidValidationError } from "@/lib/mermaid/source";

const logger = createLogger("mermaid/validate");

let mermaidValidationInit: Promise<any> | null = null;

/**
 * Mermaid sanitizes node labels while *parsing* (e.g. FlowDB.addVertex ->
 * sanitizeText -> DOMPurify.sanitize), so a syntax check crashes under node/bun:
 * DOMPurify's module singleton early-returns a bare factory with no `sanitize`
 * when there is no global `window`.
 *
 * Only patched when DOMPurify reports itself unsupported, so there is never a
 * working sanitizer to weaken — the alternative is a guaranteed throw. The
 * sanitized text is also discarded: validation only observes whether `parse`
 * throws, and callers keep their original source. `isSupported` stays false so
 * anything else inspecting the module still sees a non-browser stub.
 */
export async function ensureMermaidParseSanitizer(): Promise<void> {
  const dompurify = (await import("dompurify")).default as any;

  if (dompurify.isSupported || typeof dompurify.sanitize === "function") return;

  dompurify.sanitize = (value: unknown) => String(value ?? "");
  dompurify.addHook = () => {};
  dompurify.removeHook = () => {};
  dompurify.removeHooks = () => {};
  dompurify.removeAllHooks = () => {};
}

export async function getMermaidForValidation(): Promise<any> {
  if (!mermaidValidationInit) {
    mermaidValidationInit = ensureMermaidParseSanitizer()
      .then(() => import("mermaid"))
      .then((mod: any) => {
        const m = mod?.default ?? mod;

        // Validation only runs mermaid.parse (syntax). No theme is set on
        // purpose: the neutral/base/dark palettes use 3-digit hex (e.g. "#eee")
        // that khroma cannot parse under bun/node and throws on at init time.
        try {
          m.initialize({ startOnLoad: false, securityLevel: "loose" });
        } catch {
          // Non-fatal: parse still works without init, and any environment
          // failure resurfaces at parse time where it is classified below.
        }

        return m;
      })
      .catch((err) => {
        // Don't poison the cache with a rejected import; allow a later retry.
        mermaidValidationInit = null;
        throw err;
      });
  }

  return mermaidValidationInit;
}

export type MermaidValidationResult =
  | { status: "valid" }
  | { status: "invalid"; error: string }
  | { status: "unverifiable"; reason: string };

/**
 * Validate Mermaid source with `mermaid.parse` (syntax only). A thrown error may
 * still describe the *environment* rather than the diagram, so we classify it:
 * callers fix real syntax errors but fail open on environment failures instead
 * of burning fix-retries on code that is almost certainly valid.
 */
export async function validateMermaidCode(code: string): Promise<MermaidValidationResult> {
  try {
    const mermaid = await getMermaidForValidation();

    // mermaid.parse throws on invalid syntax.
    await mermaid.parse(code);

    return { status: "valid" };
  } catch (err) {
    const e: any = err;
    const msg =
      typeof e?.str === "string"
        ? e.str
        : e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Mermaid parse failed";

    if (classifyMermaidValidationError(msg) === "environment") {
      logger.warn(
        "mermaid_validation",
        `Mermaid validation unavailable in this runtime; accepting code unverified (${msg}).`
      );

      return { status: "unverifiable", reason: msg };
    }

    // jison reports a 0-indexed line on the error hash; pass it through so the
    // fix model gets a location instead of just a message.
    return { status: "invalid", error: annotateMermaidParseError(msg, code, e?.hash?.line) };
  }
}

/**
 * Canaries for the warm-up self-check.
 *
 * `labeled` must come back "valid": a quoted label is what drives Mermaid
 * through DOMPurify, so this is the case that breaks if a second `dompurify`
 * copy re-enters the dependency tree and `ensureMermaidParseSanitizer` ends up
 * patching an instance Mermaid does not use. (The `dompurify` pin in
 * package.json `overrides` is what keeps the tree deduped.)
 *
 * `broken` must come back "invalid", proving validation is not just passing
 * everything through. Its error surfaces before any label is sanitized, which
 * is exactly why it alone cannot detect a missing sanitizer.
 */
export const MERMAID_VALIDATION_CANARIES = {
  labeled: 'flowchart TD\n  Start["Receive request"] --> Done["Return 200"]',
  broken: "flowchart TD\n  A[cost (USD)] --> B",
} as const;

let mermaidValidationSelfCheck: Promise<void> | null = null;

/** Warm Mermaid and log loudly if this runtime cannot syntax-check. */
export function verifyMermaidValidationWorks(): Promise<void> {
  if (!mermaidValidationSelfCheck) {
    mermaidValidationSelfCheck = (async () => {
      const [labeled, broken] = await Promise.all([
        validateMermaidCode(MERMAID_VALIDATION_CANARIES.labeled),
        validateMermaidCode(MERMAID_VALIDATION_CANARIES.broken),
      ]);

      if (labeled.status !== "valid" || broken.status !== "invalid") {
        logger.error(
          "mermaid_validation_broken",
          "Mermaid syntax validation is not working in this runtime " +
            `(labeled canary: "${labeled.status}", broken canary: "${broken.status}"). ` +
            "Generated diagrams will ship unverified and the fix loop will never run."
        );
      }
    })().catch(() => {
      // Never let the self-check take down tool construction.
    });
  }

  return mermaidValidationSelfCheck;
}

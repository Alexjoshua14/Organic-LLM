"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type TermWithDefinitionProps = {
  term: string;
  definition: string;
  className?: string;
};

function stripBackticks(s: string): string {
  return s.replace(/`/g, "").trim() || s;
}

export function TermWithDefinition({
  term,
  definition,
  className,
}: TermWithDefinitionProps) {
  const displayTerm = stripBackticks(term);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof document === "undefined") return;
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const cardHeight = 80;
    const placeAbove = spaceBelow < cardHeight + 8 && spaceAbove >= spaceBelow;
    if (placeAbove) {
      setCardStyle({
        position: "fixed",
        left: rect.left,
        bottom: viewportHeight - rect.top + 6,
        width: "max-content",
        maxWidth: Math.min(320, rect.width * 2),
        zIndex: 50,
      });
    } else {
      setCardStyle({
        position: "fixed",
        left: rect.left,
        top: rect.bottom + 6,
        width: "max-content",
        maxWidth: Math.min(320, rect.width * 2),
        zIndex: 50,
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [open, updatePosition]);

  const handleOpen = () => {
    setOpen(true);
    requestAnimationFrame(updatePosition);
  };

  const handleClose = () => setOpen(false);

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        className={cn(
          "cursor-help border-b border-dotted border-muted-foreground text-foreground",
          "hover:text-secondary-foreground focus:text-secondary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          className,
        )}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        aria-describedby={open ? `term-def-${displayTerm.replace(/\s/g, "-")}` : undefined}
      >
        {displayTerm}
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={`term-def-${displayTerm.replace(/\s/g, "-")}`}
            role="tooltip"
            className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
            style={cardStyle}
          >
            {definition}
          </div>,
          document.body,
        )}
    </>
  );
}

const DEFINITIONS: Record<string, string> = {
  "AES-256-GCM":
    "Authenticated encryption standard using 256-bit keys and Galois/Counter Mode; provides confidentiality and integrity. Hardware-accelerated on most CPUs.",
  "TLS 1.2/1.3":
    "Transport Layer Security protocols that encrypt data in transit between client and server.",
  "HKDF-derived":
    "Keys derived from a root secret using HMAC-based Key Derivation Function; no need to store per-user keys.",
  KMS: "Key Management Service; cloud or on-prem service for storing and rotating encryption keys (e.g. AWS KMS, Google Cloud KMS).",
  DEK: "Data Encryption Key; a key that encrypts data, often itself protected by a master key (KEK) in KMS designs.",
  "Mermaid diagram":
    "A diagram (flowchart, sequence, etc.) defined in text and rendered by the Mermaid library.",
  AEAD: "Authenticated Encryption with Associated Data; encryption that also authenticates plaintext and optional extra data (e.g. AES-GCM).",
  AAD: "Additional Authenticated Data; extra data (e.g. user ID, thread ID) bound to the ciphertext so it cannot be reused in another context.",
  IV: "Initialization vector; nonce used with the key so the same plaintext encrypts to different ciphertext each time.",
  Supabase:
    "Backend-as-a-Service platform providing database, auth, and real-time APIs; Organic LLM uses it for chat and user data.",
  "env var":
    "Environment variable; a configuration value set outside the app (e.g. for secrets), not stored in code.",
  "resumable stream":
    "A stream that can be paused and resumed (e.g. after page refresh) by storing a stream ID and reconnecting via GET.",
};

export function getTermDefinition(term: string): string | undefined {
  return DEFINITIONS[term];
}

export { DEFINITIONS };

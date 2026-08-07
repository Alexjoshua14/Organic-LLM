# Design backbone

Living design guidance for Organic LLM. Agents and humans should consult these docs
**before** changing motion, typography animation, chat loading states, or related UI
feel — so improvements stay consistent and do not regress quality.

## Documents

| Doc | When to read |
|-----|----------------|
| [Motion & character text timing](./motion-and-text-timing.md) | Any char-by-char / stagger / status-label / loading-state animation |
| [Adaptive background](../adaptive-background.md) + [timing](../adaptive-background-timing.md) | Ambient dim / focus atmospheres |
| [Organic presence](../organic-presence.md) | Presence indicators and ambient life |
| [Mermaid diagram design](../mermaid-diagram-design.md) | Diagram wells, reveal, takeover |

## Principles (product-wide)

1. **Functional motion stays brief.** Status and feedback should not feel like waiting.
2. **Exits faster than entrances.** Outgoing clears; incoming settles with slightly more presence.
3. **Honor reduced motion.** Prefer instant or simple cross-fades when `prefers-reduced-motion: reduce`.
4. **Source of truth in code.** Timing tokens live next to the effect (e.g. `lib/chat/processing-text-burn-timing.ts`); docs record *why* and the approved ranges.
5. **Prototype before shipping feel.** Use sandbox labs (`/sandbox/prototypes/…`) to compare, then promote constants — not one-off magic numbers in components.

## How to extend this backbone

1. Add a focused doc under `docs/design/` (one concern per file).
2. Link it from this README and from [docs/INDEX.md](../INDEX.md) → Design & UI.
3. If agents must apply it automatically, update `.cursor/rules/design-backbone.mdc` with a short pointer (keep the rule lean; put detail in the doc).
4. When shipping a new timing system, note the **approved Organic LLM values** and the research band they sit in.

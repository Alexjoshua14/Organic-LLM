# Spacing

Design backbone for **vertical rhythm**, **inline gaps**, and **inset padding** in Organic
LLM. Compiled from Material 3, Apple HIG, IBM Carbon, Shopify Polaris, Atlassian,
Stripe, and WCAG target-spacing guidance (2026 research pass).

**Related code**

- CSS primitives: [`styles/globals.css`](../../styles/globals.css) → `@theme` `--spacing-*`
- Semantic aliases: [`lib/design-tokens/spacing.ts`](../../lib/design-tokens/spacing.ts)

---

## Base grid

- **4px** fine steps (`stack-xs` … `stack-md`)
- **8px** layout rhythm for gaps between controls and card sections
- Aligns with Tailwind’s default scale (`1` = 4px) while giving **named** tokens

---

## Token roles

| Role | CSS prefix | Use for |
|------|------------|---------|
| **Stack** | `--spacing-stack-*` | Vertical rhythm (`space-y-stack-md`) |
| **Inline** | `--spacing-inline-*` | Flex/grid gaps between siblings (`gap-inline-sm`) |
| **Inset** | `--spacing-inset-*` | Padding (`p-inset-md`) |

### Primitive scale

| Token | px | Typical use |
|-------|-----|-------------|
| `stack-xs` | 4 | Micro list rows |
| `stack-sm` | 8 | Tight subsection, min control gap |
| `stack-md` | 12 | Default in-card section gap (desktop) |
| `stack-lg` | 16 | Roomy in-card / mobile section gap |
| `stack-xl` | 20 | Legacy “comfortable” section (avoid in dense chat UI) |
| `stack-2xl` | 24 | Major page sections |
| `stack-3xl` | 32 | Layout / hero margins |

### Semantic aliases (`spacing.card.*`)

Use in gen-ui and chat cards instead of ad-hoc `space-y-5`:

- **`spacing.card.section`** — `space-y-stack-lg sm:space-y-stack-md` (16px mobile → 12px desktop)
- **`spacing.card.labelStack`** — section label → primary content (`stack-xs`, 4px)
- **`spacing.card.block`** — header row → secondary body (e.g. expanded hours week list, `stack-md`)
- **`spacing.card.listItems`** — tight rows inside a block (`stack-xs`)
- **`spacing.card.sourcesLead`** — extra margin before review-source pills (`mt-stack-xs`, stacks on section gap)

---

## Principles

1. **Semantic over primitive** when the UI context is known (Polaris pattern).
2. **Component vs layout** — `stack-*` / `inline-*` for inside components; `stack-2xl`+ for page layout (Carbon).
3. **Step down at breakpoints** — same token names, one notch tighter on `sm+` for dense desktop cards (Material, Carbon).
4. **8px between tappable controls** — `gap-inline-sm`; keep 44px hit areas on primary actions (Apple HIG, WCAG 2.5.8).
5. **Line-height ≥ 1.5** and flexible containers — spacing tokens must not fight WCAG 1.4.12 text-spacing overrides.

---

## First consumer: restaurant card

Expanded desktop body uses `spacing.card.section` instead of `space-y-5` (20px).
Action chips keep `gap-inline-sm` (8px) — already aligned with touch-gap guidance.

Feature-local tokens (e.g. [`lib/rabbit-holes/designTokens.ts`](../../lib/rabbit-holes/designTokens.ts))
remain until a follow-up aliases them to these globals.

---

## Approved Organic LLM values (gen-ui cards)

| Context | Token | px (desktop) |
|---------|-------|----------------|
| Section stack (expanded card) | `spacing.card.section` | 12 (`stack-md`) |
| Section stack (mobile) | same, default breakpoint | 16 (`stack-lg`) |
| Action row gap | `spacing.gap.sm` | 8 |
| Label → content (Hours, Menu) | `spacing.card.labelStack` | 4 |
| Subsection header → expandable body | `spacing.card.block` | 12 |
| Menu → review pills (extra) | `spacing.card.sourcesLead` | +4 on section gap |

Do not go below **8px** between distinct interactive rows.

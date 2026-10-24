# CoreInput lab

Developer bench for the chat composer (`components/chat/core-input/`). Open it while
`bun run dev` is running at [`/sandbox/prototypes/core-input`](http://localhost:3000/sandbox/prototypes/core-input)
and keep it in a tab beside the file you are editing.

## Views

| View | URL | What renders |
|------|-----|--------------|
| Product | `?view=product` (default) | The shipped `CoreInput`, unchanged, on a width-controlled stage with every public prop as a knob. |
| Focus | `?view=focus&control=<id>` | Each footer control on its own, driven by lab state through `CoreInputControlsProvider`. Pinned cells hold a state for side-by-side comparison. |

Focus ids: `toolbar`, `tool-toggles`, `speech-chip`, `preview-chip`, `model-effort`,
`context-effort`, `context-budget`, `submit`, `settings-menu`, `attachments`, `lumen-shell`.
The list lives in `_components/focus-stage.tsx` (`FOCUS_CONTROLS`); add a card there and a
case in `FocusCardBody` to cover a new control.

## What is real and what is fixture

- **Composer, controls, surfaces** — production components. The focus view puts them on the real
  `PromptInput` shell so chips sit on the surface they ship on.
- **Chat status** — `_lib/use-simulated-chat.ts` stands in for `useChat`. A send runs
  submitted → streaming → ready (or error) on the timeline in `SIMULATED_SEND_TIMELINE`, so the
  composer's own submit/stop, shimmer, and restore-on-error paths execute for real.
- **Context budget** — `_lib/lab-budget.ts` builds a `ContextBudgetEstimate` through the same
  `finalizeContextBudget` window math as production, scaled to a chosen fill. In the product view
  the badge shows the new-thread default budget, which is what a blank chat shows.
- **Layout readout** — derived from the measured shell width and the composer's own breakpoints
  (`core-input/layout-breakpoints.ts`).

## Persistence

- Knobs persist under `organic-llm-lab-core-input-v1` so a full reload lands on the same setup.
  View and focused control live in the URL.
- The product view passes lab-only `localStorage` keys for model, effort, and memory
  (`LAB_COMPOSER_PREF_KEYS`), so experiments never rewrite the real chat's preferences. Web search
  and speech-friendly have no key override in `CoreInput` and stay shared.
- The "Context effort slider" switch writes the real `experimentalContextEffort` user setting —
  the same switch as Settings → Advanced — because that is the only way the shipped composer
  shows the slider.

## Production touch points

Small refactors made so the lab renders production presentation with controlled data:

- `core-input/layout-breakpoints.ts` — footer thresholds hoisted out of `core-input.tsx` and
  exported.
- `submit/submit-button.tsx` — `organicGlassSubmitClassName`; `submit/submit-glyph.tsx` —
  `resolveOrganicSubmitState`.
- `context-budget-indicator.tsx` — `ContextBudgetIndicatorView`, `ContextDonut`, and
  `ContextBudgetPopover` exported; the indicator is now hook + view.

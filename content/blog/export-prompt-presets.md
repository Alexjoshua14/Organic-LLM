# Export Prompt Presets: Minimal CTA, External Intelligence

Organic LLM now includes a centralized export flow that lets users move selected context into external systems with almost no UI friction.

The design goal is simple:

- keep the interface minimal,
- keep user intent explicit,
- keep output structure reliable.

This post documents how the feature works and why it is structured this way.

## Why This Feature Exists

Users often need outside capabilities while staying grounded in their current workspace context:

- script polishing,
- architecture summarization,
- career profile extraction,
- code analysis in Cursor.

The previous pattern required manual prompt writing and context reformatting. The new export flow reduces this to one action.

## UX Principle: Minimal by Default

The user should primarily see a single clear CTA, such as:

- `Request Script from ChatGPT`
- `Analyze code with Cursor`

We avoid exposing too many intermediate controls in the main interaction path. Prompt complexity is handled by Organic LLM behind the scenes.

## Architecture Summary

The feature is split into three layers:

1. **Preset registry**
   - canonical prompt intents and output contracts
   - file: `lib/export/prompts.ts`

2. **Reusable modal**
   - centralized text display + copy + export actions
   - file: `components/design-system/TextCopyModal.tsx`

3. **Prompt generation route**
   - Organic LLM generates/refines the final external prompt
   - file: `app/api/ai/export-prompt/route.ts`

First adopter:

- `app/sandbox/prototypes/glass-fonts/_components/glass-fonts-lab.tsx`

## Preset-Driven Prompt Contracts

Each preset defines:

- target app (`chatgpt` or `cursor`),
- user-facing button label,
- intent question,
- required response format,
- optional context placeholder.

This keeps exports predictable and easier to parse when brought back into Organic LLM.

## Organic LLM as Prompt Author

Instead of directly sending template text, the feature can route through Organic LLM to generate a refined external prompt:

- source context from the modal,
- selected preset contract,
- optional user context,
- target-app-specific framing.

If generation fails, deterministic fallback builders still produce a valid prompt/instruction package.

## Target Behaviors

### ChatGPT

- Generates final prompt text.
- Copies prompt to clipboard.
- Opens ChatGPT with prefilled query text.

### Cursor

- Generates structured instruction package.
- Copies instruction to clipboard for immediate paste into Cursor.

Current Cursor integration is clipboard-first by design. Deep-link/agent handoff can be added later without changing preset structure.

## Design Notes

- Modal background uses heavy blur with subtle darkening.
- CTA labels are explicit and task-oriented.
- Prompt structure is centralized for maintainability.
- The system is extensible without per-page hardcoding.

## What Comes Next

- Additional preset packs by workflow type.
- Optional return-channel schema for importing outputs back into Organic LLM.
- Richer app-specific integrations while preserving the same preset contract model.


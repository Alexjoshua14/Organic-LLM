# Welcome page image assets

Drop WebP files here and set `imageSrc` on the matching entry in `lib/welcome/copy.ts` (or add optional `imageSrc` fields when ready).

Recommended size: **1200×900** (4:3) or **1440×900** (16:10). WebP preferred.

## Technical highlights

| File | Placeholder ID | What to capture |
|------|----------------|-----------------|
| `security.webp` | `security` | Privacy/security page or encrypted-at-rest view |
| `streaming.webp` | `streaming` | Chat mid-stream or resume after refresh |
| `models.webp` | `models` | Composer model picker (Auto + gateway models) |
| `gen-ui.webp` | `gen-ui` | In-thread Gen UI block from chat or showcase |

## Features overview

| File | Placeholder ID | What to capture |
|------|----------------|-----------------|
| `feature-chat.webp` | `feature-chat` | Main chat thread with memory and tools |
| `feature-rabbitholes.webp` | `feature-rabbitholes` | Rabbit hole browse or node graph |
| `feature-strata.webp` | `feature-strata` | Strata section cards / snap-scroll editor |

## Optional later

| File | Placeholder ID |
|------|----------------|
| `feature-arcadia.webp` | Arcadia sandbox (Mermaid / kanban) |
| `feature-noesis.webp` | Noesis topic exploration |

After adding a file, set e.g. `imageSrc: "/welcome/security.webp"` on the corresponding highlight or feature object in `lib/welcome/copy.ts`.

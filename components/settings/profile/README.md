# Profile view (tree-based, premium UI)

Profile is rendered from a **tiered tree** (headline, optional roles, optional signature, sections). Data comes from tailored config, demo placeholder, or LLM-generated summary.

## Current components

- **Hero** – Avatar, name, headline, **RoleBadges** (engraved-style pills for e.g. "Software engineer", "Creative technologist").
- **SignatureBlock** – One high-level line (e.g. "Building a cohesive AI ecosystem under Coalescence Labs") using `glass()` and a left accent bar.
- **ProfileTreeView** – Recursive sections (title, body, items, children).

## Hardware target

Aimed at **leading consumer tech**: MacBook Pros, Raspberry Pi 5, iPhone 16 Pro (and 18), optional cloud. Styling uses:

- `backdrop-blur`, gradients, subtle shadows
- No heavy animation or Rive yet

## Future direction (for when you direct)

- **Rive** – Can be added for richer motion and illustration (signature block, hero, or section accents) once you’re ready.
- **More “permanent” treatments** – Deeper engraved/chiseled type, optional subtle parallax or depth.
- **LLM tiering** – API can return a full `ProfileTree` (with roles, signature, nested sections) so the same UI renders LLM-shaped content.

You can swap copy and structure in `config/profile-trees.ts` and `config/tailored-profiles.ts`.

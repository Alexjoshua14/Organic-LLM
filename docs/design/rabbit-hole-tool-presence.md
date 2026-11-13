# Rabbit-hole tool presence

Arcadia's rabbit-hole tools render a dedicated curvilinear tunnel card in
`components/chat/rabbit-hole-tool-presence.tsx`, routed through the shared
`OrganicToolCallPresence` for current and historical tool parts. Creation stays inline
beside reasoning disclosures; it is a product result rather than a process tool.

The card distinguishes an executing tool from a successfully scheduled exploration.
“Rabbit hole created” confirms creation, while the separate background-generation note
explains that the article is still being written. These are transcript snapshots, not live
job monitors. Failed tool outputs (`ok: false`) must never show success or navigation.

The graphic uses a fixed SVG mesh with no filters, random geometry, shared IDs, timers,
or per-frame JavaScript. On tool entry, opacity reveals over 220ms and one small scale
ripple settles over 600ms. Timing lives in the component's CSS module. The ripple is a
brief attention cue, not an interaction delay; completed transcript cards stay still.
Reduced motion disables both animations. Keep reveals within 180–240ms and the single
ripple within 400–600ms. This follows the existing Stage grid and character-ripple
language without introducing ongoing animation into a conversation.

Open links are built from session IDs and always stay on `/rabbitholes`; arbitrary tool
URLs are not used. Existing drawer generation/navigation tools keep their node-open event.
Opening an article and expanding tool details are separate actions. Large raw outputs
are formatted and mounted only after the native details disclosure opens. Search results
show at most four destination links; the full payload remains inspectable in details.

The card uses existing semantic theme colors and supports narrow containers, long titles,
keyboard focus, native disclosures and pinning. Tests cover creation, transport and domain
errors, safe destinations, drawer navigation, historical messages and visibility beside
collapsed reasoning. Visual checks should include light/dark themes, 320px width,
expanded details and reduced motion.

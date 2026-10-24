# Arcadia: Podcast Script (Audio + Video for ElevenLabs)

*A short script for describing Arcadia as a new project, feature, and UX. Optimized for ElevenLabs TTS and video — conversational tone, clear pacing.*

---

## Video treatment (ElevenLabs)

**Concept:** Single speaker, direct-to-camera or slight angle. Clean, minimal background (soft gradient or subtle Organic LLM brand tones). Optional B-roll or screen-record overlays when features are named.

**Pacing:** Steady, slightly slower than normal speech. Short pauses after section headings and before “So” or “That’s Arcadia” so cuts or graphics can breathe.

**On-screen text / lower-thirds (optional):**
- Intro: “Arcadia — Sandbox Chat”
- What Arcadia is: “Concise • Tools • Mermaid diagrams”
- Why it exists: “Main chat = stable. Arcadia = lab.”
- Sidebar: “Coalescence Mode: one list or main-only”
- Design: “Same stack. Arcadia flag. Extra UI for diagrams.”
- Outro: “Same app. Same threads. Separate lab.”

**B-roll / screen capture suggestions (if cutting away from speaker):**
- **~0:45** — Quick shot of Arcadia chat: input, one short reply, one tool card.
- **~1:00** — Mermaid diagram rendering in thread (flowchart or sequence).
- **~1:30** — Sidebar with Coalescence on: mix of default and Arcadia (forest-green) rows; hover to show brown-glass.
- **~2:00** — Sandbox gateway or app shell to reinforce “same app, same threads.”

**Lighting / tone:** Even, soft key light; no harsh shadows. Feels product-walkthrough friendly, not theatrical.

---

**[Intro — 30 sec]**

Hey. This is a quick walkthrough of Arcadia: a new sandbox chat experience inside Organic LLM.

If you’ve ever wanted to try out different prompts, tools, or UI ideas without touching your main chat — Arcadia is built for that. Same app, same threads, but a dedicated place to experiment.

**[What Arcadia is — 45 sec]**

Arcadia is a sandbox. You get the same chat shell you’re used to: the same input, the same thread list, the same persistence. But in Arcadia we tune the experience for experimentation.

The model is nudged to be more concise and to lean on tools instead of long prose. Responses are kept short enough that a single reply rarely fills more than about one screen on mobile. If something needs depth, the assistant can offer to expand rather than dumping a wall of text.

We also give Arcadia its own tools. One of them is a Mermaid diagram generator: you ask for a diagram, and a small planner model plus a diagram specialist produce Mermaid code. The UI then renders that as a real diagram inline — in the message and in tool output cards — so you can see flowcharts, sequence diagrams, and the like without leaving the thread.

**[Why it exists — 30 sec]**

The main Organic LLM chat is your stable, daily driver. Arcadia is the lab. New system instructions, new context shapes, new tools, or new UI variants can land here first. If they work, they can later move into the main route. If they break, your main chat is unaffected.

So: same infrastructure — Supabase, Clerk, the shared API — but a separate “personality” and feature set so you can iterate quickly without destabilizing the core product.

**[Sidebar and Coalescence — 30 sec]**

Arcadia threads live in the same database as your main chats. In the sidebar, you can choose whether to see everything in one list or only main chat.

When “Coalescence Mode” is on, the sidebar shows both main chat threads and Arcadia threads. Arcadia rows have a subtle forest-green tint and a brown-glass style on hover so you can tell them apart at a glance. Clicking a thread takes you to the right place: main chat or the Arcadia sandbox, depending on how that thread was created.

When Coalescence Mode is off, the sidebar shows only main chat. Arcadia threads are still there — you can open them via the sandbox gateway or a direct link — they’re just hidden from the unified list so the sidebar stays focused.

**[Design and stack — 20 sec]**

Under the hood, Arcadia uses the same stack as the rest of Organic LLM: Next.js, React, the AI SDK for streaming, Clerk for auth, and Supabase for threads and messages. It hits the same main chat API; we just send a flag so the server can apply Arcadia-specific prompts and tools. The only extra UI is the diagram renderer and the pinned tool-output cards so you can keep a diagram or tool result in view while you scroll.

**[Outro — 15 sec]**

That’s Arcadia: a sandbox chat where you can safely try new prompts, tools, and UI ideas — with shorter answers, diagram generation, and a clear place in the sidebar when you want it. Same app, same threads, separate lab.

Thanks for listening.

---

*For video: use the narration blocks above as ElevenLabs voiceover; pair with the Video treatment (concept, pacing, lower-thirds, B-roll cues) for a narrated product video.*

---

## ElevenLabs Image & Video: prompt text for Start frame / Submit

**How it works:** In ElevenLabs app → **Image & Video** (or **Creative** → image-video), you get a prompt box (“Write a prompt for your video…”). You can start from **text only**, or from an **image** (start frame) plus text. The model needs a **visual** description: subject, setting, camera, and motion — like a short shot list, not the voiceover script. Pick a model (e.g. Wan 2.5, Veo, Sora), then paste one of the prompts below and click **Submit**. If there’s a separate “Start frame” field, use the first prompt there and the second in the main box; otherwise use the single-prompt version.

---

### Single prompt (paste and Submit)

Use this in the main prompt box if you’re doing one continuous clip:

```
Product explainer shot. One person, mid-20s to 30s, speaking to camera in a clean modern room. Soft gradient background, neutral or warm tones. Even soft key light, no harsh shadows. Camera: static or very slow push-in. Subject speaks naturally to lens, minimal movement. Style: professional product walkthrough, calm and clear. No text on screen. 16:9, cinematic but minimal.
```

---

### Start frame (if the UI has a separate “Start frame” or “First frame” field)

**Start frame prompt** (describes the opening image/frame):

```
Single person from chest up, facing camera, in a minimal indoor setting. Soft gradient background, neutral or warm. Even soft lighting, professional product-video style. Clean, modern, calm expression. No text or graphics. 16:9.
```

**Main video prompt** (paste in the main box and Submit):

```
Same person as start frame, speaking to camera. Minimal movement; slight natural head and hand gestures. Soft gradient background stays consistent. Camera: locked or very slow push-in. Product walkthrough tone. No on-screen text. 16:9.
```

---

### Short alternate (if you need a tighter prompt)

```
One person to camera, soft gradient background, even lighting. Static or slow push-in. Professional explainer, minimal movement. 16:9.
```

Use the **narration** from the sections above as a separate voiceover in **Studio** (or another tool) and align it to the generated clip.
